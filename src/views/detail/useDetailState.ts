import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Platform,
  Animated,
  BackHandler,
  findNodeHandle,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMediaRating,
  setMediaRating,
  isFavorite,
  toggleFavorite,
  isWatchLater,
  toggleWatchLater,
  getContinueWatching,
} from '@/services/profileMediaService';
import {
  TMDB_BASE_URL,
  TMDB_IMAGE_BASE_URL,
} from '@/config/tmdb';
import { streamPreheater } from '@/features/player/services';
import { getStyles } from '@/styles/detailView.styles';

const isTV = Platform.isTV;

export interface CastMember {
  name: string;
  tmdbId: number;
  profileUrl: string | null;
}

export interface RecommendationItem {
  id: number;
  tmdbId: string;
  title: string;
  type: 'movie' | 'tv';
  posterUrl: string | null;
  backdropUrl: string | null;
  rating: string;
  [key: string]: any;
}

export interface CollectionData {
  name: string;
  parts: RecommendationItem[];
}

export interface UseDetailStateProps {
  media: any;
  profileId: string;
  onClose: () => void;
  onSelectActor: (actor: any) => void;
  onPlayMedia: (media: any) => void;
  onSelectMedia?: (media: any) => void;
}

export function useDetailState({
  media,
  profileId,
  onClose,
  onSelectActor,
  onPlayMedia,
  onSelectMedia,
}: UseDetailStateProps) {
  const { width, height } = useWindowDimensions();
  const isTablet = width > 600;

  const styles = useMemo(
    () => getStyles(width, height, isTablet),
    [width, height, isTablet]
  );

  const theme = useTheme();
  const { user } = useAuth();

  const isMovie = media.type === 'movie' || media.media_type === 'movie';
  const tmdbId = media.tmdbId || (media.id ? media.id.toString() : null);

  /*
   * ============================================================
   * TV FOCUS REFS
   * ============================================================
   */
  const closeButtonRef = useRef<any>(null);
  const playButtonRef = useRef<any>(null);
  const trailerButtonRef = useRef<any>(null);
  const favoriteButtonRef = useRef<any>(null);
  const watchLaterButtonRef = useRef<any>(null);
  const ratingButtonRef = useRef<any>(null);

  const seasonRefs = useRef<Record<number, any>>({});
  const episodeRefs = useRef<Record<number, any>>({});
  const actorRefs = useRef<Record<number, any>>({});
  const firstEpisodeRef = useRef<any>(null);

  /*
   * ============================================================
   * STATE
   * ============================================================
   */
  const [loading, setLoading] = useState(true);
  const [detailsBackdropUrl, setDetailsBackdropUrl] = useState<string | null>(null);
  const [genres, setGenres] = useState('');
  const [cast, setCast] = useState<CastMember[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [activeSeason, setActiveSeason] = useState<any | null>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [movieRuntime, setMovieRuntime] = useState('');
  const [localProgresses, setLocalProgresses] = useState<any[]>([]);
  const [allEpisodes, setAllEpisodes] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [collectionData, setCollectionData] = useState<CollectionData | null>(null);

  const [userRating, setUserRating] = useState<number | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [isWatchLaterState, setIsWatchLaterState] = useState(false);

  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [isTrailerModalOpen, setIsTrailerModalOpen] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);

  /*
   * ============================================================
   * ANIMATION
   * ============================================================
   */
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(50)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  /*
   * ============================================================
   * RATING / FAVORITE / WATCH LATER
   * ============================================================
   */
  useEffect(() => {
    if (!user || !profileId || !media) return;

    getMediaRating(user.uid, profileId, media)
      .then((val) => {
        if (typeof val === 'number') {
          setUserRating(val);
        }
      })
      .catch(() => {});

    isFavorite(user.uid, profileId, media)
      .then(setIsFav)
      .catch(() => {});

    isWatchLater(user.uid, profileId, media)
      .then(setIsWatchLaterState)
      .catch(() => {});
  }, [user, profileId, media]);

  const handleRate = async (rating: number | null) => {
    if (!user || !profileId || !media) return;

    setUserRating(rating);

    try {
      await setMediaRating(user.uid, profileId, media, rating);
    } catch {}
  };

  const handleToggleFavorite = async () => {
    if (!user || !profileId || !media) return;

    try {
      const newValue = await toggleFavorite(user.uid, profileId, media);
      setIsFav(newValue);
    } catch {}
  };

  const handleToggleWatchLater = async () => {
    if (!user || !profileId || !media) return;

    try {
      const newValue = await toggleWatchLater(user.uid, profileId, media);
      setIsWatchLaterState(newValue);
    } catch {}
  };

  /*
   * ============================================================
   * BACKDROP ANIMATION
   * ============================================================
   */
  const backdropTranslateY = scrollY.interpolate({
    inputRange: [0, height * 0.5],
    outputRange: [0, -height * 0.15],
    extrapolate: 'clamp',
  });

  const backdropScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.2, 1],
    extrapolateLeft: 'extend',
    extrapolateRight: 'clamp',
  });

  const heroOpacity = scrollY.interpolate({
    inputRange: [0, height * 0.4],
    outputRange: [1, 0.4],
    extrapolate: 'clamp',
  });

  /*
   * ============================================================
   * LOAD DATA
   * ============================================================
   */
  const loadAllEpisodesData = async (seasonsList: any[]) => {
    setLoadingEpisodes(true);

    try {
      let allEps: any[] = [];

      for (const season of seasonsList) {
        const seasonNum = season.season_number ?? season.IndexNumber;

        if (!tmdbId || !seasonNum) continue;

        try {
          const res = await fetch(
            `${TMDB_BASE_URL}/tv/${tmdbId}/season/${seasonNum}?language=tr-TR`
          );

          if (!res.ok) {
            console.warn(`[DetailView] TMDB Sezon ${seasonNum} alınamadı, durum:`, res.status);
            continue;
          }

          const data = await res.json();

          const seasonEpisodes = (data.episodes || []).map((ep: any) => ({
            ...ep,
            id: `tmdb-${ep.id}`,
            tmdbId: tmdbId,
            show_id: tmdbId,
            Name: ep.name,
            Overview: ep.overview,
            IndexNumber: ep.episode_number,
            isJellyfin: false,
            ParentIndexNumber: seasonNum,
          }));

          allEps = [...allEps, ...seasonEpisodes];
        } catch (error) {
          console.warn(`TMDB Season ${seasonNum} error`, error);
        }
      }

      setAllEpisodes(allEps);

      if (seasonsList.length > 0) {
        const firstSeason =
          seasonsList[0].season_number ?? seasonsList[0].IndexNumber;

        setEpisodes(
          allEps.filter(
            (ep) =>
              (ep.ParentIndexNumber ?? ep.season_number) === firstSeason
          )
        );
      }
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const loadDetails = useCallback(async () => {
    setLoading(true);

    try {
      let currentCw: any[] = [];
      if (user) {
        const cw = await getContinueWatching(user.uid, profileId);
        currentCw = cw || [];
        setLocalProgresses(currentCw);
      }

      if (!tmdbId) {
        setLoading(false);
        return;
      }

      const url = isMovie
        ? `${TMDB_BASE_URL}/movie/${tmdbId}?language=tr-TR&append_to_response=credits,videos`
        : `${TMDB_BASE_URL}/tv/${tmdbId}?language=tr-TR&append_to_response=credits,videos`;

      const res = await fetch(url);

      if (!res.ok) {
        console.warn('[DetailView] TMDB detayı alınamadı, durum:', res.status);
        setLoading(false);
        return;
      }

      const details = await res.json();

      if (details.backdrop_path) {
        setDetailsBackdropUrl(`${TMDB_IMAGE_BASE_URL}/w1280${details.backdrop_path}`);
      } else if (details.poster_path) {
        setDetailsBackdropUrl(`${TMDB_IMAGE_BASE_URL}/w780${details.poster_path}`);
      }

      if (details.genres?.length) {
        setGenres(
          details.genres.map((g: any) => g.name).join(', ')
        );
      }

      if (details.credits?.cast?.length) {
        const actors = details.credits.cast.slice(0, 8).map((c: any) => ({
          name: c.name,
          tmdbId: c.id,
          profileUrl: c.profile_path
            ? `${TMDB_IMAGE_BASE_URL}/w185${c.profile_path}`
            : null,
        }));

        setCast(actors);
      }

      // Fragman / Video tespiti
      let foundTrailer: string | null = null;
      const videos = details.videos?.results || [];
      const trTrailer = videos.find(
        (v: any) =>
          v.site === 'YouTube' &&
          (v.type === 'Trailer' || v.type === 'Teaser' || v.type === 'Clip')
      );

      if (trTrailer) {
        foundTrailer = trTrailer.key;
      } else {
        // İngilizce fragman dene
        try {
          const enVideoRes = await fetch(
            `${TMDB_BASE_URL}/${isMovie ? 'movie' : 'tv'}/${tmdbId}/videos?language=en-US`
          );
          if (enVideoRes.ok) {
            const enData = await enVideoRes.json();
            const enTrailer = (enData.results || []).find(
              (v: any) =>
                v.site === 'YouTube' &&
                (v.type === 'Trailer' || v.type === 'Teaser')
            );
            if (enTrailer) {
              foundTrailer = enTrailer.key;
            }
          }
        } catch {}
      }

      if (!foundTrailer && (media.youtubeKey || media.trailerUrl)) {
        foundTrailer = media.youtubeKey || media.trailerUrl;
      }

      setTrailerKey(foundTrailer);

      if (isMovie) {
        if (details.runtime) {
          setMovieRuntime(`${details.runtime} dk`);
        }
        streamPreheater.preheat(tmdbId, 'movie', 1, 1).catch(() => {});
      } else {
        const seasonsList = (details.seasons || [])
          .filter((s: any) => s.season_number > 0)
          .sort((a: any, b: any) => a.season_number - b.season_number);

        const finalSeasons =
          seasonsList.length > 0 ? seasonsList : details.seasons || [];

        setSeasons(finalSeasons);

        if (finalSeasons.length > 0) {
          setActiveSeason(finalSeasons[0]);
          await loadAllEpisodesData(finalSeasons);
        }

        const cwList = currentCw.length > 0 ? currentCw : localProgresses;
        const cwItem = cwList.find(
          (p) => String(p.tmdbId) === String(tmdbId) || String(p.id) === String(media.id) || String(p.id) === String(tmdbId)
        );
        const seasonNum = cwItem?.season_number || (finalSeasons[0]?.season_number ?? finalSeasons[0]?.IndexNumber ?? 1);
        const episodeNum = cwItem?.episode_number || 1;
        streamPreheater.preheat(tmdbId, 'tv', seasonNum, episodeNum).catch(() => {});
      }

      // 1. Benzer İçerikler (Tavsiyeler)
      try {
        const recRes = await fetch(
          `${TMDB_BASE_URL}/${isMovie ? 'movie' : 'tv'}/${tmdbId}/recommendations?language=tr-TR`
        );
        if (recRes.ok) {
          const recJson = await recRes.json();
          const recs = (recJson.results || []).slice(0, 14).map((item: any) => ({
            ...item,
            id: item.id,
            tmdbId: item.id?.toString(),
            title: item.title || item.name,
            type: isMovie ? 'movie' : 'tv',
            posterUrl: item.poster_path
              ? `${TMDB_IMAGE_BASE_URL}/w300${item.poster_path}`
              : null,
            backdropUrl: item.backdrop_path
              ? `${TMDB_IMAGE_BASE_URL}/w780${item.backdrop_path}`
              : null,
            rating: item.vote_average ? item.vote_average.toFixed(1) : '—',
          }));
          setRecommendations(recs);
        }
      } catch (e) {}

      // 2. Film Serisi / Koleksiyon (Boxset)
      if (isMovie && details.belongs_to_collection?.id) {
        try {
          const colRes = await fetch(
            `${TMDB_BASE_URL}/collection/${details.belongs_to_collection.id}?language=tr-TR`
          );
          if (colRes.ok) {
            const colJson = await colRes.json();
            const parts = (colJson.parts || [])
              .sort((a: any, b: any) =>
                (a.release_date || '').localeCompare(b.release_date || '')
              )
              .map((item: any) => ({
                ...item,
                id: item.id,
                tmdbId: item.id?.toString(),
                title: item.title,
                type: 'movie',
                posterUrl: item.poster_path
                  ? `${TMDB_IMAGE_BASE_URL}/w300${item.poster_path}`
                  : null,
                backdropUrl: item.backdrop_path
                  ? `${TMDB_IMAGE_BASE_URL}/w780${item.backdrop_path}`
                  : null,
                rating: item.vote_average ? item.vote_average.toFixed(1) : '—',
              }));
            setCollectionData({
              name:
                colJson.name ||
                details.belongs_to_collection.name ||
                'Film Serisi',
              parts,
            });
          }
        } catch (e) {}
      } else {
        setCollectionData(null);
      }
    } catch (error) {
      console.error('Detaylar yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  }, [user, profileId, tmdbId, isMovie, media]);

  /*
   * ============================================================
   * OPEN / CLOSE ANIMATIONS
   * ============================================================
   */
  useEffect(() => {
    loadDetails();

    fadeAnim.setValue(0);
    contentAnim.setValue(50);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(contentAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    if (isTV) {
      setTimeout(() => {
        if (closeButtonRef.current) {
          closeButtonRef.current.focus?.();
        }
      }, 450);
    }
  }, [media, profileId]);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(contentAnim, {
        toValue: 60,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  }, [fadeAnim, contentAnim, onClose]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isTrailerModalOpen) {
        setIsTrailerModalOpen(false);
        return true;
      }
      if (isRatingModalOpen) {
        setIsRatingModalOpen(false);
        return true;
      }
      handleClose();
      return true;
    });

    return () => sub.remove();
  }, [handleClose, isTrailerModalOpen, isRatingModalOpen]);

  // Web Ortamı: ESC tuşuna basıldığında detay modalını kapat
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isTrailerModalOpen) {
          setIsTrailerModalOpen(false);
          return;
        }
        if (isRatingModalOpen) {
          setIsRatingModalOpen(false);
          return;
        }
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, isTrailerModalOpen, isRatingModalOpen]);

  /*
   * ============================================================
   * TV FOCUS HELPERS
   * ============================================================
   */
  const focusPlay = () => {
    setTimeout(() => {
      playButtonRef.current?.focus?.();
    }, 30);
  };

  const focusFirstEpisode = () => {
    setTimeout(() => {
      firstEpisodeRef.current?.focus?.();
    }, 30);
  };

  const handleSeasonChange = (season: any) => {
    const seasonNum = Number(season.season_number ?? season.IndexNumber ?? 1);
    setActiveSeason(season);

    // Eski sezonun node referanslarını kesinlikle taşımıyoruz.
    episodeRefs.current = {};
    firstEpisodeRef.current = null;

    const newEpisodes = allEpisodes
      .filter((ep) => Number(ep.ParentIndexNumber ?? ep.season_number ?? 1) === seasonNum)
      .sort((a, b) => Number(a.episode_number ?? a.IndexNumber ?? 0) - Number(b.episode_number ?? b.IndexNumber ?? 0));

    setEpisodes(newEpisodes);

    const firstEpNum = Number(newEpisodes[0]?.episode_number ?? newEpisodes[0]?.IndexNumber ?? 1);
    if (tmdbId && newEpisodes.length > 0) {
      streamPreheater.preheat(tmdbId, 'tv', seasonNum, firstEpNum).catch(() => {});
    }

    // Season tab değişiminden sonra focus'u yeni bölüm listesinin uygun bölümüne bırak.
    if (isTV) {
      const focusAfterRender = () => {
        const unfinishedIndex = newEpisodes.findIndex((ep) => {
          const epId = String(ep.Id || ep.id);
          const progress = localProgresses.find((p) => String(p.Id || p.id) === epId)?.progress || 0;
          return progress > 0 && progress < 0.95;
        });
        const targetIndex = unfinishedIndex >= 0 ? unfinishedIndex : 0;
        const target = episodeRefs.current[targetIndex] || firstEpisodeRef.current;
        target?.focus?.();
      };
      requestAnimationFrame(() => requestAnimationFrame(focusAfterRender));
    }
  };

  /*
   * ============================================================
   * PLAY
   * ============================================================
   */
  const buildEpisodePlayPayload = (episode: any) => {
    const episodeId = episode.Id || episode.id;

    const currentIndex = episodes.findIndex(
      (ep) => (ep.Id || ep.id) === episodeId
    );

    const seasonNumber =
      episode.ParentIndexNumber ||
      episode.season_number ||
      activeSeason?.season_number ||
      1;
    const episodeNumber =
      episode.IndexNumber || episode.episode_number || 1;

    const preheated = tmdbId
      ? streamPreheater.get(
          streamPreheater.generateKey(tmdbId, 'tv', seasonNumber, episodeNumber)
        )
      : null;

    return {
      ...media,
      ...episode,
      id: episodeId,
      tmdbId: String(tmdbId || media.tmdbId || media.id),
      show_id: String(tmdbId || media.tmdbId || media.id),
      show_title: media.title || media.show_title || media.name,
      title: episode.Name || episode.name,
      type: 'tv' as const,
      isJellyfin: false,
      season_number: Number(seasonNumber),
      episode_number: Number(episodeNumber),
      seasonNumber: Number(seasonNumber),
      episodeNumber: Number(episodeNumber),
      playlist: episodes,
      playlistIndex: currentIndex,
      preheatedData: preheated,
    };
  };

  const handlePlayEpisode = (episode: any) => {
    onPlayMedia(buildEpisodePlayPayload(episode));
  };

  const buildMoviePlayPayload = () => {
    const cleanId = String(tmdbId || media.tmdbId || media.id || media.Id).replace(/^tmdb-(movie-)?/, '');
    const preheated = cleanId
      ? streamPreheater.get(
          streamPreheater.generateKey(cleanId, 'movie', 1, 1)
        )
      : null;

    return {
      ...media,
      id: cleanId,
      tmdbId: cleanId,
      type: 'movie' as const,
      isJellyfin: false,
      title: media.title || media.name,
      preheatedData: preheated,
    };
  };

  const handlePlayMovie = () => {
    onPlayMedia(buildMoviePlayPayload());
  };

  /*
   * ============================================================
   * SOURCES & META
   * ============================================================
   */
  const rawBackdrop =
    detailsBackdropUrl ||
    media?.backdropUrl ||
    (media?.backdrop_path
      ? `${TMDB_IMAGE_BASE_URL}/w1280${media.backdrop_path}`
      : null) ||
    media?.posterUrl ||
    (media?.poster_path
      ? `${TMDB_IMAGE_BASE_URL}/w780${media.poster_path}`
      : null);

  const backdropSource = rawBackdrop
    ? { uri: rawBackdrop }
    : {
        uri: `https://placehold.co/1280x720/141414/ffffff?text=${encodeURIComponent(
          media?.title || media?.name || 'Maxen'
        )}`,
      };

  const movieProgressObj = localProgresses.find(
    (p) => p.id === (media.id || media.Id)
  );
  const movieProgress = movieProgressObj?.progress || 0;

  const genreList =
    genres
      ?.split(',')
      .map((g) => g.trim())
      .filter(Boolean)
      .slice(0, 3) || [];

  return {
    width,
    height,
    isTablet,
    isTV,
    styles,
    theme,
    user,
    isMovie,
    tmdbId,
    loading,
    detailsBackdropUrl,
    genres,
    genreList,
    cast,
    seasons,
    activeSeason,
    episodes,
    loadingEpisodes,
    movieRuntime,
    localProgresses,
    movieProgress,
    allEpisodes,
    recommendations,
    collectionData,
    userRating,
    isFav,
    isWatchLaterState,
    trailerKey,
    isTrailerModalOpen,
    setIsTrailerModalOpen,
    isRatingModalOpen,
    setIsRatingModalOpen,
    fadeAnim,
    contentAnim,
    scrollY,
    backdropTranslateY,
    backdropScale,
    heroOpacity,
    backdropSource,
    closeButtonRef,
    playButtonRef,
    trailerButtonRef,
    favoriteButtonRef,
    watchLaterButtonRef,
    ratingButtonRef,
    seasonRefs,
    episodeRefs,
    actorRefs,
    firstEpisodeRef,
    handleRate,
    handleToggleFavorite,
    handleToggleWatchLater,
    handleClose,
    handleSeasonChange,
    handlePlayEpisode,
    handlePlayMovie,
    buildEpisodePlayPayload,
    buildMoviePlayPayload,
    focusPlay,
    focusFirstEpisode,
    onSelectActor,
    onPlayMedia,
    onSelectMedia,
  };
}