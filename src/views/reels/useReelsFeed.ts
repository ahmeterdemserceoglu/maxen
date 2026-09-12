import { useEffect, useState, useRef } from 'react';
import { ViewToken, BackHandler, Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { toggleFavorite } from '@/services/profileMediaService';
import { useAuth } from '@/contexts/AuthContext';
import { TMDB_BASE_URL, TMDB_IMAGE_BASE_URL } from '@/config/tmdb';

export function extractYouTubeKey(urlOrKey: string): string | null {
  if (!urlOrKey) return null;
  const str = urlOrKey.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) {
    return str;
  }
  const match = str.match(/(?:shorts\/|youtu\.be\/|watch\?v=|embed\/|v\/)([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];
  return null;
}

export function extractIMDbId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const str = urlOrId.trim();
  if (/^vi\d+$/i.test(str)) {
    return str.toLowerCase();
  }
  const match = str.match(/video\/(vi\d+)/i);
  if (match) return match[1].toLowerCase();
  return null;
}

export interface ReelItem {
  id: number;
  tmdbId?: string;
  title: string;
  name?: string;
  type?: 'movie' | 'tv';
  media_type: 'movie' | 'tv';
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  youtubeKey?: string | null;
  imdbId?: string | null;
  isVertical?: boolean;
}

export interface UseReelsFeedProps {
  profileId?: string;
  initialIndex?: number;
  onActiveIndexChange?: (index: number) => void;
}

export function useReelsFeed({
  profileId,
  initialIndex = 0,
  onActiveIndexChange,
}: UseReelsFeedProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<ReelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(initialIndex || 0);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [failedVideoKeys, setFailedVideoKeys] = useState<Record<string, boolean>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isMountedRef = useRef(true);

  // Unmount cleanup: reset screen orientation and prevent memory/audio leak
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (!Platform.isTV) ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT).catch(() => {});
    };
  }, []);

  // YouTube videoları için manuel yatay döndürme (IMDb kendi hallediyor)
  useEffect(() => {
    if (Platform.isTV) return;
    const currentItem = items[activeIndex];
    const isYouTube = currentItem?.youtubeKey && !currentItem?.imdbId;

    if (isFullscreen && isYouTube) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    }
  }, [isFullscreen, activeIndex, items]);

  // YouTube videoları için donanımsal geri tuşu (Android)
  useEffect(() => {
    const backAction = () => {
      if (isFullscreen) {
        setIsFullscreen(false);
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isFullscreen]);

  const loadTrendingReels = async () => {
    try {
      setLoading(true);

      // 1. Önce Firebase Firestore 'shorts' koleksiyonundan özel girilmiş shorts linklerini çek
      try {
        const shortsRef = collection(db, 'shorts');
        const snap = await getDocs(shortsRef);

        if (!snap.empty && isMountedRef.current) {
          const fbItems: ReelItem[] = [];

          for (const docSnap of snap.docs) {
            const data = docSnap.data();
            const rawUrl =
              data.youtubeUrl ||
              data.tiktokUrl ||
              data.url ||
              data.youtubeKey ||
              data.shortsUrl ||
              data.videoUrl ||
              '';

            const youtubeKey = extractYouTubeKey(rawUrl);
            const imdbId = extractIMDbId(rawUrl);
            const tmdbId = data.tmdbId || data.id;
            const rawType = String(data.type || data.media_type || '').toLowerCase().trim();
            const type =
              rawType === 'tv' || rawType === 'dizi' || rawType === 'series' ? 'tv' : 'movie';

            if (youtubeKey || imdbId) {
              let tmdbData: any = null;
              if (tmdbId) {
                try {
                  const tmdbRes = await fetch(
                    `${TMDB_BASE_URL}/${type}/${tmdbId}?language=tr-TR`
                  );
                  if (tmdbRes.ok) {
                    tmdbData = await tmdbRes.json();
                  }
                } catch {}
              }

              const posterPath = tmdbData?.poster_path || data.poster_path || null;
              const backdropPath = tmdbData?.backdrop_path || data.backdrop_path || null;

              fbItems.push({
                id: Number(tmdbId) || Math.floor(Math.random() * 1000000),
                tmdbId: String(tmdbId),
                title:
                  tmdbData?.title ||
                  tmdbData?.name ||
                  data.title ||
                  'Özel Fragman',
                name: tmdbData?.name || data.name,
                type: type,
                media_type: type,
                overview: tmdbData?.overview || data.overview || '',
                poster_path: posterPath,
                backdrop_path: backdropPath,
                posterUrl: posterPath ? `${TMDB_IMAGE_BASE_URL}/w500${posterPath}` : null,
                backdropUrl: backdropPath
                  ? `${TMDB_IMAGE_BASE_URL}/w1280${backdropPath}`
                  : null,
                vote_average: tmdbData?.vote_average || data.vote_average || 0,
                release_date:
                  tmdbData?.release_date ||
                  tmdbData?.first_air_date ||
                  data.release_date ||
                  '',
                youtubeKey: youtubeKey,
                imdbId: imdbId,
                isVertical: data.isVertical !== undefined ? data.isVertical : true,
              });
            }
          }

          if (fbItems.length > 0 && isMountedRef.current) {
            setItems(fbItems);
            setLoading(false);
            return;
          }
        }
      } catch (fbErr) {
        console.warn('[ReelsFeed] Firebase shorts okuma:', fbErr);
      }

      // 2. Eğer Firebase'de henüz shorts yoksa TMDB fallback yap
      const res = await fetch(`${TMDB_BASE_URL}/trending/all/day?language=tr-TR`);

      if (res.ok && isMountedRef.current) {
        const data = await res.json();
        const rawList = (data.results || []).slice(0, 15);

        const enhancedList: ReelItem[] = await Promise.all(
          rawList.map(async (media: any) => {
            let key = null;
            const type = media.media_type === 'tv' ? 'tv' : 'movie';

            try {
              const trRes = await fetch(
                `${TMDB_BASE_URL}/${type}/${media.id}/videos?language=tr-TR`
              );

              if (trRes.ok) {
                const json = await trRes.json();
                const yt = (json.results || []).filter((v: any) => v.site === 'YouTube');
                const best = yt.find((v: any) => v.type === 'Trailer') || yt[0];
                if (best?.key) {
                  key = best.key;
                }
              }

              if (!key) {
                const enRes = await fetch(`${TMDB_BASE_URL}/${type}/${media.id}/videos`);

                if (enRes.ok) {
                  const json = await enRes.json();
                  const yt = (json.results || []).filter((v: any) => v.site === 'YouTube');
                  const best =
                    yt.find((v: any) => v.type === 'Trailer') ||
                    yt.find((v: any) => v.type === 'Teaser') ||
                    yt[0];

                  if (best?.key) {
                    key = best.key;
                  }
                }
              }
            } catch {}

            return {
              ...media,
              tmdbId: media.id?.toString(),
              type: type,
              media_type: type,
              posterUrl: media.poster_path
                ? `${TMDB_IMAGE_BASE_URL}/w500${media.poster_path}`
                : null,
              backdropUrl: media.backdrop_path
                ? `${TMDB_IMAGE_BASE_URL}/w1280${media.backdrop_path}`
                : null,
              youtubeKey: key,
            };
          })
        );

        if (isMountedRef.current) {
          setItems(enhancedList.filter((m) => !!m.youtubeKey || !!m.backdrop_path));
        }
      }
    } catch (err) {
      console.warn('Reels fetch error:', err);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadTrendingReels();
  }, [user]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (
        viewableItems.length > 0 &&
        viewableItems[0].index !== null &&
        viewableItems[0].index !== undefined
      ) {
        const newIdx = viewableItems[0].index;
        setActiveIndex((prev) => {
          if (prev !== newIdx) {
            onActiveIndexChange?.(newIdx);
            return newIdx;
          }
          return prev;
        });
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const handleToggleFav = async (media: ReelItem) => {
    if (!profileId || !user) return;

    const isFav = favorites.includes(media.id);

    const mediaObj = {
      tmdbId: media.id,
      title: media.title || media.name || '',
      type: media.media_type || 'movie',
      posterPath: media.poster_path,
      voteAverage: media.vote_average,
    };

    await toggleFavorite(user.uid, profileId, mediaObj);

    if (isFav) {
      setFavorites((prev) => prev.filter((id) => id !== media.id));
    } else {
      setFavorites((prev) => [...prev, media.id]);
    }
  };

  const handleFailVideo = (keyOrId: string) => {
    setFailedVideoKeys((prev) => ({
      ...prev,
      [keyOrId]: true,
    }));
  };

  return {
    items,
    loading,
    activeIndex,
    setActiveIndex,
    favorites,
    isMuted,
    setIsMuted,
    failedVideoKeys,
    isFullscreen,
    setIsFullscreen,
    onViewableItemsChanged,
    viewabilityConfig,
    handleToggleFav,
    handleFailVideo,
    loadTrendingReels,
  };
}
