# Instant Play Predictive Pre-fetch & Media Session Controller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two major non-AI performance and multimedia features for Maxen:
1. **Instant Play Predictive Pre-fetch Engine (#16):** Pre-resolves HLS streams, IntroDB skip timestamps, and TMDB scene thumbnails in the background when navigating detail views or browsing episodes, delivering 0ms latency playback when the user presses play.
2. **Lock Screen / Dynamic Island Media Session Controller (#15):** Synchronizes lock screen media state with `expo-video` playback, supports native media session metadata, and renders a floating Dynamic Island / Live Activity pill across the app and lock screen with real-time Watch Party status.

**Architecture:**
- `StreamPreheater.ts`: Singleton memory LRU cache managing in-flight and completed stream resolution promises, intro data, and scene thumbnails with automatic TTL expiration (15 minutes).
- `useDetailState.ts` & `SeasonEpisodeList.tsx`: Triggers low-priority preheating on screen focus, season change, and episode card selection.
- `VideoPlayerView.tsx`: Consumes preheated stream cache immediately on mount, skipping the 2-4s resolution spinner.
- `mediaSessionService.ts`: Manages playback state, notification triggers, and lock screen metadata.
- `LiveActivityPill.tsx`: Floating mini dynamic HUD displaying current progress, time remaining, quick play/pause/seek controls, and live Watch Party viewers badge.

**Tech Stack:** React Native 0.81, Expo SDK 54 (`expo-video`, `expo-image`, `expo-linear-gradient`), Zustand (`playerStore`, `uiStore`), TypeScript.

---

## Global Constraints
- Strictly NON-AI implementation.
- Must preserve backward compatibility with all existing resolvers (VixSrc, backend proxies, direct embeds).
- Zero memory leaks: preheated cache items must be bounded and garbage-collected after TTL.
- Fully compatible with Android TV (D-Pad navigation) and Mobile (Touch / Gestures).

---

### Task 1: StreamPreheater Service & In-Memory LRU Cache

**Files:**
- Create: `src/features/player/services/StreamPreheater.ts`
- Modify: `src/features/player/services.ts`
- Test: `__tests__/StreamPreheater.test.ts`

**Interfaces:**
- Produces: `streamPreheater.preheat(params: PreheatParams): Promise<PreheatedData>`, `streamPreheater.get(key: string): PreheatedData | null`, `streamPreheater.generateKey(tmdbId: string, type: string, season?: number, episode?: number): string`

- [ ] **Step 1: Write the failing unit tests for StreamPreheater**

```typescript
// __tests__/StreamPreheater.test.ts
import { streamPreheater } from '@/features/player/services/StreamPreheater';

describe('StreamPreheater', () => {
  beforeEach(() => {
    streamPreheater.clear();
  });

  it('generates consistent cache keys for movies and tv shows', () => {
    const movieKey = streamPreheater.generateKey('12345', 'movie');
    const tvKey = streamPreheater.generateKey('67890', 'tv', 2, 4);

    expect(movieKey).toBe('movie_12345_1_1');
    expect(tvKey).toBe('tv_67890_2_4');
  });

  it('caches preheated data and returns it synchronously', async () => {
    const mockResolver = jest.fn().mockResolvedValue({
      streamUrl: 'https://example.com/stream.m3u8',
      provider: 'MockProvider',
    });

    await streamPreheater.preheatDirect(
      '12345',
      'movie',
      1,
      1,
      mockResolver
    );

    const cached = streamPreheater.get('movie_12345_1_1');
    expect(cached).toBeDefined();
    expect(cached?.streamResult?.streamUrl).toBe('https://example.com/stream.m3u8');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/StreamPreheater.test.ts`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Implement StreamPreheater service**

```typescript
// src/features/player/services/StreamPreheater.ts
import { resolveParallelDirectStream, ResolvedStreamResult } from './streamResolverService';
import { fetchEpisodeIntro, IntroData } from './introService';
import { fetchMediaSceneThumbnails } from '@/services/api/tmdbService';

export interface PreheatedData {
  key: string;
  tmdbId: string;
  type: 'movie' | 'tv';
  season: number;
  episode: number;
  streamResult?: ResolvedStreamResult | null;
  introData?: IntroData | null;
  sceneThumbnails?: string[];
  timestamp: number;
  inFlightPromise?: Promise<any>;
}

class StreamPreheaterService {
  private cache = new Map<string, PreheatedData>();
  private readonly MAX_CACHE_SIZE = 10;
  private readonly TTL_MS = 15 * 60 * 1000; // 15 minutes

  generateKey(tmdbId: string | number, type: 'movie' | 'tv' | string, season = 1, episode = 1): string {
    const normalizedType = type === 'tv' ? 'tv' : 'movie';
    return `${normalizedType}_${tmdbId}_${season}_${episode}`;
  }

  get(key: string): PreheatedData | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > this.TTL_MS) {
      this.cache.delete(key);
      return null;
    }
    return item;
  }

  async preheat(
    tmdbId: string | number,
    type: 'movie' | 'tv' | string,
    season = 1,
    episode = 1
  ): Promise<PreheatedData> {
    const idStr = String(tmdbId);
    const normType = type === 'tv' ? 'tv' : 'movie';
    const key = this.generateKey(idStr, normType, season, episode);

    const existing = this.get(key);
    if (existing?.streamResult) {
      return existing;
    }
    if (existing?.inFlightPromise) {
      return existing.inFlightPromise;
    }

    const preheated: PreheatedData = {
      key,
      tmdbId: idStr,
      type: normType,
      season,
      episode,
      timestamp: Date.now(),
    };

    const inFlight = (async () => {
      try {
        const [streamRes, introRes, thumbsRes] = await Promise.allSettled([
          resolveParallelDirectStream({
            tmdbId: idStr,
            isMovie: normType === 'movie',
            seasonNum: season,
            episodeNum: episode,
            timeoutMs: 4500,
          }),
          normType === 'tv'
            ? fetchEpisodeIntro(idStr, season, episode)
            : Promise.resolve(null),
          fetchMediaSceneThumbnails(idStr, normType, season, episode),
        ]);

        if (streamRes.status === 'fulfilled' && streamRes.value) {
          preheated.streamResult = streamRes.value;
        }
        if (introRes.status === 'fulfilled' && introRes.value) {
          preheated.introData = introRes.value;
        }
        if (thumbsRes.status === 'fulfilled' && thumbsRes.value) {
          preheated.sceneThumbnails = thumbsRes.value;
        }
      } catch (e) {
        console.warn('[StreamPreheater] Error during preheat:', e);
      } finally {
        preheated.inFlightPromise = undefined;
      }
      return preheated;
    })();

    preheated.inFlightPromise = inFlight;
    this.setCache(key, preheated);

    return inFlight;
  }

  async preheatDirect(
    tmdbId: string,
    type: 'movie' | 'tv',
    season = 1,
    episode = 1,
    resolverFn: () => Promise<ResolvedStreamResult>
  ): Promise<PreheatedData> {
    const key = this.generateKey(tmdbId, type, season, episode);
    const result = await resolverFn();
    const preheated: PreheatedData = {
      key,
      tmdbId,
      type,
      season,
      episode,
      streamResult: result,
      timestamp: Date.now(),
    };
    this.setCache(key, preheated);
    return preheated;
  }

  private setCache(key: string, data: PreheatedData) {
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, data);
  }

  clear() {
    this.cache.clear();
  }
}

export const streamPreheater = new StreamPreheaterService();
```

- [ ] **Step 4: Export from `src/features/player/services.ts` & Run tests to verify pass**

Run: `npx jest __tests__/StreamPreheater.test.ts`
Expected: PASS

---

### Task 2: DetailView, HeroBanner & SeasonEpisodeList Preheating Entegrasyonu

**Files:**
- Modify: `src/views/detail/useDetailState.ts`
- Modify: `src/views/detail/SeasonEpisodeList.tsx`
- Modify: `src/views/home/HeroBanner.tsx`

- [ ] **Step 1: In `useDetailState.ts`, trigger preheating as soon as media details load**

```typescript
// Inside useDetailState.ts
import { streamPreheater } from '@/features/player/services/StreamPreheater';

// In useEffect after media is loaded:
useEffect(() => {
  if (!media) return;
  const tmdbId = media.tmdbId || media.id;
  if (!tmdbId) return;

  const isMovie = media.type === 'movie' || media.media_type === 'movie';
  const targetSeason = selectedSeason || media.season_number || 1;
  const targetEpisode = media.episode_number || 1;

  // Background silent preheat
  streamPreheater.preheat(
    tmdbId,
    isMovie ? 'movie' : 'tv',
    targetSeason,
    targetEpisode
  );
}, [media, selectedSeason]);
```

- [ ] **Step 2: In `SeasonEpisodeList.tsx`, preheat episode when focused or viewed**

```typescript
// In SeasonEpisodeList.tsx: when episode item renders or focuses on TV:
const handleFocusEpisode = (ep: any) => {
  if (tvId && ep.episode_number) {
    streamPreheater.preheat(tvId, 'tv', seasonNumber, ep.episode_number);
  }
};
```

- [ ] **Step 3: In `HeroBanner.tsx`, preheat the featured hero banner stream**

```typescript
// In HeroBanner.tsx:
useEffect(() => {
  if (featuredMedia?.id) {
    streamPreheater.preheat(
      featuredMedia.id,
      featuredMedia.type || 'movie',
      1,
      1
    );
  }
}, [featuredMedia?.id]);
```

---

### Task 3: VideoPlayerView Instant-Play Fast-Path

**Files:**
- Modify: `src/views/VideoPlayerView.tsx`

- [ ] **Step 1: Check `streamPreheater.get()` on mount in `VideoPlayerView.tsx`**

```typescript
// In VideoPlayerView.tsx:
import { streamPreheater } from '@/features/player/services/StreamPreheater';

// Inside resolveAndPlayStream:
const cacheKey = streamPreheater.generateKey(tmdbId, isMovie ? 'movie' : 'tv', seasonNum, episodeNum);
const preheated = streamPreheater.get(cacheKey);

if (preheated?.streamResult?.streamUrl) {
  console.log('[Fast-Path] ⚡ Instant Play Activated from Preheated Cache!');
  setStreamUrl(preheated.streamResult.streamUrl);
  setStreamHeaders(preheated.streamResult.headers || {});
  if (preheated.introData) setIntroData(preheated.introData);
  if (preheated.sceneThumbnails) setSceneThumbnails(preheated.sceneThumbnails);
  setResolving(false);
  return;
}
```

- [ ] **Step 2: If in-flight, await the preheat promise instead of redundant scraping**

```typescript
if (preheated?.inFlightPromise) {
  console.log('[Fast-Path] ⏳ Awaiting existing in-flight preheat request...');
  const res = await preheated.inFlightPromise;
  if (res?.streamResult?.streamUrl) {
    setStreamUrl(res.streamResult.streamUrl);
    setStreamHeaders(res.streamResult.headers || {});
    if (res.introData) setIntroData(res.introData);
    if (res.sceneThumbnails) setSceneThumbnails(res.sceneThumbnails);
    setResolving(false);
    return;
  }
}
```

---

### Task 4: Media Session & Lock Screen Now Playing Service

**Files:**
- Create: `src/features/player/services/mediaSessionService.ts`
- Modify: `src/store/playerStore.ts`

- [ ] **Step 1: Create `mediaSessionService.ts` to manage now playing metadata**

```typescript
// src/features/player/services/mediaSessionService.ts
export interface MediaMetadata {
  title: string;
  artist?: string;
  seriesTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  artworkUrl?: string | null;
  durationSeconds: number;
  currentPositionSeconds: number;
  isPlaying: boolean;
  partyCode?: string | null;
  partyViewerCount?: number;
}

class MediaSessionService {
  private currentMetadata: MediaMetadata | null = null;
  private listeners = new Set<(meta: MediaMetadata | null) => void>();

  updateSession(metadata: Partial<MediaMetadata>) {
    if (!this.currentMetadata && metadata.title) {
      this.currentMetadata = {
        title: metadata.title,
        durationSeconds: metadata.durationSeconds || 0,
        currentPositionSeconds: metadata.currentPositionSeconds || 0,
        isPlaying: metadata.isPlaying ?? true,
        ...metadata,
      } as MediaMetadata;
    } else if (this.currentMetadata) {
      this.currentMetadata = {
        ...this.currentMetadata,
        ...metadata,
      };
    }
    this.notifyListeners();
  }

  clearSession() {
    this.currentMetadata = null;
    this.notifyListeners();
  }

  getSession(): MediaMetadata | null {
    return this.currentMetadata;
  }

  subscribe(listener: (meta: MediaMetadata | null) => void) {
    this.listeners.add(listener);
    listener(this.currentMetadata);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => fn(this.currentMetadata));
  }
}

export const mediaSessionService = new MediaSessionService();
```

---

### Task 5: Dynamic Island / In-App Live Activity Floating Pill

**Files:**
- Create: `src/features/player/components/LiveActivityPill.tsx`
- Modify: `src/app/index.tsx`

- [ ] **Step 1: Create `LiveActivityPill.tsx` component**

```typescript
// src/features/player/components/LiveActivityPill.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { mediaSessionService, MediaMetadata } from '../services/mediaSessionService';
import { useUiStore } from '@/store/uiStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function LiveActivityPill() {
  const [session, setSession] = useState<MediaMetadata | null>(null);
  const activeVideo = useUiStore((state) => state.activeVideo);
  const isMiniPlayer = useUiStore((state) => state.isMiniPlayer);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    return mediaSessionService.subscribe(setSession);
  }, []);

  // Show only when there is active media playing or minimized
  if (!session || (activeVideo && !isMiniPlayer)) return null;

  const progressPercent = session.durationSeconds > 0
    ? (session.currentPositionSeconds / session.durationSeconds) * 100
    : 0;

  return (
    <View style={[styles.container, { top: insets.top + 6 }]}>
      <View style={styles.pill}>
        {session.artworkUrl ? (
          <Image source={{ uri: session.artworkUrl }} style={styles.artwork} />
        ) : (
          <View style={styles.iconBox}>
            <Ionicons name="film" size={14} color="#E50914" />
          </View>
        )}

        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {session.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {session.partyCode ? `👥 Party #${session.partyCode}` : (session.isPlaying ? 'Oynatılıyor' : 'Duraklatıldı')}
          </Text>
        </View>

        <View style={styles.progressRing}>
          <Text style={styles.percentText}>{Math.round(progressPercent)}%</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 9999,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 20, 24, 0.95)',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
    maxWidth: 380,
    width: '100%',
  },
  artwork: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  iconBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(229,9,20,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  content: { flex: 1 },
  title: { color: '#fff', fontSize: 12, fontWeight: '700' },
  subtitle: { color: '#8e8e93', fontSize: 10, marginTop: 1 },
  progressRing: { marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(229,9,20,0.2)', borderRadius: 8 },
  percentText: { color: '#E50914', fontSize: 10, fontWeight: '800' },
});
```

- [ ] **Step 2: Render `LiveActivityPill` inside `src/app/index.tsx`**

---

### Task 6: VideoPlayerView MediaSession Entegrasyonu & Bütünleşik Doğrulama

**Files:**
- Modify: `src/views/VideoPlayerView.tsx`

- [ ] **Step 1: Synchronize playback changes to `mediaSessionService`**

```typescript
// In VideoPlayerView.tsx:
useEffect(() => {
  mediaSessionService.updateSession({
    title: title || 'Video',
    seriesTitle: isMovie ? undefined : (media.name || media.title),
    seasonNumber: isMovie ? undefined : seasonNum,
    episodeNumber: isMovie ? undefined : episodeNum,
    artworkUrl: media.posterUrl || media.poster_path || null,
    durationSeconds: duration,
    currentPositionSeconds: currentTime,
    isPlaying,
    partyCode: activeWatchParty?.code || null,
  });

  return () => {
    mediaSessionService.clearSession();
  };
}, [title, isMovie, seasonNum, episodeNum, duration, currentTime, isPlaying, activeWatchParty?.code]);
```

- [ ] **Step 2: Run test suite & verify no regressions**

Run: `npm test`
Expected: ALL PASS
