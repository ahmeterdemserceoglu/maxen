import { useEffect, useState, useCallback } from 'react';
import { TMDB_BASE_URL, TMDB_IMAGE_BASE_URL } from '@/config/tmdb';
import { useAuth } from '@/contexts/AuthContext';
import {
  getContinueWatching,
  getWatchLater,
  subscribeToContinueWatching,
  subscribeToWatchLater,
} from '@/services/profileMediaService';
import {
  computeUserTasteProfile,
  fetchSmartRecommendations,
} from '@/services/recommendation/smartTasteEngine';
import { extractCleanTmdbId } from '@/types/profileMedia';
import { COMPLETION_THRESHOLD } from '@/utils/playerReliability';
import { NormalizedMediaItem, normalizeTmdbItem } from '@/types/media';

export type { NormalizedMediaItem };
export { normalizeTmdbItem };

export interface HomeDataState {
  heroMedia: NormalizedMediaItem | null;
  continueWatching: any[];
  watchLater: any[];
  recommendedItems: NormalizedMediaItem[];
  popularMovies: NormalizedMediaItem[];
  popularTV: NormalizedMediaItem[];
  trendingMovies: NormalizedMediaItem[];
  trendingTV: NormalizedMediaItem[];
  topRatedMovies: NormalizedMediaItem[];
  topRatedTV: NormalizedMediaItem[];
  latestMovies: NormalizedMediaItem[];
  latestTV: NormalizedMediaItem[];
  actionMovies: NormalizedMediaItem[];
  comedyMovies: NormalizedMediaItem[];
  scifiMovies: NormalizedMediaItem[];
  actionTV: NormalizedMediaItem[];
  comedyTV: NormalizedMediaItem[];
  scifiTV: NormalizedMediaItem[];
}

export const homeCache = { data: null as any, heroPool: [] as NormalizedMediaItem[], timestamp: 0 };

