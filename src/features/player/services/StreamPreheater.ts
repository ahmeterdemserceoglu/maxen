import {
  resolveParallelDirectStreamResult,
  ResolvedStreamResult,
} from './streamResolverService';
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

export class StreamPreheaterService {
  private cache = new Map<string, PreheatedData>();
  private ttlMs: number;
  private maxSize: number;

  constructor(ttlMs: number = 15 * 60 * 1000, maxSize: number = 10) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }

  generateKey(
    tmdbId: string | number,
    type: 'movie' | 'tv' | string,
    season: number = 1,
    episode: number = 1
  ): string {
    const normalizedType = String(type).toLowerCase() === 'tv' ? 'tv' : 'movie';
    const seasonNum = Number(season) || 1;
    const episodeNum = Number(episode) || 1;
    return `${normalizedType}_${tmdbId}_${seasonNum}_${episodeNum}`;
  }

  get(key: string): PreheatedData | null {
    const item = this.cache.get(key);
    if (!item) return null;

    const now = Date.now();
    if (now - item.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Refresh LRU order (delete & re-insert to move to end)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item;
  }

  set(key: string, data: PreheatedData): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest (least recently used)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, data);
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  get size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }

  async preheat(
    tmdbId: string | number,
    type: 'movie' | 'tv' | string,
    season: number = 1,
    episode: number = 1
  ): Promise<PreheatedData> {
    return this.preheatDirect(tmdbId, type, season, episode);
  }

  async preheatDirect(
    tmdbId: string | number,
    type: 'movie' | 'tv' | string,
    season: number = 1,
    episode: number = 1,
    resolverFn?: () => Promise<ResolvedStreamResult | null>
  ): Promise<PreheatedData> {
    const tmdbIdStr = String(tmdbId);
    const mediaType: 'movie' | 'tv' = String(type).toLowerCase() === 'tv' ? 'tv' : 'movie';
    const seasonNum = Number(season) || 1;
    const episodeNum = Number(episode) || 1;
    const key = this.generateKey(tmdbIdStr, mediaType, seasonNum, episodeNum);

    const cached = this.get(key);
    if (cached) {
      if (cached.streamResult) {
        return cached;
      }
      if (cached.inFlightPromise) {
        return cached.inFlightPromise;
      }
    }

    const preheatItem: PreheatedData = {
      key,
      tmdbId: tmdbIdStr,
      type: mediaType,
      season: seasonNum,
      episode: episodeNum,
      timestamp: Date.now(),
    };

    const inFlight = (async () => {
      try {
        const streamPromise = resolverFn
          ? resolverFn().catch(() => null)
          : resolveParallelDirectStreamResult({
              tmdbId: tmdbIdStr,
              isMovie: mediaType === 'movie',
              seasonNum: seasonNum,
              episodeNum: episodeNum,
            }).catch(() => null);

        const introPromise =
          mediaType === 'tv'
            ? fetchEpisodeIntro(tmdbIdStr, seasonNum, episodeNum).catch(() => null)
            : Promise.resolve(null);

        const thumbnailsPromise = fetchMediaSceneThumbnails(
          tmdbIdStr,
          mediaType,
          seasonNum,
          episodeNum
        ).catch(() => []);

        const [streamRes, introRes, thumbRes] = await Promise.allSettled([
          streamPromise,
          introPromise,
          thumbnailsPromise,
        ]);

        preheatItem.streamResult =
          streamRes.status === 'fulfilled' ? streamRes.value : null;
        preheatItem.introData =
          introRes.status === 'fulfilled' ? introRes.value : null;
        preheatItem.sceneThumbnails =
          thumbRes.status === 'fulfilled' && thumbRes.value ? thumbRes.value : [];
        preheatItem.timestamp = Date.now();
        delete preheatItem.inFlightPromise;
        return preheatItem;
      } catch (err) {
        console.warn('[StreamPreheater] preheat error:', err);
        delete preheatItem.inFlightPromise;
        return preheatItem;
      }
    })();

    preheatItem.inFlightPromise = inFlight;
    this.set(key, preheatItem);
    return inFlight;
  }
}

export const streamPreheater = new StreamPreheaterService();