export function useHomeData(activeTab: string, profileId: string) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HomeDataState>({
    heroMedia: null,
    continueWatching: [],
    watchLater: [],
    recommendedItems: [],
    popularMovies: [],
    popularTV: [],
    trendingMovies: [],
    trendingTV: [],
    topRatedMovies: [],
    topRatedTV: [],
    latestMovies: [],
    latestTV: [],
    actionMovies: [],
    comedyMovies: [],
    scifiMovies: [],
    actionTV: [],
    comedyTV: [],
    scifiTV: [],
  });

  const [heroPool, setHeroPool] = useState<NormalizedMediaItem[]>(homeCache.heroPool || []);

  // Hero pool her zaman trendingMovies veya trendingTV'den canlı tutulur
  useEffect(() => {
    const rawList =
      activeTab === 'movies' || activeTab === 'home'
        ? data.trendingMovies.length > 0
          ? data.trendingMovies
          : data.popularMovies
        : data.trendingTV.length > 0
        ? data.trendingTV
        : data.popularTV;
    if (rawList && rawList.length > 0) {
      const pool = rawList.slice(0, 8);
      setHeroPool(pool);
      homeCache.heroPool = pool;
    }
  }, [data.trendingMovies, data.trendingTV, data.popularMovies, data.popularTV, activeTab]);

  // Profil listelerini dinle (continue watching, watch later)
  useEffect(() => {
    if (!user || !profileId) {
      setData((prev) => ({ ...prev, continueWatching: [], watchLater: [] }));
      return;
    }

    const unsubCw = subscribeToContinueWatching(user.uid, profileId, (cw: any[]) => {
      const uniqueMap = new Map<string, any>();
      cw.sort((a: any, b: any) => (b.savedAt || 0) - (a.savedAt || 0)).forEach((rawItem: any) => {
        const isTv =
          rawItem.type === 'tv' ||
          rawItem.Type === 'Series' ||
          rawItem.Type === 'Tv' ||
          Boolean(rawItem.season_number || rawItem.episode_number || rawItem.SeasonNumber || rawItem.EpisodeNumber || rawItem.show_title);

        const cleanId = extractCleanTmdbId(rawItem);
        const item = {
          ...rawItem,
          id: cleanId || rawItem.id,
          tmdbId: cleanId,
          type: isTv ? 'tv' : 'movie',
        };

        const dedupeKey = isTv ? `tv_${cleanId}` : `movie_${cleanId}`;
        if (!uniqueMap.has(dedupeKey)) {
          uniqueMap.set(dedupeKey, item);
        }
      });
      const unfinished = Array.from(uniqueMap.values()).filter(
        (item: any) => Number(item.progress ?? 0) < COMPLETION_THRESHOLD
      );
      setData((prev) => ({ ...prev, continueWatching: unfinished }));
    });

    const unsubWl = subscribeToWatchLater(user.uid, profileId, (wl: any[]) => {
      setData((prev) => ({ ...prev, watchLater: wl }));
    });

    return () => {
      unsubCw();
      unsubWl();
    };
  }, [user, profileId]);

  const fetchData = useCallback(async () => {
    if (homeCache.timestamp > 0 && Date.now() - homeCache.timestamp < 300000) {
      const cached = homeCache.data;
      setData((prev) => ({
        ...prev,
        ...cached,
        watchLater: cached.watchLater || [],
        recommendedItems: cached.recommendedItems || [],
      }));
      if (homeCache.heroPool && homeCache.heroPool.length > 0) {
        setHeroPool(homeCache.heroPool);
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    let localContinueWatching: any[] = [];
    let localWatchLater: any[] = [];
    let recommended: NormalizedMediaItem[] = [];

    try {
      if (user) {
        try {
          const [cw, wl] = await Promise.all([
            getContinueWatching(user.uid, profileId),
            getWatchLater(user.uid, profileId),
          ]);

          const unfinished = cw.filter((item: any) => Number(item.progress ?? 0) < 0.995);
          const uniqueMap = new Map<string, any>();

          unfinished
            .sort((a: any, b: any) => (b.savedAt || 0) - (a.savedAt || 0))
            .forEach((rawItem: any) => {
              const isTv =
                rawItem.type === 'tv' ||
                rawItem.Type === 'Series' ||
                rawItem.Type === 'Tv' ||
                Boolean(rawItem.season_number || rawItem.episode_number || rawItem.SeasonNumber || rawItem.EpisodeNumber || rawItem.show_title);

              const cleanId = extractCleanTmdbId(rawItem);
              const item = {
                ...rawItem,
                id: cleanId || rawItem.id,
                tmdbId: cleanId,
                type: isTv ? 'tv' : 'movie',
              };

              const dedupeKey = isTv ? `tv_${cleanId}` : `movie_${cleanId}`;
              if (!uniqueMap.has(dedupeKey)) {
                uniqueMap.set(dedupeKey, item);
              }
            });

          localContinueWatching = Array.from(uniqueMap.values());
          localWatchLater = wl;
        } catch (e) {
          console.warn('Profile lists load error for recommendations:', e);
        }
      }

      // Akıllı Zevk Profili Vektörü ile Öneriler Oluştur
      try {
        if (user?.uid) {
          const tasteProfile = await computeUserTasteProfile(user.uid, profileId);
          recommended = await fetchSmartRecommendations(tasteProfile);
          setData((prev) => ({ ...prev, recommendedItems: recommended }));
        } else {
          setData((prev) => ({ ...prev, recommendedItems: [] }));
        }
      } catch (e) {
        console.warn('Smart taste recommendation build error:', e);
        setData((prev) => ({ ...prev, recommendedItems: [] }));
      }

      const [
        trendingMoviesRes,
        trendingTVRes,
        topRatedMoviesRes,
        topRatedTVRes,
        nowPlayingMoviesRes,
        onTheAirTVRes,
        actionMoviesRes,
        comedyMoviesRes,
        scifiMoviesRes,
        actionTVRes,
        comedyTVRes,
        scifiTVRes,
      ] = await Promise.all([
        fetch(`${TMDB_BASE_URL}/trending/movie/week?language=tr-TR`),
        fetch(`${TMDB_BASE_URL}/trending/tv/week?language=tr-TR`),
        fetch(`${TMDB_BASE_URL}/movie/top_rated?language=tr-TR`),
        fetch(`${TMDB_BASE_URL}/tv/top_rated?language=tr-TR`),
        fetch(`${TMDB_BASE_URL}/movie/now_playing?language=tr-TR`),
        fetch(`${TMDB_BASE_URL}/tv/on_the_air?language=tr-TR`),
        fetch(`${TMDB_BASE_URL}/discover/movie?with_genres=28&language=tr-TR`),
        fetch(`${TMDB_BASE_URL}/discover/movie?with_genres=35&language=tr-TR`),
        fetch(`${TMDB_BASE_URL}/discover/movie?with_genres=878&language=tr-TR`),
        fetch(`${TMDB_BASE_URL}/discover/tv?with_genres=10759&language=tr-TR`),
        fetch(`${TMDB_BASE_URL}/discover/tv?with_genres=35&language=tr-TR`),
        fetch(`${TMDB_BASE_URL}/discover/tv?with_genres=10765&language=tr-TR`),
      ]);

      const [
        trendingMoviesData,
        trendingTVData,
        topRatedMoviesData,
        topRatedTVData,
        nowPlayingMoviesData,
        onTheAirTVData,
        actionMoviesData,
        comedyMoviesData,
        scifiMoviesData,
        actionTVData,
        comedyTVData,
        scifiTVData,
      ] = await Promise.all([
        trendingMoviesRes.json(),
        trendingTVRes.json(),
        topRatedMoviesRes.json(),
        topRatedTVRes.json(),
        nowPlayingMoviesRes.json(),
        onTheAirTVRes.json(),
        actionMoviesRes.json(),
        comedyMoviesRes.json(),
        scifiMoviesRes.json(),
        actionTVRes.json(),
        comedyTVRes.json(),
        scifiTVRes.json(),
      ]);

      const tmdbTrendingMovies = (trendingMoviesData.results || []).map(normalizeTmdbItem);
      const tmdbTrendingTV = (trendingTVData.results || []).map(normalizeTmdbItem);
      const tmdbTopRatedMovies = (topRatedMoviesData.results || []).map(normalizeTmdbItem);
      const tmdbTopRatedTV = (topRatedTVData.results || []).map(normalizeTmdbItem);
      const tmdbNowPlayingMovies = (nowPlayingMoviesData.results || []).map(normalizeTmdbItem);
      const tmdbOnTheAirTV = (onTheAirTVData.results || []).map(normalizeTmdbItem);
      const tmdbActionMovies = (actionMoviesData.results || []).map(normalizeTmdbItem);
      const tmdbComedyMovies = (comedyMoviesData.results || []).map(normalizeTmdbItem);
      const tmdbScifiMovies = (scifiMoviesData.results || []).map(normalizeTmdbItem);
      const tmdbActionTV = (actionTVData.results || []).map(normalizeTmdbItem);
      const tmdbComedyTV = (comedyTVData.results || []).map(normalizeTmdbItem);
      const tmdbScifiTV = (scifiTVData.results || []).map(normalizeTmdbItem);

      let selectedHero: NormalizedMediaItem | null = null;
      const rawHeroes =
        activeTab === 'movies' || activeTab === 'home'
          ? (trendingMoviesData.results || trendingTVData.results || []).slice(0, 6)
          : (trendingTVData.results || trendingMoviesData.results || []).slice(0, 6);
      const normalizedPool = rawHeroes.map(normalizeTmdbItem);
      setHeroPool(normalizedPool);
      homeCache.heroPool = normalizedPool;
      if (normalizedPool.length > 0) {
        selectedHero = normalizedPool[0];
      }

      const nextData: HomeDataState = {
        heroMedia: selectedHero,
        continueWatching: localContinueWatching,
        watchLater: localWatchLater,
        recommendedItems: recommended,
        popularMovies: tmdbTrendingMovies,
        popularTV: tmdbTrendingTV,
        trendingMovies: tmdbTrendingMovies,
        trendingTV: tmdbTrendingTV,
        topRatedMovies: tmdbTopRatedMovies,
        topRatedTV: tmdbTopRatedTV,
        latestMovies: tmdbNowPlayingMovies,
        latestTV: tmdbOnTheAirTV,
        actionMovies: tmdbActionMovies,
        comedyMovies: tmdbComedyMovies,
        scifiMovies: tmdbScifiMovies,
        actionTV: tmdbActionTV,
        comedyTV: tmdbComedyTV,
        scifiTV: tmdbScifiTV,
      };

      setData(nextData);

      homeCache.data = {
        ...nextData,
        libraryMovies: [],
        libraryTV: [],
      };
      homeCache.timestamp = Date.now();
    } catch (e) {
      console.warn('Fetch data flow failed, fallback running:', e);
    } finally {
      setLoading(false);
    }
  }, [user, profileId, activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    loading,
    data,
    heroPool,
    fetchData,
  };
}
