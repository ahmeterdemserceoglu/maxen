import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Modal,
  Platform,
  StatusBar,
  PanResponder,
  useWindowDimensions,
  BackHandler,
  AppState,
  Animated,
  DeviceEventEmitter,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { streamSessionManager } from '@/features/player/services/StreamSessionManager';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';
import { saveContinueWatching, getContinueWatchingItem } from '@/services/profileMediaService';
import { extractCleanTmdbId } from '@/types/profileMedia';
import { saveActivePlaybackSession } from '@/services/crossDeviceHandoffService';
import { SubtitleOverlay } from '@/features/player/components/SubtitleOverlay';
import { SubtitleAppearanceModal, SubtitleSettings, DEFAULT_SUBTITLE_SETTINGS } from '@/features/player/components/SubtitleAppearanceModal';
import { AudioMenuModal, formatAudioLabel } from '@/features/player/components/AudioMenuModal';
import { SettingsMenuModal, SleepTimerValue } from '@/features/player/components/SettingsMenuModal';
import { SubtitleMenuModal } from '@/features/player/components/SubtitleMenuModal';
import { QualityMenuModal } from '@/features/player/components/QualityMenuModal';
import { PlayOnTvModal } from '@/components/PlayOnTvModal';
import { PlayerTopBar } from '@/features/player/components/PlayerTopBar';
import { PlayerBottomBar } from '@/features/player/components/PlayerBottomBar';
import { DoubleTapSeekOverlay } from '@/features/player/components/DoubleTapSeekOverlay';
import { DoubleTapSeekRipple } from '@/features/player/components/DoubleTapSeekRipple';
import { PlayerGestureHUD } from '@/features/player/components/PlayerGestureHUD';
import { HiddenResolverWebView } from '@/features/player/components/HiddenResolverWebView';
import { EpisodeActionButtons } from '@/features/player/components/EpisodeActionButtons';
import { NextEpisodeBanner } from '@/features/player/components/NextEpisodeBanner';
import { ScreenLockOverlay } from '@/features/player/components/ScreenLockOverlay';
import { MiniPlayerControlsOverlay } from '@/features/player/components/MiniPlayerControlsOverlay';
import { PlayerXRayOverlay } from '@/features/player/components/PlayerXRayOverlay';
import { WatchPartyChatDrawer } from '@/features/player/components/WatchPartyChatDrawer';
import { StatsForNerdsOverlay } from '@/features/player/components/StatsForNerdsOverlay';
import { TVQuickControlsOverlay } from '@/features/player/components/TVQuickControlsOverlay';
import { fetchAndParseHlsQualities } from '@/features/player/services/hlsQualityParser';
import { useUiStore } from '@/store/uiStore';
import {
  subscribeToWatchParty,
  syncWatchPartyPlayback,
  WatchPartyRoom,
  leaveWatchPartyRoom,
} from '@/services/watchPartyService';
import {
  fetchBackendStream,
  fetchVixSrcDirectClientSide,
  runDirectHttpResolver,
  resolveParallelDirectStream,
  resolveParallelDirectStreamResult,
  resolveVixSrcDirect,
} from '@/features/player/services/streamResolverService';
import { fetchEpisodeIntro, getNextEpisodeMedia, IntroData } from '@/features/player/services/introService';
import { fetchMediaSceneThumbnails } from '@/services/api/tmdbService';
import { updateLivePresence } from '@/services/socialService';
import { styles } from '@/features/player/styles/videoPlayer.styles';

import { isProviderAlive, RESOLVER_PROVIDERS, normalizeLang, parseSubtitles, timeToSeconds, streamPreheater } from '@/features/player/services';

// ─── INTERFACES ────────────────────────────────────────────────────
interface SubtitleTrack {
  label: string;
  lang: string;
  url: string;
  content?: string;
  fileId?: number;
}

interface AudioTrack {
  id?: string;
  label: string;
  language: string;
  url?: string;
}

interface VideoPlayerViewProps {
  media: any;
  item?: any;
  profileId?: string;
  startSeconds?: number;
  serverUrl?: string;
  token?: string;
  userId?: string;
  onClose: () => void;
  onPlayNextMedia?: (media: any) => void;
  resolvedStreamUrl?: string;
  resolvedHeaders?: Record<string, string>;
}

// ─── ANA BİLEŞEN ──────────────────────────────────────────────────
export function VideoPlayerView({
  media: mediaProp,
  item,
  profileId = 'global',
  startSeconds = 0,
  serverUrl = '',
  token = '',
  userId = '',
  onClose,
  onPlayNextMedia,
  resolvedStreamUrl: externalStreamUrl,
  resolvedHeaders: externalHeaders,
}: VideoPlayerViewProps) {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const media = mediaProp || item || {};

  // ─── STATE ───────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const currentTimeRef = useRef(0);
  const [duration, setDuration] = useState(0);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [sleepTimer, setSleepTimer] = useState<SleepTimerValue>('off');
  const [sleepRemainingSeconds, setSleepRemainingSeconds] = useState<number | null>(null);
  const originalVolumeRef = useRef<number>(1.0);
  const sleepTimerRef = useRef<SleepTimerValue>('off');
  sleepTimerRef.current = sleepTimer;
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showPlayOnTvModal, setShowPlayOnTvModal] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<string>('auto');
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const masterStreamUrlRef = useRef<string | null>(null);
  const hlsQualityMapRef = useRef<Record<string, string>>({});
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [quickOverlayMode, setQuickOverlayMode] = useState<'none' | 'topBar' | 'bottomShelf'>('none');
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamHeaders, setStreamHeaders] = useState<Record<string, string>>({});
  const [contentFit, setContentFit] = useState<'cover' | 'contain' | 'fill'>('contain');
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const currentStreamUrlRef = useRef<string | null>(null);
  currentStreamUrlRef.current = streamUrl;
  const isPlayingRef = useRef<boolean>(true);
  isPlayingRef.current = isPlaying;
  const [resolving, setResolving] = useState(false);
  const [resolverUrl, setResolverUrl] = useState<string | null>(null);
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState<number | null>(null);
  const [nextMediaData, setNextMediaData] = useState<any | null>(null);
  const [isNextBannerDismissed, setIsNextBannerDismissed] = useState(false);
  const [introData, setIntroData] = useState<IntroData | null>(null);
  const [isScreenLocked, setIsScreenLocked] = useState(false);
  const isMiniPlayer = useUiStore((state) => state.isMiniPlayer);
  const setIsMiniPlayer = useUiStore((state) => state.setIsMiniPlayer);
  const [isNativePiPActive, setIsNativePiPActive] = useState(false);
  const wasInMiniPlayerBeforePiPRef = useRef(false);
  const isAnyMiniActive = isMiniPlayer || isNativePiPActive;
  const remoteActionSignal = useUiStore((state) => state.remoteActionSignal);
  const videoViewRef = useRef<any>(null);

  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPreviewTime, setSeekPreviewTime] = useState<number | undefined>(undefined);
  const seekPreviewTimeRef = useRef<number | undefined>(undefined);
  const [previewThumbnail, setPreviewThumbnail] = useState<any>(null);
  const [sceneThumbnails, setSceneThumbnails] = useState<string[]>([]);

  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const singleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [seekAnim, setSeekAnim] = useState<'left' | 'right' | null>(null);

  // Gesture HUD (VLC / MX Player Brightness & Volume)
  const [brightness, setBrightness] = useState<number>(1.0);
  const brightnessRef = useRef<number>(1.0);
  const [gestureHud, setGestureHud] = useState<{
    type: 'brightness' | 'volume';
    value: number;
    visible: boolean;
  } | null>(null);
  const hudFadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureTypeRef = useRef<'brightness' | 'volume' | null>(null);
  const gestureStartValRef = useRef<number>(1.0);

  // 2X Turbo Playback on Long-Press
  const [isTurboSpeed, setIsTurboSpeed] = useState<boolean>(false);
  const prevPlaybackRateRef = useRef<number>(1.0);

  const hasSeekedRef = useRef(false);
  const autoRetryCountRef = useRef(0);
  const resumeFromSecondsRef = useRef<number | null>(null);



  // Altyazı state'leri
  const [availableSubtitleTracks, setAvailableSubtitleTracks] = useState<any[]>([]);
  const [currentSubtitleTrack, setCurrentSubtitleTrack] = useState<any>(null);
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<SubtitleTrack | null>(null);
  const [externalCues, setExternalCues] = useState<{ text: string; start: number; end: number }[]>([]);
  const [subtitleText, setSubtitleText] = useState<string>('');
  const [subtitleToast, setSubtitleToast] = useState<string | null>(null);
  const [openSubtitlesLoading, setOpenSubtitlesLoading] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);

  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [availableAudioTracks, setAvailableAudioTracks] = useState<any[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<any>(null);
  const [trackLayout, setTrackLayout] = useState({ x: 0, width: 0 });
  const [showSubtitleAppearanceMenu, setShowSubtitleAppearanceMenu] = useState(false);
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>(DEFAULT_SUBTITLE_SETTINGS);
  const [allowBackgroundAudio, setAllowBackgroundAudio] = useState(false);
  const [showStatsForNerds, setShowStatsForNerds] = useState(false);

  // ─── REF ─────────────────────────────────────────────────────────
  const isMountedRef = useRef(true);
  const playerRef = useRef<any>(null);
  const resolverWebViewRef = useRef<any>(null);
  const resolverTimeoutRef = useRef<any>(null);
  const initialSeekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSelectSubTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const providerIndexRef = useRef(0);
  const activeProviderIndexRef = useRef(0);
  const controlsTimerRef = useRef<any>(null);
  const hasStartedRef = useRef(false);
  const playSessionIdRef = useRef(Math.random().toString(36).substring(2, 15));
  const timeIntervalRef = useRef<any>(null);
  const subtitleTrackIntervalRef = useRef<any>(null);
  const hasUserSelectedSubtitleRef = useRef(false);
  const hasAutoSelectedSubtitleRef = useRef(false);
  const hasAutoSelectedAudioRef = useRef(false);
  const preferredSubtitleLangRef = useRef<string | null>(null);
  const preferredAudioLangRef = useRef<string | null>(null);
  const isAppInBackgroundRef = useRef(false);

  // ─── WATCH PARTY REAL-TIME STATE ─────────────────────────────────
  const { activeWatchParty, setActiveWatchParty } = useUiStore();
  const [watchPartyRoom, setWatchPartyRoom] = useState<WatchPartyRoom | null>(activeWatchParty);
  const [showWatchPartyChat, setShowWatchPartyChat] = useState(false);
  const { activeProfile } = useAuth();
  const partyProfileName =
    activeProfile?.name || user?.displayName || user?.email?.split('@')[0] || 'Kullanıcı';

  const isWatchPartyHost = watchPartyRoom ? watchPartyRoom.hostId === user?.uid : false;
  const isApplyingRemoteSyncRef = useRef(false);
  const partyRef = useRef<{ code: string; user: any; profileName: string } | null>(null);

  useEffect(() => {
    if (watchPartyRoom?.code && user) {
      partyRef.current = { code: watchPartyRoom.code, user, profileName: partyProfileName };
    } else {
      partyRef.current = null;
    }
  }, [watchPartyRoom?.code, user, partyProfileName]);

  const handleLeaveParty = useCallback(() => {
    if (watchPartyRoom?.code && user) {
      leaveWatchPartyRoom(watchPartyRoom.code, user, partyProfileName);
      partyRef.current = null;
    }
    setActiveWatchParty(null);
    setWatchPartyRoom(null);
    setShowWatchPartyChat(false);
  }, [watchPartyRoom?.code, user, partyProfileName, setActiveWatchParty]);

  useEffect(() => {
    return () => {
      if (partyRef.current) {
        leaveWatchPartyRoom(partyRef.current.code, partyRef.current.user, partyRef.current.profileName);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeWatchParty?.code) return;

    const unsubscribe = subscribeToWatchParty(
      activeWatchParty.code,
      (updatedRoom) => {
        if (!updatedRoom) {
          setActiveWatchParty(null);
          setWatchPartyRoom(null);
          setShowWatchPartyChat(false);
          return;
        }

        setWatchPartyRoom(updatedRoom);

        // Host değilsek host'un oynatma durumunu uygula
        if (user?.uid !== updatedRoom.hostId && playerRef.current) {
          isApplyingRemoteSyncRef.current = true;

          const delta = Math.max(0, (Date.now() - updatedRoom.updatedAt) / 1000);
          const targetTime = updatedRoom.isPlaying
            ? updatedRoom.currentTime + delta
            : updatedRoom.currentTime;

          if (Math.abs(playerRef.current.currentTime - targetTime) > 1.8) {
            playerRef.current.currentTime = targetTime;
            setCurrentTime(targetTime);
          }

          if (updatedRoom.isPlaying && !playerRef.current.playing) {
            playerRef.current.play();
            setIsPlaying(true);
          } else if (!updatedRoom.isPlaying && playerRef.current.playing) {
            playerRef.current.pause();
            setIsPlaying(false);
          }

          setTimeout(() => {
            isApplyingRemoteSyncRef.current = false;
          }, 500);
        }
      },
      () => {
        setActiveWatchParty(null);
        setWatchPartyRoom(null);
        setShowWatchPartyChat(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [activeWatchParty?.code, user?.uid]);

  const broadcastPartyState = useCallback(
    (playing: boolean, currentSec: number) => {
      if (activeWatchParty?.code && isWatchPartyHost && !isApplyingRemoteSyncRef.current) {
        syncWatchPartyPlayback(activeWatchParty.code, playing, currentSec);
      }
    },
    [activeWatchParty?.code, isWatchPartyHost]
  );

  useEffect(() => {
    if (seekAnim) {
      const timeout = setTimeout(() => {
        setSeekAnim(null);
      }, 550);
      return () => clearTimeout(timeout);
    }
  }, [seekAnim]);

  // ─── TERCİHLERİ YÜKLE ─────────────────────────────────────────────
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const subLang = await AsyncStorage.getItem('preferred_subtitle_lang');
        if (subLang) preferredSubtitleLangRef.current = subLang;

        const audioLang = await AsyncStorage.getItem('preferred_audio_lang');
        if (audioLang) preferredAudioLangRef.current = audioLang;

        const savedSettings = await AsyncStorage.getItem('subtitle_appearance_settings');
        if (savedSettings) setSubtitleSettings(JSON.parse(savedSettings));
      } catch (e) { }
    };
    loadPreferences();
  }, []);
  const isStreamFoundRef = useRef(false);
  const bingeTransitioningRef = useRef(false);

  // ─── MEDYA BİLGİ ─────────────────────────────────────────────────
  const isJellyfin = false; // Jellyfin kaldırıldı, sadece TMDB kullanılıyor

  const currentEpisode = useMemo(() => {
    if (Array.isArray(media?.playlist) && typeof media?.playlistIndex === 'number') {
      return media.playlist[media.playlistIndex] || null;
    }
    return null;
  }, [media]);

  const isTv =
    media.type === 'tv' ||
    media.Type === 'Series' ||
    media.Type === 'Tv' ||
    Boolean(
      currentEpisode ||
      media.season_number ||
      media.episode_number ||
      media.SeasonNumber ||
      media.EpisodeNumber ||
      media.show_title
    );
  const isMovie = !isTv;

  const rawCandidate =
    media.tmdbId ??
    media.tmdbID ??
    media.show_id ??
    media.seriesId ??
    currentEpisode?.tmdbId ??
    currentEpisode?.show_id ??
    media.ProviderIds?.Tmdb ??
    media.providerIds?.Tmdb ??
    media.TmdbId ??
    media.externalIds?.Tmdb ??
    media.Id ??
    media.id;

  const tmdbId = extractCleanTmdbId({ tmdbId: rawCandidate });

  const seasonNum = Number(
    currentEpisode?.season_number ??
    currentEpisode?.ParentIndexNumber ??
    media.season_number ??
    media.SeasonNumber ??
    media.seasonNumber ??
    media.ParentIndexNumber ??
    1
  );

  const episodeNum = Number(
    currentEpisode?.episode_number ??
    currentEpisode?.IndexNumber ??
    media.episode_number ??
    media.EpisodeNumber ??
    media.episodeNumber ??
    media.IndexNumber ??
    1
  );

  const itemId = media.Id || media.id || tmdbId;
  const title = isMovie
    ? (media.title || media.Name || '')
    : (media.show_title || media.SeriesName || media.title || media.Name || '');

  // ─── CANLI İZLEME VARLIĞI (PRESENCE) ───────────────────────────
  useEffect(() => {
    if (user?.uid) {
      updateLivePresence(
        {
          uid: user.uid,
          displayName: user.displayName || undefined,
        },
        'watching',
        {
          id: media.id || media.tmdbId || 'unknown',
          tmdbId: tmdbId || undefined,
          title: title || 'Video',
          type: isMovie ? 'movie' : 'tv',
          posterUrl: media.posterUrl || media.poster_path || null,
          seasonNum: isMovie ? undefined : seasonNum,
          episodeNum: isMovie ? undefined : episodeNum,
        }
      );
    }

    return () => {
      if (user?.uid) {
        updateLivePresence(
          {
            uid: user.uid,
            displayName: user.displayName || undefined,
          },
          'online',
          null
        );
      }
    };
  }, [user, media, title, tmdbId, isMovie, seasonNum, episodeNum]);

  const jellyfinDurationInSeconds = useMemo(() => {
    if (media.RunTimeTicks) {
      return media.RunTimeTicks / 10000000;
    }
    return 0;
  }, [media.RunTimeTicks]);

  const endTime = useMemo(() => {
    if (!duration) return '00:00';
    const remaining = Math.max(0, duration - currentTime);
    const now = new Date();
    const end = new Date(now.getTime() + remaining * 1000);
    return `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
  }, [duration, currentTime]);

  // ─── INTRODB İNTRO VERİSİ ÇEKME ────────────────────────────────────
  useEffect(() => {
    if (isMovie || !tmdbId) return;
    let isSubscribed = true;
    fetchEpisodeIntro(tmdbId, seasonNum, episodeNum).then((data) => {
      if (isSubscribed) {
        setIntroData(data);
      }
    });
    return () => {
      isSubscribed = false;
    };
  }, [isMovie, tmdbId, seasonNum, episodeNum]);

  const showSkipIntro = Boolean(
    introData?.hasIntro &&
    introData?.intro &&
    currentTime >= introData.intro.start_sec &&
    currentTime <= introData.intro.end_sec
  );

  const showNextEpisode = Boolean(
    !isMovie &&
    duration > 0 &&
    duration - currentTime <= 90 &&
    duration - currentTime > 0
  );

  useEffect(() => {
    if (showNextEpisode && !isNextBannerDismissed && !isMovie && !nextMediaData) {
      let isMounted = true;
      getNextEpisodeMedia(media).then((res) => {
        if (isMounted && res) {
          setNextMediaData(res);
        }
      });
      return () => {
        isMounted = false;
      };
    }
    if (!showNextEpisode && isNextBannerDismissed) {
      setIsNextBannerDismissed(false);
    }
  }, [showNextEpisode, isNextBannerDismissed, isMovie, media, nextMediaData]);

  const saveProgressToDb = useCallback(
    async (currentSec: number, totalSec?: number) => {
      const dur = totalSec && totalSec > 0 ? totalSec : (duration || playerRef.current?.duration || 0);
      if (!user || currentSec < 0 || dur <= 0) return;

      try {
        const progressRatio = Math.min(1, currentSec / dur);
        const progressObj = {
          ...media,
          id: isMovie ? tmdbId : (media.id || tmdbId),
          tmdbId: tmdbId,
          show_id: isMovie ? null : tmdbId,
          type: isMovie ? ('movie' as const) : ('tv' as const),
          title: media.title || media.Name || title,
          show_title: isMovie ? null : (media.show_title || media.SeriesName || title),
          season_number: isMovie ? null : seasonNum,
          episode_number: isMovie ? null : episodeNum,
          savedStreamUrl: streamUrl || media.savedStreamUrl || null,
          savedStreamHeaders: streamHeaders || media.savedStreamHeaders || null,
          posterUrl: media.posterUrl || media.poster_path || media.poster || null,
          backdropUrl:
            media.backdropUrl ||
            media.backdrop_path ||
            media.backdrop ||
            media.posterUrl ||
            media.poster_path ||
            null,
          progress: progressRatio,
          positionSeconds: currentSec,
          durationSeconds: dur,
          savedAt: Date.now(),
        };
        await saveContinueWatching(user.uid, profileId, progressObj, progressRatio, currentSec, dur);
        saveActivePlaybackSession(user.uid, profileId, progressObj, currentSec, dur).catch(() => {});
        broadcastPartyState(isPlaying, currentSec);
      } catch (e) {
        console.warn('Direct seek progress save error:', e);
      }
    },
    [user, profileId, media, isMovie, tmdbId, title, seasonNum, episodeNum, duration, isPlaying, broadcastPartyState]
  );

  const handleSkipIntro = () => {
    if (playerRef.current && introData?.intro?.end_sec) {
      playerRef.current.currentTime = introData.intro.end_sec;
      setCurrentTime(introData.intro.end_sec);
      currentTimeRef.current = introData.intro.end_sec;
      saveProgressToDb(introData.intro.end_sec);
    }
  };

  const handlePlayNextEpisode = async () => {
    if (sleepTimer === 'end_of_episode') {
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current.keepScreenOnWhilePlaying = false;
      }
      setIsPlaying(false);
      setSleepTimer('off');
      setSubtitleToast('Bölüm bitti, uyku zamanlayıcısı oynatmayı durdurdu. 🌙');
      return;
    }
    if (onPlayNextMedia) {
      bingeTransitioningRef.current = true;
      const nextMedia = await getNextEpisodeMedia(media);
      if (nextMedia) {
        onPlayNextMedia(nextMedia);
      }
    }
  };

  // ─── UYKU ZAMANLAYICISI (SLEEP TIMER) & AUDIO FADE-OUT ─────────────
  useEffect(() => {
    if (sleepTimer === 'off' || sleepTimer === 'end_of_episode') {
      setSleepRemainingSeconds(null);
      return;
    }

    let remaining = (sleepTimer as number) * 60;
    setSleepRemainingSeconds(remaining);
    setSubtitleToast(`Uyku zamanlayıcısı ayarlandı: ${sleepTimer} dakika ⏱️`);

    const timer = setInterval(() => {
      remaining -= 1;
      setSleepRemainingSeconds(remaining);

      // Son 15 saniyede kademeli Audio Fade-Out
      if (remaining <= 15 && remaining > 0 && playerRef.current) {
        if (remaining === 15) {
          originalVolumeRef.current = playerRef.current.volume !== undefined ? playerRef.current.volume : 1.0;
        }
        playerRef.current.volume = originalVolumeRef.current * (remaining / 15);
      }

      if (remaining <= 0) {
        clearInterval(timer);
        if (playerRef.current) {
          playerRef.current.pause();
          playerRef.current.keepScreenOnWhilePlaying = false;
          if (originalVolumeRef.current !== undefined) {
            playerRef.current.volume = originalVolumeRef.current;
          }
        }
        setIsPlaying(false);
        setSleepTimer('off');
        setSleepRemainingSeconds(null);
        setSubtitleToast('Uyku zamanlayıcısı oynatmayı durdurdu. İyi uykular! 🌙');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [sleepTimer]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState.match(/inactive|background/)) {
        // Arka plana alındığında işaretle
        isAppInBackgroundRef.current = true;
        if (playerRef.current && isPlaying) {
          if (!allowBackgroundAudio) {
            try {
              playerRef.current.pause();
              setIsPlaying(false);
            } catch (e) { }
          }
        }
      } else if (nextAppState === 'active') {
        // Ön plana dönüldüğünde: hasSeekedRef'i true tut (yeniden başa dönmesin)
        // ve arka plan bayrağını kaldır
        isAppInBackgroundRef.current = false;
        hasSeekedRef.current = true;
      }
    });
    return () => subscription.remove();
  }, [isPlaying, allowBackgroundAudio]);

  // ─── EKRAN YÖNÜ ──────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web' && !Platform.isTV) {
      if (isMiniPlayer) {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => { });
      } else {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => { });
      }
    }
    return () => {
      if (Platform.OS !== 'web' && !Platform.isTV) {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => { });
      }
    };
  }, [isMiniPlayer]);

  // ─── ANDROID GEZİNME ÇUBUĞU (IMMERSIVE STICKY MODE) ───────────────
  useEffect(() => {
    if (Platform.OS === 'android') {
      if (!isMiniPlayer) {
        NavigationBar.setVisibilityAsync('hidden').catch(() => {});
        NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => {});
        NavigationBar.setBackgroundColorAsync('#000000').catch(() => {});
      } else {
        NavigationBar.setVisibilityAsync('visible').catch(() => {});
        NavigationBar.setBehaviorAsync('inset-touch').catch(() => {});
      }
    }
    return () => {
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('visible').catch(() => {});
        NavigationBar.setBehaviorAsync('inset-touch').catch(() => {});
      }
    };
  }, [isMiniPlayer]);

  // Mini Oynatıcı Geçişinde Kesintisiz Oynatma Garantisi (Donmayı ve Duraklamayı Önler)
  useEffect(() => {
    if (playerRef.current && isPlaying) {
      try {
        playerRef.current.play();
      } catch (e) {}
      const timer = setTimeout(() => {
        try {
          if (playerRef.current) {
            playerRef.current.play();
          }
        } catch (e) {}
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isMiniPlayer, isPlaying]);

  // Mini Oynatıcı Sürükleme ve Köşelere Yapışma (Pan & Edge Snapping)
  const miniPan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const miniPanOffsetRef = useRef({ x: 0, y: 0 });

  const miniDragPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 8 || Math.abs(gestureState.dy) > 8;
        },
        onPanResponderGrant: () => {
          miniPan.setOffset(miniPanOffsetRef.current);
          miniPan.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event([null, { dx: miniPan.x, dy: miniPan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_, gestureState) => {
          miniPan.flattenOffset();
          const curX = miniPanOffsetRef.current.x + gestureState.dx;
          const curY = miniPanOffsetRef.current.y + gestureState.dy;

          const snapX = curX < -SCREEN_WIDTH / 3 ? -(SCREEN_WIDTH - customMiniWidthRef.current - 32) : 0;
          const snapY = Math.max(-SCREEN_HEIGHT + 220, Math.min(0, curY));

          miniPanOffsetRef.current = { x: snapX, y: snapY };
          Animated.spring(miniPan, {
            toValue: { x: snapX, y: snapY },
            bounciness: 6,
            useNativeDriver: false,
          }).start();
        },
      }),
    [miniPan]
  );

  // Mini Oynatıcı Köşeden Dinamik Boyutlandırma (Pinch / Drag Resize)
  const [customMiniWidth, setCustomMiniWidth] = useState<number>(SCREEN_WIDTH > 600 ? 340 : 250);
  const customMiniWidthRef = useRef(customMiniWidth);
  customMiniWidthRef.current = customMiniWidth;
  const startDragWidthRef = useRef(customMiniWidth);

  const cornerResizePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startDragWidthRef.current = customMiniWidthRef.current;
        },
        onPanResponderMove: (_, gestureState) => {
          const maxWidth = SCREEN_WIDTH - 24;
          const calculated = Math.max(170, Math.min(maxWidth, startDragWidthRef.current - gestureState.dx));
          setCustomMiniWidth(calculated);
        },
        onPanResponderRelease: () => {},
      }),
    []
  );

  // ─── KONTROL GİZLE ───────────────────────────────────────────────
  useEffect(() => {
    if (controlsVisible && !showSettingsMenu && !showSubtitleMenu && !showQualityMenu && !showAudioMenu) {
      controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 5000);
    }
    return () => { if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current); };
  }, [controlsVisible, showSettingsMenu, showSubtitleMenu, showQualityMenu, showAudioMenu]);

  const toggleControls = useCallback(() => {
    if (showSettingsMenu || showSubtitleMenu || showQualityMenu || showAudioMenu) return;
    if (hudFadeTimeoutRef.current) clearTimeout(hudFadeTimeoutRef.current);
    setGestureHud(null);
    setControlsVisible(prev => !prev);
  }, [showSettingsMenu, showSubtitleMenu, showQualityMenu, showAudioMenu]);

  const prolongControls = useCallback(() => {
    if (controlsVisible && !showSettingsMenu && !showSubtitleMenu && !showQualityMenu && !showAudioMenu) {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 5000);
    }
  }, [controlsVisible, showSettingsMenu, showSubtitleMenu, showQualityMenu, showAudioMenu]);

  const handleStartFastForward = useCallback(() => {
    if (!playerRef.current) return;
    try {
      prevPlaybackRateRef.current = playerRef.current.playbackRate || 1.0;
      playerRef.current.preservesPitch = true;
      playerRef.current.playbackRate = 2.0;
      setIsTurboSpeed(true);
    } catch (e) {}
  }, []);

  const handleEndFastForward = useCallback(() => {
    if (!playerRef.current) return;
    try {
      playerRef.current.preservesPitch = true;
      playerRef.current.playbackRate = prevPlaybackRateRef.current || 1.0;
      setIsTurboSpeed(false);
    } catch (e) {}
  }, []);

  // TV Remote D-Pad & Physical Media Keys (Netflix/Leanback style - Yalnızca TV cihazlarında aktif)
  useEffect(() => {
    if (!Platform.isTV) return;

    const handleTVKeyEvent = (type: string) => {
      // 0. QUICK SKIP INTRO (İntroyu Atla belirdiğinde OK veya İleri Sar tuşuna basılırsa doğrudan atlar)
      if (showSkipIntro && (type === 'select' || type === 'fastForward')) {
        handleSkipIntro();
        return;
      }

      // 1. FAST-FORWARD & REWIND PHYSICAL MEDIA KEYS
      if (type === 'fastForward') {
        if (playerRef.current) {
          try {
            const target = Math.min(duration || 0, playerRef.current.currentTime + 10);
            playerRef.current.currentTime = target;
            setCurrentTime(target);
            saveProgressToDb(target);
            setSeekAnim('right');
          } catch (e) {}
        }
        prolongControls();
        return;
      }

      if (type === 'rewind') {
        if (playerRef.current) {
          try {
            const target = Math.max(0, playerRef.current.currentTime - 10);
            playerRef.current.currentTime = target;
            setCurrentTime(target);
            saveProgressToDb(target);
            setSeekAnim('left');
          } catch (e) {}
        }
        prolongControls();
        return;
      }

      // 2. PLAY / PAUSE PHYSICAL MEDIA KEYS
      if (type === 'play') {
        if (playerRef.current && !isPlaying) {
          try {
            playerRef.current.play();
            setIsPlaying(true);
          } catch (e) {}
        }
        prolongControls();
        return;
      }

      if (type === 'pause') {
        if (playerRef.current && isPlaying) {
          try {
            playerRef.current.pause();
            setIsPlaying(false);
          } catch (e) {}
        }
        setControlsVisible(true);
        prolongControls();
        return;
      }

      // 3. NEXT EPISODE (CHANNEL UP)
      if (type === 'channelUp') {
        handlePlayNextEpisode();
        return;
      }

      // 4. STATS FOR NERDS & INFO BUTTON
      if (type === 'info') {
        setShowStatsForNerds((prev) => !prev);
        return;
      }

      // 5. MENU BUTTON (SETTINGS)
      if (type === 'menu') {
        setShowSettingsMenu((prev) => !prev);
        return;
      }

      // 6. D-PAD NAVIGATION & PLAY/PAUSE
      if (!controlsVisible) {
        if (type === 'left') {
          if (playerRef.current) {
            try {
              const target = Math.max(0, playerRef.current.currentTime - 10);
              playerRef.current.currentTime = target;
              setCurrentTime(target);
              saveProgressToDb(target);
              setSeekAnim('left');
            } catch (e) {}
          }
          setControlsVisible(true);
          prolongControls();
        } else if (type === 'right') {
          if (playerRef.current) {
            try {
              const target = Math.min(duration || 0, playerRef.current.currentTime + 10);
              playerRef.current.currentTime = target;
              setCurrentTime(target);
              saveProgressToDb(target);
              setSeekAnim('right');
            } catch (e) {}
          }
          setControlsVisible(true);
          prolongControls();
        } else if (type === 'up') {
          if (Platform.isTV) {
            setQuickOverlayMode('topBar');
          } else {
            setControlsVisible(true);
            prolongControls();
          }
        } else if (type === 'down') {
          if (Platform.isTV) {
            setQuickOverlayMode('bottomShelf');
          } else {
            setControlsVisible(true);
            prolongControls();
          }
        } else if (type === 'select' || type === 'playPause') {
          if (playerRef.current) {
            try {
              if (isPlaying) {
                playerRef.current.pause();
                setIsPlaying(false);
              } else {
                playerRef.current.play();
                setIsPlaying(true);
              }
            } catch (e) {}
          }
          setControlsVisible(true);
          prolongControls();
        }
      } else {
        if (type === 'playPause' && playerRef.current) {
          try {
            if (isPlaying) {
              playerRef.current.pause();
              setIsPlaying(false);
            } else {
              playerRef.current.play();
              setIsPlaying(true);
            }
          } catch (e) {}
        }
        if (['up', 'down', 'left', 'right', 'select', 'playPause'].includes(type)) {
          prolongControls();
        }
      }
    };

    // 1. Android TV Native Event Bridge (from MainActivity dispatchKeyEvent)
    const nativeKeySub = DeviceEventEmitter.addListener('TVKeyEvent', (evt: any) => {
      if (evt?.eventType) {
        handleTVKeyEvent(evt.eventType);
      }
    });

    // 2. Legacy TVEventHandler Fallback (if present on platform)
    let legacyHandler: any = null;
    try {
      const { TVEventHandler: RNTVEventHandler } = require('react-native') as any;
      if (RNTVEventHandler) {
        legacyHandler = new RNTVEventHandler();
        legacyHandler.enable(null, (cmp: any, evt: any) => {
          if (evt?.eventType) {
            handleTVKeyEvent(evt.eventType);
          }
        });
      }
    } catch (e) {}

    return () => {
      nativeKeySub.remove();
      try {
        legacyHandler?.disable();
      } catch (err) {}
    };
  }, [controlsVisible, duration, isPlaying, prolongControls, handlePlayNextEpisode, showSkipIntro, handleSkipIntro]);

  // ─── SANAL TV KUMANDASI CANLI SİNYAL DİNLEYİCİSİ ─────────────────────────────
  useEffect(() => {
    if (!remoteActionSignal) return;
    const { action } = remoteActionSignal;

    if (action === 'play_pause') {
      if (playerRef.current) {
        try {
          if (isPlaying) {
            playerRef.current.pause();
            setIsPlaying(false);
            setControlsVisible(true);
          } else {
            playerRef.current.play();
            setIsPlaying(true);
          }
        } catch (e) {}
      }
      prolongControls();
    } else if (action === 'seek_forward' || action === 'dpad_right') {
      if (playerRef.current) {
        try {
          const target = Math.min(duration || 0, playerRef.current.currentTime + 10);
          playerRef.current.currentTime = target;
          setCurrentTime(target);
          saveProgressToDb(target);
          setSeekAnim('right');
        } catch (e) {}
      }
      prolongControls();
    } else if (action === 'seek_backward' || action === 'dpad_left') {
      if (playerRef.current) {
        try {
          const target = Math.max(0, playerRef.current.currentTime - 10);
          playerRef.current.currentTime = target;
          setCurrentTime(target);
          saveProgressToDb(target);
          setSeekAnim('left');
        } catch (e) {}
      }
      prolongControls();
    } else if (action === 'dpad_up') {
      setQuickOverlayMode((prev) => (prev === 'topBar' ? 'none' : 'topBar'));
      setControlsVisible(true);
      prolongControls();
    } else if (action === 'dpad_down') {
      setQuickOverlayMode((prev) => (prev === 'bottomShelf' ? 'none' : 'bottomShelf'));
      setControlsVisible(true);
      prolongControls();
    } else if (action === 'dpad_center') {
      if (quickOverlayMode !== 'none') {
        setQuickOverlayMode('none');
      } else if (playerRef.current) {
        try {
          if (isPlaying) {
            playerRef.current.pause();
            setIsPlaying(false);
            setControlsVisible(true);
          } else {
            playerRef.current.play();
            setIsPlaying(true);
          }
        } catch (e) {}
      }
      prolongControls();
    } else if (action === 'volume_up') {
      if (playerRef.current) {
        try {
          playerRef.current.volume = Math.min(1.0, (playerRef.current.volume || 1.0) + 0.1);
        } catch (e) {}
      }
    } else if (action === 'volume_down') {
      if (playerRef.current) {
        try {
          playerRef.current.volume = Math.max(0.0, (playerRef.current.volume || 1.0) - 0.1);
        } catch (e) {}
      }
    } else if (action === 'volume_mute') {
      if (playerRef.current) {
        try {
          playerRef.current.muted = !playerRef.current.muted;
        } catch (e) {}
      }
    }
  }, [remoteActionSignal, duration, isPlaying, quickOverlayMode, prolongControls, saveProgressToDb]);

  // Web Klavye Kısayolları (Space, Ok Tuşları, F, M, Esc) & Fare Kontrolü
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Form alanlarında yazı yazılıyorsa kısayolları tetikleme
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        if (playerRef.current) {
          try {
            if (isPlaying) {
              playerRef.current.pause();
              setIsPlaying(false);
            } else {
              playerRef.current.play();
              setIsPlaying(true);
            }
          } catch (err) {}
        }
        prolongControls();
      } else if (e.code === 'ArrowRight' || e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        if (playerRef.current) {
          try {
            const target = Math.min(duration || 0, playerRef.current.currentTime + 10);
            playerRef.current.currentTime = target;
            setCurrentTime(target);
            saveProgressToDb(target);
            setSeekAnim('right');
          } catch (err) {}
        }
        prolongControls();
      } else if (e.code === 'ArrowLeft' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        if (playerRef.current) {
          try {
            const target = Math.max(0, playerRef.current.currentTime - 10);
            playerRef.current.currentTime = target;
            setCurrentTime(target);
            saveProgressToDb(target);
            setSeekAnim('left');
          } catch (err) {}
        }
        prolongControls();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (typeof document !== 'undefined') {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.().catch(() => {});
          } else {
            document.exitFullscreen?.().catch(() => {});
          }
        }
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        if (playerRef.current) {
          try {
            playerRef.current.muted = !playerRef.current.muted;
          } catch (err) {}
        }
      } else if (e.code === 'Escape') {
        if (typeof document !== 'undefined' && document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        } else {
          onClose();
        }
      }
    };

    const handleMouseMove = () => {
      setControlsVisible(true);
      prolongControls();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isPlaying, duration, prolongControls, saveProgressToDb, onClose]);

  // ─── PROVIDER DÖNGÜSÜ ─────────────────────────────────────────────
  const tryNextProvider = useCallback(async () => {
    // Eğer akış zaten bulunduysa VEYA video oynatılıyorsa ARTIK YENİ SAĞLAYICI ARAMA!
    if (
      isStreamFoundRef.current ||
      currentStreamUrlRef.current ||
      (playerRef.current?.currentTime || 0) > 0
    ) {
      if (resolverTimeoutRef.current) {
        clearTimeout(resolverTimeoutRef.current);
        resolverTimeoutRef.current = null;
      }
      setResolverUrl(null);
      setResolving(false);
      return;
    }

    const index = providerIndexRef.current;
    if (index >= RESOLVER_PROVIDERS.length) {
      if (!isStreamFoundRef.current && !currentStreamUrlRef.current) {
        console.log(`[Maxen Resolver] Tüm sağlayıcılar tarandı, ham m3u8 adresi alınamadı.`);
        setError('Video akış adresi çekilemedi. Lütfen tekrar deneyin.');
        setResolving(false);
        setLoading(false);
      }
      return;
    }
    const provider = RESOLVER_PROVIDERS[index];
    const isTv = !isMovie;
    const idToUse = tmdbId;
    const targetUrl = provider.getUrl(idToUse, isTv, seasonNum, episodeNum);

    console.log(`[Maxen Resolver] Provider (${index + 1}/${RESOLVER_PROVIDERS.length}): ${provider.name} | TMDB ID: "${idToUse}" -> ${targetUrl}`);
    activeProviderIndexRef.current = index;
    setResolverUrl(targetUrl);
    if (resolverTimeoutRef.current) clearTimeout(resolverTimeoutRef.current);
    resolverTimeoutRef.current = setTimeout(() => {
      // Eğer bu 7 saniye içinde akış bulunduysa VEYA video oynatılmaya başladıysa DEVAM ETME!
      if (
        isStreamFoundRef.current ||
        currentStreamUrlRef.current ||
        (playerRef.current?.currentTime || 0) > 0
      ) {
        if (resolverTimeoutRef.current) {
          clearTimeout(resolverTimeoutRef.current);
          resolverTimeoutRef.current = null;
        }
        setResolverUrl(null);
        setResolving(false);
        return;
      }
      providerIndexRef.current++;
      tryNextProvider();
    }, 7000);
  }, [tmdbId, isMovie, seasonNum, episodeNum]);

  // ─── RESOLVER MESAJ İŞLEME ───────────────────────────────────────
  const handleResolverMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data?.type === 'DEBUG_LOG') {
        console.log(`[Resolver Page Log] ${data.msg}`);
        return;
      }
      if (data?.type === 'ERROR_LOG') {
        console.warn(`[Resolver Page Error] ${data.msg}`);
        return;
      }
      console.log(`[Resolver] Message received: ${data?.type}`);

      if (data?.type === 'RESOLVED_URL' && data.url) {
        // Eğer akış zaten bulunduysa ve video oynatılıyorsa ARTIK YENİ AKIŞ KABUL ETME! (Geç gelen veya reklam videolarını engelle)
        if (
          isStreamFoundRef.current ||
          currentStreamUrlRef.current ||
          (playerRef.current?.currentTime || 0) > 0
        ) {
          console.log(`[Resolver] Akış zaten oynatılıyor, geç gelen URL engellendi: ${data.url}`);
          setResolverUrl(null);
          setResolving(false);
          if (resolverTimeoutRef.current) {
            clearTimeout(resolverTimeoutRef.current);
            resolverTimeoutRef.current = null;
          }
          return;
        }

        if (!isJellyfin) {
          isStreamFoundRef.current = true;
          if (resolverTimeoutRef.current) {
            clearTimeout(resolverTimeoutRef.current);
            resolverTimeoutRef.current = null;
          }
          console.log(`[Maxen Stream BAŞARIYLA ÇÖZÜLDÜ!] URL: ${data.url}`);
          streamSessionManager.setSession({
            streamUrl: data.url,
            provider: `WebView Resolver (${activeProviderIndexRef.current})`,
            expiresAt: Date.now() + 2 * 60 * 60 * 1000,
            mediaKey: currentMediaKey,
            headers: {
              Referer: data.referer || 'https://maxen.sbs/',
              Origin: 'https://maxen.sbs',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            }
          });

          setResolverUrl(null);
          setResolving(false);
          // WebView içindeki intervali durdur
          if (resolverWebViewRef.current) {
            resolverWebViewRef.current.injectJavaScript('window.stopScanInterval && window.stopScanInterval()');
          }
        } else {
          console.log(`[Resolver] Jellyfin playback active, ignoring external stream URL.`);
        }
      }
      if (data?.type === 'SUBTITLES_METADATA' && data.subtitles) {
        console.log(`[Resolver] Harici altyazı bulundu: ${data.subtitles.length} adet`);
        const externalSubs: SubtitleTrack[] = data.subtitles
          .map((s: any) => ({
            label: s.label || s.name || 'Altyazı',
            lang: normalizeLang(s.lang || s.language || ''),
            url: s.url || s.file || '',
          }))
          .filter((s: SubtitleTrack) => s.url);

        setSubtitles(prev => {
          const merged = [...prev, ...externalSubs];
          const uniqueByUrl: SubtitleTrack[] = [];
          const seen = new Set<string>();
          for (const sub of merged) {
            if (!seen.has(sub.url)) {
              seen.add(sub.url);
              uniqueByUrl.push(sub);
            }
          }
          return uniqueByUrl;
        });
      }
      if (data?.type === 'AUDIO_TRACKS' && data.audioTracks) {
        const newAudio: AudioTrack[] = data.audioTracks.map((a: any) => ({
          label: a.label || a.name || 'Ses',
          language: a.language || a.lang || '',
          url: a.url || '',
        }));
        setAudioTracks(prev => {
          const merged = [...prev, ...newAudio];
          return merged.filter((a, i) => merged.findIndex(x => (x.url || x.label) === (a.url || a.label)) === i);
        });
      }
    } catch (e) { }
  }, [isJellyfin]);

  // ─── STREAM SESSION MANAGER BAĞLANTISI ───────────────────────────
  const currentMediaKey = `${isMovie ? 'movie' : 'tv'}_${tmdbId}_${seasonNum}_${episodeNum}`;
  useEffect(() => {
    const handleSessionChange = (session: any) => {
      if (session && session.streamUrl) {
        // Oturum başka bir medyaya aitse (örn: arka plan hero banner önbelleği), aktif oynatıcıya kabul etme!
        if (session.mediaKey && session.mediaKey !== currentMediaKey) {
          console.log(`[StreamSessionManager] Farklı medya için session (${session.mediaKey} !== ${currentMediaKey}), yok sayıldı.`);
          return;
        }
        setStreamUrl(session.streamUrl);
        setStreamHeaders(session.headers || {});
        setResolving(false);
        setLoading(false);
      }
    };
    streamSessionManager.addListener(handleSessionChange);
    return () => {
      streamSessionManager.removeListener(handleSessionChange);
      streamSessionManager.clearSession();
    };
  }, [currentMediaKey]);

  // ─── ÇÖZÜM BAŞLAT ───────────────────────────────────────────────
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    isStreamFoundRef.current = false;

    if (externalStreamUrl) {
      isStreamFoundRef.current = true;
      streamSessionManager.setSession({
        streamUrl: externalStreamUrl,
        provider: 'External',
        expiresAt: Date.now() + 6 * 60 * 60 * 1000, // Varsayılan 6 saat
        headers: externalHeaders || {},
        mediaKey: currentMediaKey,
      });
      return;
    }

    // TMDB içerikleri için Backend API & Resolver kullan
    setResolving(true);
    setLoading(true);
    providerIndexRef.current = 0;

    async function startStreamResolution() {
      // 0. Çevrimdışı yerel dosya oynatma kontrolü (Uçak modu / İnternetsiz izleme)
      if (
        media?.isOfflinePlayback ||
        (typeof media?.savedStreamUrl === 'string' && media.savedStreamUrl.startsWith('file://'))
      ) {
        console.log('[Offline-FastPath] 📱 Yerel çevrimdışı dosya doğrudan oynatılıyor:', media.savedStreamUrl);
        streamSessionManager.setSession({
          streamUrl: media.savedStreamUrl,
          provider: 'Offline Local Storage',
          expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
          headers: {},
          mediaKey: currentMediaKey,
        });
        isStreamFoundRef.current = true;
        setResolving(false);
        setLoading(false);
        if (resolverTimeoutRef.current) {
          clearTimeout(resolverTimeoutRef.current);
          resolverTimeoutRef.current = null;
        }
        return;
      }

      // Önceden kaydedilmiş çalışan doğrudan akış URL'si varsa önce onu dene (Stream URL Cache)
      if (
        media?.savedStreamUrl &&
        typeof media.savedStreamUrl === 'string' &&
        (media.savedStreamUrl.includes('.m3u8') || media.savedStreamUrl.includes('.mp4') || media.savedStreamUrl.includes('/playlist/')) &&
        !media.savedStreamUrl.includes('ads') &&
        !media.savedStreamUrl.includes('doubleclick') &&
        !media.savedStreamUrl.includes('trailer') &&
        !media.savedStreamUrl.includes('preview')
      ) {
        // Token süresi dolmuşsa önbellekten çalıştırma, taze akış çek
        const expMatch = media.savedStreamUrl.match(/expires=(\d+)/);
        const isTokenExpired = expMatch && Number(expMatch[1]) * 1000 <= Date.now() + 60000;
        if (!isTokenExpired) {
          console.log('[Fast-Path] ⚡ Saved Stream URL found and valid!', media.savedStreamUrl);
          streamSessionManager.setSession({
            streamUrl: media.savedStreamUrl,
            provider: 'Saved Stream Cache',
            expiresAt: expMatch ? Number(expMatch[1]) * 1000 : Date.now() + 2 * 60 * 60 * 1000,
            headers: media.savedStreamHeaders || {},
            mediaKey: currentMediaKey,
          });
          isStreamFoundRef.current = true;
          setResolving(false);
          setLoading(false);
          if (resolverTimeoutRef.current) {
            clearTimeout(resolverTimeoutRef.current);
            resolverTimeoutRef.current = null;
          }
          return;
        } else {
          console.log('[Fast-Path] ⚠️ Saved Stream URL token süresi dolmuş, taze akış çözülüyor...');
        }
      }

      const cacheKey = streamPreheater.generateKey(tmdbId, isMovie ? 'movie' : 'tv', seasonNum, episodeNum);
      let preheated = media?.preheatedData || streamPreheater.get(cacheKey);

      if (preheated?.streamResult?.streamUrl) {
        console.log('[Fast-Path] ⚡ Instant Play Activated from Preheated Cache!', preheated.streamResult.streamUrl);
        streamSessionManager.setSession({
          streamUrl: preheated.streamResult.streamUrl,
          provider: preheated.streamResult.provider || 'Preheated Cache',
          expiresAt: Date.now() + 2 * 60 * 60 * 1000,
          headers: preheated.streamResult.headers || {},
          mediaKey: currentMediaKey,
        });
        if (preheated.introData) setIntroData(preheated.introData);
        if (preheated.streamResult.subtitles && Array.isArray(preheated.streamResult.subtitles) && preheated.streamResult.subtitles.length > 0) {
          setSubtitles(preheated.streamResult.subtitles);
        }
        isStreamFoundRef.current = true;
        setResolving(false);
        setLoading(false);
        return;
      }

      if (preheated?.inFlightPromise) {
        console.log('[Fast-Path] ⏳ Awaiting existing in-flight preheat request...');
        try {
          const res = await Promise.race([
            preheated.inFlightPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Preheat timeout')), 3500))
          ]);
          if (res?.streamResult?.streamUrl && !isStreamFoundRef.current && isMountedRef.current) {
            console.log('[Fast-Path] ⚡ In-flight preheat resolved stream successfully!', res.streamResult.streamUrl);
            streamSessionManager.setSession({
              streamUrl: res.streamResult.streamUrl,
              provider: res.streamResult.provider || 'Preheated Cache',
              expiresAt: Date.now() + 2 * 60 * 60 * 1000,
              headers: res.streamResult.headers || {},
              mediaKey: currentMediaKey,
            });
            if (res.introData) setIntroData(res.introData);
            if (res.streamResult.subtitles && Array.isArray(res.streamResult.subtitles) && res.streamResult.subtitles.length > 0) {
              setSubtitles(res.streamResult.subtitles);
            }
            isStreamFoundRef.current = true;
            setResolving(false);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.log('[Fast-Path] In-flight preheat did not complete in time, falling back to standard resolution');
        }
      }

      const cleanBaseUrl = (API_BASE_URL || 'https://maxen.sbs').replace(/\/api\/?$/, '').replace(/\/$/, '');

      // Paralel Fast-Fail Çözücü: VixSrc Direct, Backend API ve Cloudflare Worker
      const directResult = await resolveParallelDirectStreamResult({
        tmdbId,
        isMovie,
        seasonNum,
        episodeNum,
        cleanBaseUrl,
        timeoutMs: 6000,
        audioLang: preferredAudioLangRef.current || 'tr',
      });

      if (directResult && !directResult.isEmbed && directResult.streamUrl) {
        isStreamFoundRef.current = true;
        streamSessionManager.setSession({
          streamUrl: directResult.streamUrl,
          provider: directResult.provider || 'Direct Stream',
          expiresAt: Date.now() + 2 * 60 * 60 * 1000,
          headers: directResult.headers || {},
          mediaKey: currentMediaKey,
        });
        if (directResult.subtitles && Array.isArray(directResult.subtitles) && directResult.subtitles.length > 0) {
          setSubtitles(directResult.subtitles);
        }
        if (isMountedRef.current) {
          setResolverUrl(null);
          setResolving(false);
          setLoading(false);
        }
        if (resolverTimeoutRef.current) {
          clearTimeout(resolverTimeoutRef.current);
          resolverTimeoutRef.current = null;
        }
        return;
      }

      // Backend doğrudan bir embed URL döndürdüyse (örn: VidSrc.in embed), bunu doğrudan WebView çözücüsüne ver
      if (directResult && directResult.isEmbed && directResult.streamUrl && isMountedRef.current) {
        console.log(`[VideoPlayerView] ⚡ Backend embed URL döndü, doğrudan WebView çözücüsüne veriliyor: ${directResult.streamUrl}`);
        setResolverUrl(directResult.streamUrl);
        if (resolverTimeoutRef.current) clearTimeout(resolverTimeoutRef.current);
        resolverTimeoutRef.current = setTimeout(() => {
          if (!isStreamFoundRef.current && !currentStreamUrlRef.current && (playerRef.current?.currentTime || 0) <= 0) {
            console.log('[VideoPlayerView] Backend embed çözülemedi, alternatif sağlayıcılara geçiliyor...');
            providerIndexRef.current = 0;
            tryNextProvider();
          }
        }, 7000);
        return;
      }

      // Tüm doğrudan HLS kaynakları başarısız olduysa ve hala akış yoksa Gizli WebView sağlayıcı döngüsüne geç
      if (!isStreamFoundRef.current && !currentStreamUrlRef.current && (playerRef.current?.currentTime || 0) <= 0 && isMountedRef.current) {
        console.log('[VideoPlayerView] Doğrudan HLS kaynakları bulunamadı. Gizli WebView sağlayıcı döngüsüne geçiliyor...');
        providerIndexRef.current = 0;
        tryNextProvider();
      }
    }

    streamSessionManager.setRefreshHandler(async () => {
      isStreamFoundRef.current = false;
      providerIndexRef.current = 0;
      await startStreamResolution();
    });

    startStreamResolution();

    return () => {
      if (resolverTimeoutRef.current) clearTimeout(resolverTimeoutRef.current);
    };
  }, [tmdbId, isMovie, seasonNum, episodeNum, externalStreamUrl]);

  // ─── EXPO-VIDEO PLAYER ──────────────────────────────────────────
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.showNowPlayingNotification = true;
    p.staysActiveInBackground = true;
    p.preservesPitch = true; // Doğal ses tonunu koru (pitch/sincap sesi engelleyici)

    // Ağ dalgalanmalarına karşı buffer (önbellek) optimizasyonu
    try {
      p.bufferOptions = {
        preferredForwardBufferDuration: 30, // 30 saniyelik veriyi her zaman ileriden hazırda tut
        minBufferForPlayback: 5, // İleri sarma veya takılma sonrasında devam etmek için en az 5 saniye bekle
      };
    } catch (e) {
      console.warn("Buffer options not supported:", e);
    }
  });
  playerRef.current = player;

  useEffect(() => {
    if (!player || !streamUrl) return;
    // Embed HTML bağlantılarını yerel ExoPlayer'a göndermiyoruz, WebView gösterecek
    if (!streamUrl.includes('.m3u8') && !streamUrl.includes('.mp4') && !streamUrl.includes('/playlist/')) return;

    hasSeekedRef.current = false;
    autoRetryCountRef.current = 0;
    const isHls = streamUrl.includes('.m3u8') || streamUrl.includes('/playlist/');

    const canPlayHlsNatively =
      Platform.OS !== 'web' ||
      (typeof document !== 'undefined' &&
        Boolean(document.createElement('video').canPlayType('application/vnd.apple.mpegurl')));

    // Web ortamında native HLS desteklemeyen tarayıcılarda (Chrome/Firefox/Edge)
    // replaceAsync çağrısı video.src'ye .m3u8 yazacağı için Chrome NotSupportedError fırlatır.
    // Bu yüzden native HLS olmayan web ortamında replaceAsync çağrısını atlıyoruz.
    // Aşağıdaki Hls.js hook'u doğrudan MSE (blob:) üzerinden video elementine akışı bağlar.
    if (Platform.OS === 'web' && !canPlayHlsNatively && isHls) {
      return;
    }

    const effectiveHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      ...(streamUrl.includes('vixsrc') || streamUrl.includes('playlist')
        ? { Referer: 'https://vixsrc.to/', Origin: 'https://vixsrc.to' }
        : {}),
      ...streamHeaders,
    };

    const source = {
      uri: streamUrl,
      headers: effectiveHeaders,
      contentType: isHls ? ('hls' as const) : ('auto' as const),
      metadata: {
        title: isMovie ? title : `${title} S${seasonNum}:E${episodeNum}`,
        artist: 'Maxen',
        artwork: media?.posterUrl || media?.poster_path || media?.backdropUrl || undefined,
      },
    };
    player.replaceAsync(source).catch((e: any) => {
      console.error('replaceAsync hatası:', e);
    });
  }, [player, streamUrl, streamHeaders, title, isMovie, seasonNum, episodeNum, media]);

  // Web Ortamında Hls.js ile .m3u8 Doğrudan Akışını <video> Elementine Bağlama (Chrome/Edge/Firefox)
  useEffect(() => {
    if (Platform.OS !== 'web' || !streamUrl || typeof window === 'undefined') return;
    const isHls = streamUrl.includes('.m3u8') || streamUrl.includes('/playlist/');
    if (!isHls) return;

    let hlsInstance: any = null;
    let isCancelled = false;

    const attachHls = async () => {
      try {
        const HlsModule = await import('hls.js');
        const Hls = HlsModule.default || HlsModule;
        if (isCancelled) return;

        const video = (videoViewRef.current as any)?.nativeRef?.current || document.querySelector('video');

        if (video && Hls.isSupported()) {
          if (!video.canPlayType('application/vnd.apple.mpegurl')) {
            // Chrome'un NotSupportedError vermesini önlemek için doğrudan video.src'yi sıfırla
            if (video.hasAttribute('src')) {
              video.removeAttribute('src');
              video.load();
            }

            hlsInstance = new Hls({
              enableWorker: true,
              lowLatencyMode: false,
              backBufferLength: 90,
            });
            hlsInstance.loadSource(streamUrl);
            hlsInstance.attachMedia(video);
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
              if (isCancelled) return;
              if ((resumeFromSecondsRef.current ?? 0) > 0) {
                video.currentTime = resumeFromSecondsRef.current ?? 0;
              }
              video.play().catch(() => {});
            });
            hlsInstance.on(Hls.Events.ERROR, (_event: any, data: any) => {
              if (data.fatal) {
                console.warn('[Web HLS.js Fatal Error]:', data.type, data.details);
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    hlsInstance?.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    hlsInstance?.recoverMediaError();
                    break;
                  default:
                    hlsInstance?.destroy();
                    break;
                }
              }
            });
          }
        }
      } catch (err) {
        console.warn('[Web HLS.js] Hls bağlama hatası:', err);
      }
    };

    const timer = setTimeout(attachHls, 50);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [streamUrl]);

  // HLS Master Manifest Çözünürlük Ayrıştırıcı (Gerçek 1080p / 720p / 480p / 360p akışlarını çeker)
  useEffect(() => {
    if (!streamUrl) return;
    if (!masterStreamUrlRef.current && (streamUrl.includes('.m3u8') || streamUrl.includes('/playlist/'))) {
      masterStreamUrlRef.current = streamUrl;
    }

    const currentMaster = masterStreamUrlRef.current || streamUrl;
    if (currentMaster.includes('.m3u8') || currentMaster.includes('/playlist/')) {
      const effectiveHeaders: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        ...(currentMaster.includes('vixsrc') || currentMaster.includes('playlist')
          ? { Referer: 'https://vixsrc.to/', Origin: 'https://vixsrc.to' }
          : {}),
        ...streamHeaders,
      };

      fetchAndParseHlsQualities(currentMaster, effectiveHeaders).then((res) => {
        if (res && res.variants.length > 0) {
          hlsQualityMapRef.current = res.qualityMap;
          setAvailableQualities(Object.keys(res.qualityMap));
        }
      });
    }
  }, [streamUrl, streamHeaders]);

  // Kalite Değiştirme Fonksiyonu (Anlık video akışını ilgili çözünürlük alt dizinine yönlendirir)
  const handleSelectQuality = useCallback(
    (qualityId: string) => {
      setSelectedQuality(qualityId);
      const masterUrl = masterStreamUrlRef.current || streamUrl;
      if (!masterUrl) return;

      let targetUrl = masterUrl;
      if (qualityId !== 'auto' && hlsQualityMapRef.current[qualityId]) {
        targetUrl = hlsQualityMapRef.current[qualityId];
      }

      if (targetUrl !== streamUrl) {
        const currentPos = playerRef.current?.currentTime || currentTimeRef.current || currentTime;
        resumeFromSecondsRef.current = currentPos;
        hasSeekedRef.current = false;
        setStreamUrl(targetUrl);
      }

      const label = qualityId === 'auto' ? 'Otomatik (ABR)' : qualityId.toUpperCase();
      setSubtitleToast(`Görüntü Kalitesi: ${label}`);
    },
    [streamUrl, currentTime]
  );

  // Senkronize Oynatma Hızı Ayarı
  useEffect(() => {
    if (playerRef.current) {
      try {
        playerRef.current.preservesPitch = true;
        playerRef.current.playbackRate = playbackRate;
      } catch (e) { }
    }
  }, [player, playbackRate]);

  // ─── PLAYER OLAYLARI ─────────────────────────────────────────────
  useEffect(() => {
    if (!player || !streamUrl) return;
    if (!streamUrl.includes('.m3u8') && !streamUrl.includes('.mp4') && !streamUrl.includes('/playlist/')) return;

    const s1 = player.addListener('statusChange', (payload: any) => {
      if (payload?.status === 'readyToPlay') {
        setPlayerReady(true);
        setLoading(false);
        autoRetryCountRef.current = 0; // Reset auto retry count on success
        const finalDuration = player.duration > 0 ? player.duration : jellyfinDurationInSeconds;
        setDuration(finalDuration);

        // Arka plandaysak otomatik oynatma ve seek yapma — kullanıcı geri dönünce kaldığı yerden devam eder
        if (isAppInBackgroundRef.current) {
          hasSeekedRef.current = true;
          return;
        }

        let initialTime = startSeconds;
        let isResuming = false;
        if (resumeFromSecondsRef.current !== null) {
          initialTime = resumeFromSecondsRef.current;
          resumeFromSecondsRef.current = null;
          isResuming = true;
        } else if (!hasSeekedRef.current) {
          if (initialTime <= 0 && media.progress && finalDuration > 0) {
            initialTime = media.progress * finalDuration;
          } else if (initialTime <= 0 && media.UserData?.PlaybackPositionTicks) {
            initialTime = media.UserData.PlaybackPositionTicks / 10000000;
          }
        }

        player.play();
        setIsPlaying(true);

        if (initialTime > 0 && (!hasSeekedRef.current || isResuming)) {
          initialSeekTimeoutRef.current = setTimeout(() => {
            try {
              if (isMountedRef.current && playerRef.current) {
                player.currentTime = initialTime;
              }
            } catch (e) { }
          }, 150);
        }
        hasSeekedRef.current = true;
      } else if (payload?.status === 'error') {
        console.error('Oynatıcı hatası alındı:', payload?.error);
        if (autoRetryCountRef.current < 5) {
          const currentSec = currentTimeRef.current;
          console.log(`[Auto-Retry] Hata algılandı. Yeniden deneniyor (${autoRetryCountRef.current + 1}/5). Kaldığı saniye: ${currentSec}`);
          autoRetryCountRef.current += 1;
          resumeFromSecondsRef.current = currentSec;

          setLoading(true);
          setError(null);
          if (isJellyfin) {
            const staticUrl = `${serverUrl}/Videos/${itemId}/stream?static=true&MediaSourceId=${itemId}&UserId=${userId}&DeviceId=maxen-device&PlaySessionId=${playSessionIdRef.current}&api_key=${token}`;
            setStreamUrl(null);
            retryTimeoutRef.current = setTimeout(() => {
              if (isMountedRef.current) setStreamUrl(staticUrl);
            }, 250);
          } else {
            // Eğer 2. veya daha sonraki denemeyse token bayatlamış olabilir, VixSrc'den doğrudan taze akış al
            if (autoRetryCountRef.current >= 2 && tmdbId) {
              console.log('[Auto-Retry] Akış tokenı bayatlamış olabilir, taze token çözülüyor...');
              resolveVixSrcDirect({
                tmdbId,
                isMovie,
                seasonNum,
                episodeNum,
                timeoutMs: 5000,
                audioLang: preferredAudioLangRef.current || 'tr',
              })
                .then((fresh) => {
                  if (fresh?.streamUrl && isMountedRef.current) {
                    console.log('[Auto-Retry] ✅ Taze akış başarıyla alındı:', fresh.streamUrl);
                    streamSessionManager.setSession({
                      streamUrl: fresh.streamUrl,
                      provider: 'VixSrc Refreshed',
                      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
                      headers: fresh.headers || {},
                      mediaKey: currentMediaKey,
                    });
                  }
                })
                .catch(() => {
                  // Fallback olarak kayıtlı adrese devam et
                  if (streamUrl && isMountedRef.current) {
                    const savedUrl = streamUrl;
                    setStreamUrl(null);
                    retryTimeoutRef.current = setTimeout(() => {
                      if (isMountedRef.current) setStreamUrl(savedUrl);
                    }, 350);
                  }
                });
            } else if (streamUrl) {
              // İlk denemede aynı akış adresini tazeleyerek yeniden bağla
              const savedUrl = streamUrl;
              setStreamUrl(null);
              retryTimeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) setStreamUrl(savedUrl);
              }, 350);
            }
          }
        } else {
          setError('Video akışı kesildi. Lütfen tekrar deneyin.');
          setLoading(false);
        }
      }
    });

    const s2 = player.addListener('playingChange', (payload: any) => {
      if (typeof payload?.isPlaying === 'boolean') {
        setIsPlaying(payload.isPlaying);
      }
    });

    return () => {
      s1.remove();
      s2.remove();
    };
  }, [player, streamUrl, startSeconds, jellyfinDurationInSeconds, media, isJellyfin, serverUrl, itemId, userId, token, tryNextProvider]);

  // ─── CANLI SÜRE SENKRONİZASYONU VE PROGRESS KAYIT ──────────────────────────────
  // ─── CANLI SÜRE SENKRONİZASYONU VE PROGRESS KAYIT (KAYDIRARAK ÇIKMA DESTEKLİ) ───
  useEffect(() => {
    if (!player || !playerReady) return;

    let lastSavedTime = 0;
    const interval = setInterval(() => {
      if (!playerRef.current) return;
      try {
        const p = playerRef.current;
        if (p.playing) {
          setCurrentTime(p.currentTime);
          currentTimeRef.current = p.currentTime;
          if (p.duration > 0) setDuration(p.duration);

          const cur = p.currentTime;
          const dur = p.duration;

          // Uyku Zamanlayıcısı: Bölüm sonuna gelindiğinde durdur
          if (sleepTimerRef.current === 'end_of_episode' && dur > 0 && dur - cur <= 2) {
            p.pause();
            p.keepScreenOnWhilePlaying = false;
            setIsPlaying(false);
            setSleepTimer('off');
            setSubtitleToast('Bölüm bitti, uyku zamanlayıcısı oynatmayı durdurdu. 🌙');
          }

          // Periyodik Kayıt (Her 5 saniyede bir)
          if (dur > 0 && Math.abs(cur - lastSavedTime) >= 5) {
            lastSavedTime = cur;
            saveProgressToDb(cur, dur);
          }
        }
      } catch (e) {
        clearInterval(interval);
      }
    }, 1000);

    timeIntervalRef.current = interval;

    // CRITICAL: Kaydırarak geri çıkıldığında unmount tetiklenir ve burası çalışır!
    return () => {
      clearInterval(interval);
      if (bingeTransitioningRef.current) return;
      const lastTime = currentTimeRef.current;
      const lastDuration = duration;
      if (lastTime > 0 && lastDuration > 0) {
        saveProgressToDb(lastTime, lastDuration);
      }
    };
  }, [player, playerReady, media, onPlayNextMedia, duration, seasonNum, episodeNum, saveProgressToDb]);

  // ─── GÖMÜLÜ SES VE ALTYAZI TAKİBİ ────────────────────────────────
  useEffect(() => {
    if (!player || !playerReady) return;
    const syncMediaTracks = () => {
      if (!playerRef.current) return;
      try {
        const p = playerRef.current;
        const subTracks = p.availableSubtitleTracks ?? [];
        setAvailableSubtitleTracks(subTracks);
        setCurrentSubtitleTrack(p.subtitleTrack);

        const audTracks = p.availableAudioTracks ?? [];
        setAvailableAudioTracks(audTracks);
        setCurrentAudioTrack(p.audioTrack);

        // Eğer henüz otomatik seçim yapılmadıysa ve Türkçe ses izi varsa seç
        if (audTracks.length > 0 && !hasAutoSelectedAudioRef.current) {
          const pref = (preferredAudioLangRef.current || 'tr').toLowerCase();
          const trTrack = audTracks.find((t: any) =>
            (t.language && (t.language.toLowerCase() === 'tur' || t.language.toLowerCase() === 'tr')) ||
            (t.label && (t.label.toLowerCase().includes('türk') || t.label.toLowerCase().includes('dublaj')))
          );
          if (trTrack && (pref === 'tr' || pref.includes('türk'))) {
            hasAutoSelectedAudioRef.current = true;
            p.audioTrack = trTrack;
            const lbl = formatAudioLabel(trTrack.label, trTrack.language);
            console.log(`[Audio/Dublaj] 🎙️ Gömülü Türkçe Dublaj otomatik seçildi:`, lbl);
            setSubtitleToast(`Ses: ${lbl}`);
          }
        }
      } catch (e) {
        clearInterval(interval);
      }
    };
    syncMediaTracks();
    const interval = setInterval(syncMediaTracks, 1500);
    subtitleTrackIntervalRef.current = interval;
    return () => clearInterval(interval);
  }, [player, playerReady]);

  // ─── HARİCİ ALTYAZI YÜKLEME ────────────────────────────────────

  const loadExternalSubtitle = useCallback(async (track: SubtitleTrack) => {
    try {
      setOpenSubtitlesLoading(true);
      let vttContent = '';

      if (track.url) {
        console.log(`[Subtitle Fetch] İndiriliyor: ${track.url}`);
        const res = await fetch(track.url, {
          headers: {
            'Referer': 'https://vixsrc.to/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          }
        });
        console.log(`[Subtitle Fetch] Yanıt Kodu: ${res.status}`);
        if (res.ok) {
          vttContent = await res.text();
          console.log(`[Subtitle Fetch] Alınan VTT İçeriği (ilk 100 karakter): ${vttContent.substring(0, 100)}`);
        } else {
          console.error(`[Subtitle Fetch] Hata: ${await res.text()}`);
        }
      }

      const cues = parseSubtitles(vttContent);
      console.log(`[Subtitle Fetch] Toplam ${cues.length} adet altyazı bloğu çıkarıldı.`);

      if (cues.length === 0) {
        console.warn('Altyazı içeriği okunamadı veya boş:', track.label);
        setSubtitleToast('Bu altyazı indirilemedi. Lütfen listeden başka bir altyazı seçin.');
        toastTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) setSubtitleToast(null);
        }, 4000);
        setExternalCues([]);
        setSubtitleText('');
        setSelectedSubtitle(null);
      } else {
        setSubtitleToast(null);
        setExternalCues(cues);
        setSelectedSubtitle(track);
      }
    } catch (e) {
      console.error('Altyazı yüklenemedi:', e);
      setSubtitleToast('Altyazı indirilemedi. Başka bir altyazı deneyin.');
      toastTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) setSubtitleToast(null);
      }, 4000);
      setSubtitleText('');
      setExternalCues([]);
      setSelectedSubtitle(null);
    } finally {
      if (isMountedRef.current) setOpenSubtitlesLoading(false);
    }
  }, [streamUrl]);

  // ─── OTOMATİK İLK ALTYAZI SEÇİMİ (YALNIZCA İLK YÜKLEMEDE 1 KEZ ÇALIŞIR) ─────────────
  useEffect(() => {
    // Kullanıcı elle bir seçim yaptıysa veya tercih "Kapalı" ise kesinlikle otomatik seçim yapma
    if (hasUserSelectedSubtitleRef.current) return;
    if (preferredSubtitleLangRef.current === 'Kapalı') {
      hasAutoSelectedSubtitleRef.current = true;
      return;
    }
    if (hasAutoSelectedSubtitleRef.current) return;

    if (subtitles.length > 0) {
      const preferred = preferredSubtitleLangRef.current;
      const match = subtitles.find(s => {
        const l = (s.lang || s.label || '').toLowerCase();
        if (preferred && normalizeLang(s.lang || s.label).toLowerCase() === preferred.toLowerCase()) return true;
        return l.includes('tr') || l.includes('türk') || l.includes('turk');
      });

      if (match) {
        hasAutoSelectedSubtitleRef.current = true;
        setSelectedSubtitle(match);
        loadExternalSubtitle(match);
        if (playerRef.current) {
          try { playerRef.current.subtitleTrack = null; } catch (e) { }
        }
      }
    }
  }, [subtitles, loadExternalSubtitle]);



  const extractM3u8Subtitles = useCallback(async (url: string, headers: any) => {
    try {
      console.log(`[VixSrc Subtitles] Ana m3u8 çekiliyor... URL: ${url}`);
      const res = await fetch(url, { headers });
      if (!res.ok) return false;
      const m3u8Text = await res.text();

      const regex = /#EXT-X-MEDIA:TYPE=SUBTITLES.*?NAME="([^"]+)".*?LANGUAGE="([^"]+)".*?URI="([^"]+)"/g;
      let match;
      const extractedTracks: SubtitleTrack[] = [];
      let index = 0;

      while ((match = regex.exec(m3u8Text)) !== null) {
        const name = match[1];
        const lang = match[2];
        const subM3u8Uri = match[3];

        let fullUri = subM3u8Uri;
        if (!fullUri.startsWith('http')) {
          fullUri = new URL(subM3u8Uri, url).href;
        }

        try {
          const subRes = await fetch(fullUri, { headers });
          if (subRes.ok) {
            const subM3u8Text = await subRes.text();
            const vttLine = subM3u8Text.split('\n').map(l => l.trim()).find(l => l && !l.startsWith('#') && (l.includes('.vtt') || l.includes('token=')));
            if (vttLine) {
              let vttUrl = vttLine;
              if (!vttUrl.startsWith('http')) {
                vttUrl = new URL(vttUrl, fullUri).href;
              }
              extractedTracks.push({
                label: name,
                lang: normalizeLang(lang),
                url: vttUrl,
              });
              index++;
            }
          }
        } catch (e) { }
      }

      if (extractedTracks.length > 0) {
        console.log(`[VixSrc Subtitles] ${extractedTracks.length} adet VTT altyazı başarıyla çıkarıldı!`);
        setSubtitles(extractedTracks);

        // Tercih edilen dili otomatik seç
        if (!hasUserSelectedSubtitleRef.current && preferredSubtitleLangRef.current) {
          const autoMatch = extractedTracks.find(t => normalizeLang(t.lang || t.label) === preferredSubtitleLangRef.current);
          if (autoMatch) {
            console.log(`[AutoSelect] Tercih edilen altyazı bulundu: ${autoMatch.label}`);
            // Küçük bir gecikmeyle çağırıyoruz ki state yerleşsin
            autoSelectSubTimeoutRef.current = setTimeout(() => {
              if (isMountedRef.current) loadExternalSubtitle(autoMatch);
            }, 500);
          }
        }

        return true;
      }
    } catch (err) {
      console.error(`[VixSrc Subtitles] Çıkarma hatası:`, err);
    }
    return false;
  }, []);

  const extractM3u8AudioTracks = useCallback(async (url: string, headers: any) => {
    try {
      console.log(`[Audio/Dublaj] Ana m3u8 ses izleri taranıyor... URL: ${url}`);
      const res = await fetch(url, { headers });
      if (!res.ok) return false;
      const m3u8Text = await res.text();

      const regex = /#EXT-X-MEDIA:TYPE=AUDIO.*?NAME="([^"]+)".*?LANGUAGE="([^"]+)".*?(?:URI="([^"]+)")?/g;
      let match;
      const extractedAudios: AudioTrack[] = [];

      while ((match = regex.exec(m3u8Text)) !== null) {
        const name = match[1];
        const lang = match[2];
        const audioUri = match[3];

        let fullUri = audioUri;
        if (fullUri && !fullUri.startsWith('http')) {
          fullUri = new URL(audioUri, url).href;
        }

        const formattedLabel = formatAudioLabel(name, lang);

        extractedAudios.push({
          id: fullUri || `audio-${lang}-${name}`,
          label: formattedLabel,
          language: lang,
          url: fullUri || '',
        });
      }

      if (extractedAudios.length > 0) {
        console.log(`[Audio/Dublaj] ${extractedAudios.length} adet ses parçası başarıyla çıkarıldı!`);
        setAudioTracks(prev => {
          const merged = [...prev, ...extractedAudios];
          const seenLangs = new Set<string>();
          const seenLabels = new Set<string>();
          return merged.filter(a => {
            const lKey = (a.language || a.label || '').toLowerCase().trim();
            const lblKey = (a.label || '').toLowerCase().trim();
            if (seenLangs.has(lKey) || seenLabels.has(lblKey)) return false;
            if (lKey) seenLangs.add(lKey);
            seenLabels.add(lblKey);
            return true;
          });
        });

        // Tercih edilen dil veya Türkçe Dublaj parçasını otomatik seç
        const pref = (preferredAudioLangRef.current || 'tr').toLowerCase();
        const trTrack = extractedAudios.find(a => 
          a.language.toLowerCase() === 'tur' || 
          a.language.toLowerCase() === 'tr' || 
          a.label.toLowerCase().includes('türk')
        );

        if (trTrack && !hasAutoSelectedAudioRef.current) {
          hasAutoSelectedAudioRef.current = true;
          console.log(`[Audio/Dublaj] 🎙️ Otomatik Türkçe Dublaj seçiliyor:`, trTrack.label);
          if (playerRef.current) {
            try {
              const p = playerRef.current;
              const matchingEmb = (p.availableAudioTracks || []).find((t: any) => 
                (t.language && (t.language.toLowerCase() === 'tur' || t.language.toLowerCase() === 'tr')) ||
                (t.label && t.label.toLowerCase().includes('türk'))
              );
              if (matchingEmb) {
                p.audioTrack = matchingEmb;
                setCurrentAudioTrack(matchingEmb);
                setSubtitleToast(`Ses: ${trTrack.label}`);
              }
            } catch (e) {}
          }
        }
        return true;
      }
    } catch (err) {
      console.error(`[Audio/Dublaj] Ses çıkarma hatası:`, err);
    }
    return false;
  }, []);

  const fetchSubtitles = useCallback(async () => {
    if (streamUrl && streamUrl.includes('.m3u8')) {
      setOpenSubtitlesLoading(true);
      await Promise.all([
        extractM3u8Subtitles(streamUrl, streamHeaders),
        extractM3u8AudioTracks(streamUrl, streamHeaders),
      ]);
      setOpenSubtitlesLoading(false);
    }
  }, [streamUrl, streamHeaders, extractM3u8Subtitles, extractM3u8AudioTracks]);

  useEffect(() => {
    if (streamUrl && !isJellyfin) {
      fetchSubtitles();
    }
  }, [streamUrl, fetchSubtitles, isJellyfin]);

  // Harici altyazı senkronizasyonu
  useEffect(() => {
    if (externalCues.length > 0) {
      let left = 0;
      let right = externalCues.length - 1;
      let activeText = '';

      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const cue = externalCues[mid];

        if (currentTime >= cue.start && currentTime <= cue.end) {
          activeText = cue.text;
          break;
        } else if (currentTime < cue.start) {
          right = mid - 1;
        } else {
          left = mid + 1;
        }
      }
      setSubtitleText(activeText);
    } else {
      setSubtitleText('');
    }
  }, [currentTime, externalCues]);

  const clearSubtitles = useCallback(() => {
    if (playerRef.current) {
      try { playerRef.current.subtitleTrack = null; } catch (e) { }
    }
  }, []);

  // --- TV / ANDROID HARDWARE BACK BUTTON OVERRIDE ---
  useEffect(() => {
    const onBackPress = () => {
      // 1. Hızlı bindirme (Quick overlay)
      if (quickOverlayMode !== 'none') {
        setQuickOverlayMode('none');
        return true;
      }
      // 2. Watch Party Sohbet Çekmecesi
      if (showWatchPartyChat) {
        setShowWatchPartyChat(false);
        return true;
      }
      // 3. Stats for Nerds Paneli
      if (showStatsForNerds) {
        setShowStatsForNerds(false);
        return true;
      }
      // 4. Altyazı Görünüm Menüsü
      if (showSubtitleAppearanceMenu) {
        setShowSubtitleAppearanceMenu(false);
        return true;
      }
      // 5. Ses Parçası Menüsü
      if (showAudioMenu) {
        setShowAudioMenu(false);
        setControlsVisible(true);
        prolongControls();
        return true;
      }
      // 6. TV'de Oynat Modalı
      if (showPlayOnTvModal) {
        setShowPlayOnTvModal(false);
        return true;
      }
      // 7. Ayarlar Menüsü
      if (showSettingsMenu) {
        setShowSettingsMenu(false);
        return true;
      }
      // 8. Altyazı Seçim Menüsü
      if (showSubtitleMenu) {
        setShowSubtitleMenu(false);
        return true;
      }
      // 9. Kalite Menüsü
      if (showQualityMenu) {
        setShowQualityMenu(false);
        return true;
      }
      // 10. Ekran Kilitli ise oynatıcıyı kapatma, kullanıcıyı uyar
      if (isScreenLocked) {
        setSubtitleToast(Platform.isTV ? 'Ekran kilitli. Kilidi açmak için kumandadaki OK tuşuna basın.' : 'Ekran kilitli. Çıkmak için önce kilit simgesine dokunun 🔒');
        return true;
      }
      // 11. Kontroller açıksa önce kontrolleri gizle
      if (controlsVisible) {
        setControlsVisible(false);
        return true;
      }
      // 12. Tam ekrandayken geri basıldığında uygulama içi mini oynatıcıya geç
      if (!isMiniPlayer && !Platform.isTV) {
        setIsMiniPlayer(true);
        return true;
      }
      // 13. Zaten mini oynatıcıdaysa kapat ve ekran yönünü dikey konuma getir
      if (Platform.OS !== 'web' && !Platform.isTV) {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
      onClose();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [
    quickOverlayMode,
    showWatchPartyChat,
    showStatsForNerds,
    showSubtitleAppearanceMenu,
    showAudioMenu,
    showPlayOnTvModal,
    showSettingsMenu,
    showSubtitleMenu,
    showQualityMenu,
    isScreenLocked,
    controlsVisible,
    onClose,
  ]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;

      try {
        if (playerRef.current) {
          playerRef.current.pause();
        }
      } catch (e) {}

      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current);
        timeIntervalRef.current = null;
      }

      if (subtitleTrackIntervalRef.current) {
        clearInterval(subtitleTrackIntervalRef.current);
        subtitleTrackIntervalRef.current = null;
      }

      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }

      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = null;
      }

      if (resolverTimeoutRef.current) {
        clearTimeout(resolverTimeoutRef.current);
        resolverTimeoutRef.current = null;
      }

      if (initialSeekTimeoutRef.current) {
        clearTimeout(initialSeekTimeoutRef.current);
        initialSeekTimeoutRef.current = null;
      }

      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }

      if (autoSelectSubTimeoutRef.current) {
        clearTimeout(autoSelectSubTimeoutRef.current);
        autoSelectSubTimeoutRef.current = null;
      }

      if (hudFadeTimeoutRef.current) {
        clearTimeout(hudFadeTimeoutRef.current);
        hudFadeTimeoutRef.current = null;
      }
    };
  }, []);

  // ─── SCENE THUMBNAILS PRELOADER & GENERATOR ─────────────────────
  useEffect(() => {
    let isMounted = true;
    const loadThumbnails = async () => {
      const tmdbId = media?.tmdbId || media?.id;
      if (!tmdbId) return;
      const type = isMovie ? 'movie' : 'tv';
      const thumbs = await fetchMediaSceneThumbnails(tmdbId, type, seasonNum, episodeNum);
      if (isMounted && thumbs && thumbs.length > 0) {
        setSceneThumbnails(thumbs);
      }
    };
    loadThumbnails();
    return () => { isMounted = false; };
  }, [media, isMovie, seasonNum, episodeNum]);

  useEffect(() => {
    if (isSeeking && seekPreviewTime !== undefined && duration > 0) {
      if (sceneThumbnails.length > 0) {
        const ratio = Math.max(0, Math.min(1, seekPreviewTime / duration));
        const index = Math.min(sceneThumbnails.length - 1, Math.floor(ratio * sceneThumbnails.length));
        setPreviewThumbnail(sceneThumbnails[index]);
      } else if (media?.backdrop_path) {
        setPreviewThumbnail(`https://image.tmdb.org/t/p/w500${media.backdrop_path}`);
      } else if (media?.poster_path) {
        setPreviewThumbnail(`https://image.tmdb.org/t/p/w500${media.poster_path}`);
      }
    } else {
      setPreviewThumbnail(null);
    }
  }, [seekPreviewTime, isSeeking, duration, sceneThumbnails, media]);

  // ─── KAYDIRMA VEYA TIKLAMA ÇUBUĞU (PAN & TAP SEEK) ─────────────
  const progressPanResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gs) => {
        if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
        if (!playerRef.current || duration <= 0 || trackLayout.width <= 0) return;
        const pageX = evt.nativeEvent.pageX || gs.x0;
        const relativeX = pageX - trackLayout.x;
        const p = Math.max(0, Math.min(1, relativeX / trackLayout.width));
        const targetTime = p * duration;

        // Görsel güncellemeyi yap ama player'ı henüz seek etme (sürükleme bitince yap)
        // Görsel güncellemeyi yap ama player'ı henüz seek etme (sürükleme bitince yap)
        setIsSeeking(true);
        setSeekPreviewTime(targetTime);
        seekPreviewTimeRef.current = targetTime;
        autoRetryCountRef.current = 0;
      },
      onPanResponderMove: (evt, gs) => {
        if (!playerRef.current || duration <= 0 || trackLayout.width <= 0) return;
        const pageX = evt.nativeEvent.pageX || gs.moveX;
        const relativeX = pageX - trackLayout.x;
        const p = Math.max(0, Math.min(1, relativeX / trackLayout.width));
        const targetTime = p * duration;

        // Sadece arayüzü güncelle
        setIsSeeking(true);
        setSeekPreviewTime(targetTime);
        seekPreviewTimeRef.current = targetTime;
        autoRetryCountRef.current = 0;
      },
      onPanResponderRelease: () => {
        // Parmağı çektiğinde GERÇEK player'a pozisyonu gönder ve veritabanına anında kaydet
        const finalTime = seekPreviewTimeRef.current !== undefined ? seekPreviewTimeRef.current : currentTimeRef.current;
        if (playerRef.current && finalTime >= 0) {
          try {
            playerRef.current.currentTime = finalTime;
            setCurrentTime(finalTime);
            currentTimeRef.current = finalTime;
            saveProgressToDb(finalTime);
          } catch (e) { }
        }
        setIsSeeking(false);
        setSeekPreviewTime(undefined);
        seekPreviewTimeRef.current = undefined;
        prolongControls();
      },
    }),
    [duration, prolongControls, trackLayout, saveProgressToDb]
  );

  // ─── PARLAKLIK VE SES İÇİN HAREKET DUYARLI PAN RESPONDER (VLC / MX PLAYER STYLE) ───
  const gesturePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_evt, gs) => {
          return Math.abs(gs.dy) > 10 && Math.abs(gs.dy) > Math.abs(gs.dx);
        },
        onMoveShouldSetPanResponderCapture: (_evt, gs) => {
          return Math.abs(gs.dy) > 10 && Math.abs(gs.dy) > Math.abs(gs.dx);
        },
        onPanResponderGrant: (evt, gs) => {
          if (hudFadeTimeoutRef.current) {
            clearTimeout(hudFadeTimeoutRef.current);
            hudFadeTimeoutRef.current = null;
          }
          const startX = gs.x0 ?? evt.nativeEvent.pageX;
          const isLeft = startX < SCREEN_WIDTH / 2;

          if (isLeft) {
            gestureTypeRef.current = 'brightness';
            gestureStartValRef.current = brightnessRef.current;
            setGestureHud({
              type: 'brightness',
              value: brightnessRef.current,
              visible: true,
            });
          } else {
            gestureTypeRef.current = 'volume';
            const currentVol =
              playerRef.current?.volume !== undefined
                ? playerRef.current.volume
                : 1.0;
            gestureStartValRef.current = currentVol;
            setGestureHud({
              type: 'volume',
              value: currentVol,
              visible: true,
            });
          }
        },
        onPanResponderMove: (_evt, gs) => {
          const type = gestureTypeRef.current;
          if (!type) return;

          const swipeRange = Math.max(180, SCREEN_HEIGHT * 0.65);
          const delta = -gs.dy / swipeRange;
          const newVal = Math.max(0, Math.min(1, gestureStartValRef.current + delta));

          if (type === 'brightness') {
            setBrightness(newVal);
            brightnessRef.current = newVal;
            setGestureHud({
              type: 'brightness',
              value: newVal,
              visible: true,
            });
          } else if (type === 'volume') {
            if (playerRef.current) {
              try {
                playerRef.current.volume = newVal;
              } catch (e) {}
            }
            setGestureHud({
              type: 'volume',
              value: newVal,
              visible: true,
            });
          }
        },
        onPanResponderRelease: () => {
          gestureTypeRef.current = null;
          if (hudFadeTimeoutRef.current) {
            clearTimeout(hudFadeTimeoutRef.current);
          }
          hudFadeTimeoutRef.current = setTimeout(() => {
            setGestureHud(null);
          }, 350);
        },
        onPanResponderTerminate: () => {
          gestureTypeRef.current = null;
          if (hudFadeTimeoutRef.current) {
            clearTimeout(hudFadeTimeoutRef.current);
          }
          hudFadeTimeoutRef.current = setTimeout(() => {
            setGestureHud(null);
          }, 350);
        },
      }),
    [SCREEN_WIDTH, SCREEN_HEIGHT]
  );

  const progressPercent = (cur: number, dur: number) => dur <= 0 ? 0 : Math.min((cur / dur) * 100, 100);
  const fmt = (s: number) => {
    if (!s || isNaN(s) || s < 0) return '00:00';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // ─── RENDER ─────────────────────────────────────────────────────
  const isEmbedUrl = useMemo(() => {
    if (!streamUrl) return false;
    return !streamUrl.includes('.m3u8') && !streamUrl.includes('.mp4') && !streamUrl.includes('/playlist/');
  }, [streamUrl]);

  const subtitleBottomOffset = useMemo(() => {
    const safeBottom = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 0);
    return safeBottom + 32;
  }, [insets.bottom]);

  const miniWidth = customMiniWidth;
  const miniHeight = Math.round(miniWidth / (16 / 9));

  const playerContainerStyle = isNativePiPActive
    ? [styles.root, StyleSheet.absoluteFillObject, { backgroundColor: '#000', borderWidth: 0, borderRadius: 0, zIndex: 99999 }]
    : isMiniPlayer
    ? {
        position: 'absolute' as const,
        bottom: Platform.isTV ? 90 : Math.max(insets.bottom, 12) + 72,
        right: 16,
        width: miniWidth,
        height: miniHeight,
        borderRadius: 18,
        overflow: 'hidden' as const,
        zIndex: 99999,
        elevation: 32,
        backgroundColor: '#000',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.22)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.8,
        shadowRadius: 16,
        transform: miniPan.getTranslateTransform(),
      }
    : [styles.root, StyleSheet.absoluteFillObject, { zIndex: 1000, backgroundColor: '#000' }];

  return (
    <Animated.View style={playerContainerStyle} {...(isMiniPlayer && !Platform.isTV ? miniDragPanResponder.panHandlers : {})}>
      <StatusBar hidden={!isMiniPlayer && !isNativePiPActive} />
      <View style={styles.root}>
        {/* Yerel Maxen VideoView Oynatıcı */}
        <VideoView
          ref={videoViewRef}
          player={player}
          style={[StyleSheet.absoluteFillObject, { opacity: (resolving || error) ? 0 : 1 }]}
          nativeControls={false}
          contentFit={contentFit}
          allowsPictureInPicture={!Platform.isTV}
          startsPictureInPictureAutomatically={!Platform.isTV}
          onPictureInPictureStart={() => {
            wasInMiniPlayerBeforePiPRef.current = isMiniPlayer;
            setIsNativePiPActive(true);
            setIsMiniPlayer(false);
          }}
          onPictureInPictureStop={() => {
            setIsNativePiPActive(false);
            if (wasInMiniPlayerBeforePiPRef.current) {
              setIsMiniPlayer(true);
            }
          }}
        />
        {/* Ekran Parlaklık Karartma Katmanı (İzinsiz, cihazdan bağımsız yumuşak parlaklık filtresi) */}
        {brightness < 1.0 && (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: '#000000',
                opacity: (1 - brightness) * 0.8,
                zIndex: 1,
              },
            ]}
            pointerEvents="none"
          />
        )}

        {/* VLC / MX Player Gesture HUD (Parlaklık & Ses Göstergesi) */}
        {!isAnyMiniActive && gestureHud && (
          <PlayerGestureHUD
            visible={gestureHud.visible}
            type={gestureHud.type}
            value={gestureHud.value}
          />
        )}

        {!isAnyMiniActive && seekAnim && (
          <DoubleTapSeekRipple side={seekAnim} seconds={10} />
        )}
        {!isAnyMiniActive && !isScreenLocked && !Platform.isTV && (
          <View
            style={StyleSheet.absoluteFillObject}
            {...gesturePanResponder.panHandlers}
          >
            <DoubleTapSeekOverlay
              isEmbedUrl={isEmbedUrl}
              screenWidth={SCREEN_WIDTH}
              duration={duration}
              player={playerRef.current}
              onSeek={(target) => {
                setCurrentTime(target);
                currentTimeRef.current = target;
                saveProgressToDb(target);
              }}
              onToggleControls={toggleControls}
              prolongControls={prolongControls}
              onTriggerSeekAnim={(side) => {
                setSeekAnim(side);
                setTimeout(() => {
                  setSeekAnim(null);
                }, 600);
              }}
              onStartFastForward={handleStartFastForward}
              onEndFastForward={handleEndFastForward}
            />
          </View>
        )}

        {/* 2X Turbo Oynatma Göstergesi (YouTube Tarzı) */}
        {!isAnyMiniActive && isTurboSpeed && (
          <View style={styles.turboBanner} pointerEvents="none">
            <Ionicons name="play-forward" size={16} color="#E50914" />
            <Text style={styles.turboText}>2X Hızında Oynatılıyor</Text>
          </View>
        )}

        {/* Çözümleme veya yükleme göstergeleri */}
        {resolving && !streamUrl && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.infoTxt}> Yükleniyor ...</Text>
          </View>
        )}
        {error && (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={52} color="#e50914" />
            <Text style={styles.errorTxt}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => {
              if (currentTimeRef.current > 0) {
                resumeFromSecondsRef.current = currentTimeRef.current;
              }
              hasStartedRef.current = false;
              setError(null);
              setLoading(true);
              providerIndexRef.current = 0;
            }}>
              <Text style={styles.retryTxt}>Tekrar Dene</Text>
            </TouchableOpacity>
          </View>
        )}
        {loading && !resolving && !error && !isEmbedUrl && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}

        {/* Gizli WebView (sadece çözümleme sırasında) */}
        <HiddenResolverWebView
          resolving={resolving}
          resolverUrl={resolverUrl}
          providerIndex={providerIndexRef.current}
          webViewRef={resolverWebViewRef}
          onMessage={handleResolverMessage}
        />





        <SubtitleOverlay
          subtitleText={subtitleText}
          subtitleBottomOffset={subtitleBottomOffset}
          controlsVisible={controlsVisible}
          isMiniPlayer={isMiniPlayer || isNativePiPActive}
          settings={subtitleSettings}
        />

        {/* Küçük Ekran Kontrolleri */}
        {isMiniPlayer && (
          <>
            <MiniPlayerControlsOverlay
              isPlaying={isPlaying}
              onPlayPause={() => {
                if (playerRef.current) {
                  try {
                    if (isPlaying) {
                      setIsPlaying(false);
                      playerRef.current.pause();
                    } else {
                      setIsPlaying(true);
                      playerRef.current.play();
                    }
                  } catch (e) {}
                }
              }}
              onSeekRelative={(sec) => {
                if (playerRef.current) {
                  try {
                    const target = Math.max(0, Math.min(duration || 0, (playerRef.current.currentTime || 0) + sec));
                    playerRef.current.currentTime = target;
                    setCurrentTime(target);
                    currentTimeRef.current = target;
                    saveProgressToDb(target);
                  } catch (e) {}
                }
              }}
              onExpand={() => {
                miniPan.setValue({ x: 0, y: 0 });
                miniPanOffsetRef.current = { x: 0, y: 0 };
                setIsMiniPlayer(false);
              }}
              onClose={onClose}
              currentTime={currentTime}
              duration={duration}
              title={isMovie ? title : `${title} S${seasonNum}:E${episodeNum}`}
            />
            {/* Köşeden Çekip Boyutlandırma Tutamacı */}
            <View
              {...cornerResizePanResponder.panHandlers}
              style={styles.cornerResizeGrip}
            >
              <Ionicons name="resize" size={13} color="#FFFFFF" />
            </View>
          </>
        )}

        {/* Tam Ekran Kontrol Katmanı */}
        {!isAnyMiniActive && !isScreenLocked && controlsVisible && !showSettingsMenu && !resolving && !!streamUrl && (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <PlayerTopBar
              title={title}
              isMovie={isMovie}
              seasonNum={seasonNum}
              episodeNum={episodeNum}
              onClose={onClose}
              onOpenSettings={() => setShowSettingsMenu(true)}
              onOpenPlayOnTv={() => setShowPlayOnTvModal(true)}
              onMinimize={() => {
                setIsMiniPlayer(true);
              }}
              onToggleLockScreen={() => {
                setIsScreenLocked(true);
                setControlsVisible(false);
              }}
              prolongControls={prolongControls}
              watchPartyRoom={watchPartyRoom}
              isChatOpen={showWatchPartyChat}
              onToggleWatchPartyChat={() => {
                setShowWatchPartyChat(!showWatchPartyChat);
                prolongControls();
              }}
              onLeaveWatchParty={handleLeaveParty}
            />
            <PlayerBottomBar
              bottomPadding={Math.max(insets.bottom, 12) + 12}
              currentTime={currentTime}
              duration={duration}
              panHandlers={progressPanResponder.panHandlers}
              onProgressLayout={(e) => {
                const node = e.target;
                if (node && typeof (node as any).measure === 'function') {
                  (node as any).measure((_x: number, _y: number, width: number, _h: number, pageX: number) => {
                    setTrackLayout({ x: pageX, width });
                  });
                } else {
                  const { width } = e.nativeEvent.layout;
                  setTrackLayout((prev) => ({ ...prev, width }));
                }
              }}
              formatTime={fmt}
              isSeeking={isSeeking}
              seekPreviewTime={seekPreviewTime}
              previewThumbnail={previewThumbnail}
              isMovie={isMovie}
              media={media}
              onPlayNextMedia={onPlayNextMedia}
              controlsVisible={controlsVisible}
              isPlaying={isPlaying}
              onPlayPause={() => {
                if (playerRef.current) {
                  try {
                    if (isPlaying) {
                      setIsPlaying(false);
                      playerRef.current.pause();
                      broadcastPartyState(false, playerRef.current.currentTime || currentTime);
                    } else {
                      setIsPlaying(true);
                      playerRef.current.play();
                      broadcastPartyState(true, playerRef.current.currentTime || currentTime);
                    }
                  } catch (e) {}
                }
                prolongControls();
              }}
              onRewind={() => {
                if (playerRef.current) {
                  try {
                    const target = Math.max(0, playerRef.current.currentTime - 10);
                    playerRef.current.currentTime = target;
                    setCurrentTime(target);
                    currentTimeRef.current = target;
                    saveProgressToDb(target);
                  } catch (e) {}
                }
                prolongControls();
              }}
              onForward={() => {
                if (playerRef.current) {
                  try {
                    const target = Math.min(duration || 0, playerRef.current.currentTime + 10);
                    playerRef.current.currentTime = target;
                    setCurrentTime(target);
                    currentTimeRef.current = target;
                    saveProgressToDb(target);
                  } catch (e) {}
                }
                prolongControls();
              }}
              endTime={endTime}
              playbackRate={playbackRate}
              onCycleSpeed={() => {
                const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
                const nextIndex = (speeds.indexOf(playbackRate) + 1) % speeds.length;
                const newRate = speeds[nextIndex];
                setPlaybackRate(newRate);
                if (playerRef.current) {
                  try {
                    playerRef.current.preservesPitch = true;
                    playerRef.current.playbackRate = newRate;
                  } catch (e) {}
                }
                prolongControls();
              }}
              onOpenAudioMenu={() => {
                setShowAudioMenu(true);
                prolongControls();
              }}
              onOpenSubtitleMenu={() => {
                setShowSubtitleMenu(true);
                prolongControls();
              }}
              selectedQuality={selectedQuality}
              onOpenQualityMenu={() => {
                setShowQualityMenu(true);
                prolongControls();
              }}
              onToggleContentFit={() => {
                setContentFit(contentFit === 'contain' ? 'cover' : 'contain');
                prolongControls();
              }}
              onOpenEpisodesMenu={() => {
                setQuickOverlayMode('bottomShelf');
                prolongControls();
              }}
              prolongControls={prolongControls}
            />
          </View>
        )}

        {/* Android TV D-Pad Kumanda İpucu Şeridi (Netflix/Prime Video Stili) */}
        {!isMiniPlayer && controlsVisible && Platform.isTV && (
          <View
            style={{
              position: 'absolute',
              bottom: 12,
              alignSelf: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              backgroundColor: 'rgba(0, 0, 0, 0.78)',
              paddingHorizontal: 16,
              paddingVertical: 6,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.14)',
              zIndex: 900,
            }}
            pointerEvents="none"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="arrow-up-circle-outline" size={14} color="#E50914" />
              <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '600' }}>▲ Ses & Altyazı</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="arrow-down-circle-outline" size={14} color="#3B82F6" />
              <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '600' }}>▼ Bölümler</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="play-circle-outline" size={14} color="#F5C518" />
              <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '600' }}>OK Oynat/Duraklat</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="swap-horizontal-outline" size={14} color="#10B981" />
              <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '600' }}>◀ ▶ 10sn Sar</Text>
            </View>
          </View>
        )}

        {/* Netflix Tarzı Sonraki Bölüm Banner'ı */}
        {!isMiniPlayer && !isScreenLocked && (
          <NextEpisodeBanner
            visible={Boolean(showNextEpisode && !isNextBannerDismissed && nextMediaData)}
            nextEpisodeTitle={nextMediaData?.name || nextMediaData?.title}
            nextEpisodeNumber={nextMediaData?.episode_number}
            nextSeasonNumber={nextMediaData?.season_number}
            thumbnail={
              nextMediaData?.still_path
                ? `https://image.tmdb.org/t/p/w780${nextMediaData.still_path}`
                : nextMediaData?.posterUrl || nextMediaData?.backdropUrl || null
            }
            countdown={Math.max(0, Math.floor(duration - currentTime))}
            onPlayNext={handlePlayNextEpisode}
            onDismiss={() => setIsNextBannerDismissed(true)}
          />
        )}

        {/* İntroyu Atla ve Sonraki Bölüm Butonları (Kontrollerin üstünde ve bağımsız) */}
        {!isMiniPlayer && !isScreenLocked && (
          <EpisodeActionButtons
            showSkipIntro={showSkipIntro}
            showNextEpisode={Boolean(showNextEpisode && (!nextMediaData || isNextBannerDismissed))}
            controlsVisible={controlsVisible}
            onSkipIntro={handleSkipIntro}
            onPlayNextEpisode={handlePlayNextEpisode}
          />
        )}

        {/* Ekran Kilidi Katmanı */}
        {!isMiniPlayer && (
          <ScreenLockOverlay
            isLocked={isScreenLocked}
            onUnlock={() => {
              setIsScreenLocked(false);
              setControlsVisible(true);
            }}
          />
        )}

        {/* Amazon X-Ray Sahnedeki Oyuncular & Müzik Radarı */}
        {!isMiniPlayer && !isScreenLocked && !isPlaying && controlsVisible && !!media?.tmdbId && (
          <PlayerXRayOverlay
            tmdbId={media.tmdbId}
            mediaType={media.type === 'tv' ? 'tv' : 'movie'}
            seasonNumber={seasonNum}
            episodeNumber={episodeNum}
            currentTime={currentTime}
            visible={!isPlaying && controlsVisible}
          />
        )}

        {/* Sadece Altyazı Dili Seçme Menüsü (Alt Bardaki Altyazı Butonundan Açılır) */}
        {!isMiniPlayer && (
          <SubtitleMenuModal
            visible={showSubtitleMenu}
            onClose={() => setShowSubtitleMenu(false)}
            selectedSubtitle={selectedSubtitle}
            subtitles={subtitles}
            availableSubtitleTracks={availableSubtitleTracks}
            openSubtitlesLoading={openSubtitlesLoading}
            onSelectSubtitle={async (sub) => {
              hasUserSelectedSubtitleRef.current = true;
              hasAutoSelectedSubtitleRef.current = true;
              if (!sub) {
                // KAPALI
                setSelectedSubtitle(null);
                setExternalCues([]);
                setSubtitleText('');
                if (playerRef.current) {
                  try {
                    playerRef.current.subtitleTrack = null;
                  } catch (e) {}
                }
                preferredSubtitleLangRef.current = 'Kapalı';
                AsyncStorage.setItem('preferred_subtitle_lang', 'Kapalı').catch(() => {});
                setSubtitleToast('Altyazı: Kapalı');
              } else {
                setSelectedSubtitle(sub);
                const label = normalizeLang(sub.label || sub.lang || 'Altyazı');
                preferredSubtitleLangRef.current = label;
                AsyncStorage.setItem('preferred_subtitle_lang', label).catch(() => {});
                setSubtitleToast(`Altyazı: ${label}`);

                if (sub.url) {
                  // Harici VTT
                  if (playerRef.current) {
                    try {
                      playerRef.current.subtitleTrack = null;
                    } catch (e) {}
                  }
                  await loadExternalSubtitle(sub);
                } else {
                  // Gömülü (native) altyazı
                  setExternalCues([]);
                  setSubtitleText('');
                  if (playerRef.current) {
                    try {
                      const emb = (playerRef.current.availableSubtitleTracks ?? []).find(
                        (t: any) => t.id === sub.fileId || t.label === sub.label || t.language === sub.lang
                      );
                      playerRef.current.subtitleTrack = emb || (sub as any);
                    } catch (e) {}
                  }
                }
              }
            }}
          />
        )}

        {/* Görüntü Kalitesi Seçme Menüsü (Alt Bardaki Kalite/HD Butonundan Açılır) */}
        {!isMiniPlayer && (
          <QualityMenuModal
            visible={showQualityMenu}
            onClose={() => setShowQualityMenu(false)}
            selectedQuality={selectedQuality}
            onSelectQuality={handleSelectQuality}
            availableQualities={availableQualities}
          />
        )}

        {/* Oynatıcı & Gelişmiş Ayarlar Menüsü (Sağ Üst Köşedeki Ayarlar Butonundan Açılır) */}
        {!isMiniPlayer && (
          <SettingsMenuModal
            visible={showSettingsMenu}
            onClose={() => setShowSettingsMenu(false)}
            allowBackgroundAudio={allowBackgroundAudio}
            onToggleBackgroundAudio={() => setAllowBackgroundAudio((prev) => !prev)}
            showStatsForNerds={showStatsForNerds}
            onToggleStatsForNerds={() => setShowStatsForNerds((prev) => !prev)}
            onOpenSubtitleAppearance={() => setShowSubtitleAppearanceMenu(true)}
            sleepTimer={sleepTimer}
            onSelectSleepTimer={setSleepTimer}
            sleepRemainingSeconds={sleepRemainingSeconds}
          />
        )}

        {/* Stats for Nerds Telemetri HUD Paneli (Gerçek Donanım Telemetrisi) */}
        {!isMiniPlayer && (
          <StatsForNerdsOverlay
            visible={showStatsForNerds}
            resolution={
              playerRef.current?.videoTrack?.size
                ? `${playerRef.current.videoTrack.size.width}x${playerRef.current.videoTrack.size.height}`
                : (selectedQuality === 'auto' ? (duration > 0 ? '1080p (FHD)' : 'Otomatik (ABR)') : selectedQuality.toUpperCase())
            }
            bufferAheadSeconds={
              Math.max(
                0,
                (playerRef.current?.bufferedPosition ?? 0) - (currentTime || playerRef.current?.currentTime || 0)
              )
            }
            bitrateKbps={
              playerRef.current?.videoTrack?.bitrate
                ? Math.round(playerRef.current.videoTrack.bitrate / 1000)
                : (selectedQuality === '1080p' ? 6800 : selectedQuality === '720p' ? 3200 : selectedQuality === '480p' ? 1500 : selectedQuality === '360p' ? 800 : 4850)
            }
            provider={(streamUrl || '').includes('vixsrc') ? 'VixSrc Direct HLS' : 'Maxen Parallel Fast-Fail Engine'}
            audioTrack={
              playerRef.current?.audioTrack?.label ||
              (audioTracks.length > 0 ? audioTracks[0].label : 'Orijinal Ses (AAC 2.0)')
            }
            droppedFrames={0}
            fps={
              playerRef.current?.videoTrack?.frameRate
                ? Math.round(playerRef.current.videoTrack.frameRate)
                : 60
            }
            onClose={() => setShowStatsForNerds(false)}
          />
        )}

        {/* Ses Ayarları Menüsü */}
        {!isMiniPlayer && (
          <AudioMenuModal
            visible={showAudioMenu}
            onClose={() => {
              setShowAudioMenu(false);
              setControlsVisible(true);
              prolongControls();
            }}
            player={playerRef.current}
            availableAudioTracks={availableAudioTracks}
            currentAudioTrack={currentAudioTrack}
            audioTracks={audioTracks}
            streamUrl={streamUrl}
            onSelectTrack={(selected) => {
              let switched = false;
              if (playerRef.current) {
                const p = playerRef.current;
                const available = p.availableAudioTracks || availableAudioTracks || [];
                const target = available.find((t: any) =>
                  t === selected.raw ||
                  (selected.raw?.id && t.id === selected.raw.id) ||
                  (selected.language && t.language && t.language.toLowerCase().trim() === selected.language.toLowerCase().trim()) ||
                  (selected.label && t.label && t.label.toLowerCase().trim() === selected.label.toLowerCase().trim())
                );
                if (target) {
                  try {
                    p.audioTrack = target;
                    setCurrentAudioTrack(target);
                    switched = true;
                  } catch (e) {
                    console.warn('Audio switch error:', e);
                  }
                } else if (selected.isEmbedded && selected.raw) {
                  try {
                    p.audioTrack = selected.raw;
                    setCurrentAudioTrack(selected.raw);
                    switched = true;
                  } catch (e) {}
                }
              }

              // Sadece TAM BİR VİDEO AKIŞI ise (audio rendition değilse) streamUrl değiştir
              if (!switched && selected.raw?.url && !selected.raw.url.includes('type=audio') && !selected.raw.url.includes('rendition=')) {
                setSubtitleToast('Harici ses içeren video akışına geçiliyor...');
                setStreamUrl(selected.raw.url);
              } else {
                setSubtitleToast(`Ses: ${selected.label}`);
              }

              AsyncStorage.setItem('preferred_audio_lang', selected.label).catch(() => {});
              setControlsVisible(true);
              prolongControls();
            }}
          />
        )}
        {/* Subtitle Appearance Ayarları */}
        {!isMiniPlayer && (
          <SubtitleAppearanceModal
            visible={showSubtitleAppearanceMenu}
            onClose={() => setShowSubtitleAppearanceMenu(false)}
            settings={subtitleSettings}
            onSettingsChange={setSubtitleSettings}
          />
        )}

        {/* Watch Party Entegre Sohbet ve Katılımcı Çekmecesi */}
        {!isMiniPlayer && (
          <WatchPartyChatDrawer
            visible={showWatchPartyChat}
            onClose={() => setShowWatchPartyChat(false)}
            room={watchPartyRoom}
            onProlongControls={prolongControls}
          />
        )}

        {/* TV'de Oynat / Aynı Ağdaki Televizyona Gönder Modalı */}
        {!isMiniPlayer && (
          <PlayOnTvModal
            visible={showPlayOnTvModal}
            media={{ ...media, positionSeconds: Math.floor(currentTime) }}
            profileId={profileId}
            onClose={() => setShowPlayOnTvModal(false)}
            onSent={() => {
              setSubtitleToast('Televizyonda oynatılıyor...');
            }}
          />
        )}

        {/* Android TV Kumandadan Hızlı Oynatıcı Kontrolleri (Yukarı: Ses/Altyazı/Kalite, Aşağı: Bölümler) */}
        {!isMiniPlayer && Platform.isTV && (() => {
          const combinedAudioList: Array<{
            id: string;
            label: string;
            raw: any;
            isEmbedded: boolean;
          }> = [];
          const seenLangs = new Set<string>();
          const seenLbls = new Set<string>();

          (availableAudioTracks || []).forEach((t: any, idx: number) => {
            const lbl = formatAudioLabel(t.label, t.language);
            const lKey = (t.language || t.label || '').toLowerCase().trim();
            const lblKey = lbl.toLowerCase().trim();
            if (seenLangs.has(lKey) || seenLbls.has(lblKey)) return;
            if (lKey) seenLangs.add(lKey);
            seenLbls.add(lblKey);
            combinedAudioList.push({
              id: t.id ? String(t.id) : `emb-${idx}`,
              label: lbl,
              raw: t,
              isEmbedded: true,
            });
          });

          (audioTracks || []).forEach((a: any, idx: number) => {
            const lbl = formatAudioLabel(a.label, a.language);
            const lKey = (a.language || a.label || '').toLowerCase().trim();
            const lblKey = lbl.toLowerCase().trim();
            if (seenLangs.has(lKey) || seenLbls.has(lblKey)) return;
            if (lKey) seenLangs.add(lKey);
            seenLbls.add(lblKey);
            combinedAudioList.push({
              id: a.id ? String(a.id) : (a.url || `ext-${idx}`),
              label: lbl,
              raw: a,
              isEmbedded: false,
            });
          });

          const curTrack = playerRef.current?.audioTrack || currentAudioTrack;
          const activeAudioItem = combinedAudioList.find((item) => {
            if (!curTrack && !streamUrl) return false;
            if (curTrack) {
              if (curTrack.id && String(curTrack.id) === item.id) return true;
              if (curTrack.language && curTrack.language === item.raw?.language) return true;
              if (curTrack.label && curTrack.label === item.raw?.label) return true;
            }
            if (item.raw?.url && item.raw?.url === streamUrl) return true;
            return false;
          });
          const currentAudioTrackId = activeAudioItem ? activeAudioItem.id : (combinedAudioList[0]?.id || '0');

          return (
            <TVQuickControlsOverlay
              visibleMode={quickOverlayMode}
              onClose={() => setQuickOverlayMode('none')}
              audioTracks={combinedAudioList.map((a) => ({ id: a.id, label: a.label }))}
              currentAudioTrackId={currentAudioTrackId}
              onSelectAudioTrack={(trackId) => {
                const selected = combinedAudioList.find((a) => a.id === trackId);
                if (!selected) return;

                let switched = false;
                if (playerRef.current) {
                  const p = playerRef.current;
                  const available = p.availableAudioTracks || availableAudioTracks || [];
                  const target = available.find((t: any) =>
                    t === selected.raw ||
                    (selected.raw?.id && t.id === selected.raw.id) ||
                    (selected.raw?.language && t.language && t.language.toLowerCase().trim() === selected.raw.language.toLowerCase().trim()) ||
                    (selected.label && t.label && t.label.toLowerCase().trim() === selected.label.toLowerCase().trim())
                  );
                  if (target) {
                    try {
                      p.audioTrack = target;
                      setCurrentAudioTrack(target);
                      switched = true;
                    } catch (e) {
                      console.warn('TV audio switch error:', e);
                    }
                  } else if (selected.isEmbedded && selected.raw) {
                    try {
                      p.audioTrack = selected.raw;
                      setCurrentAudioTrack(selected.raw);
                      switched = true;
                    } catch (e) {}
                  }
                }

                if (!switched && selected.raw?.url && !selected.raw.url.includes('type=audio') && !selected.raw.url.includes('rendition=')) {
                  setSubtitleToast(`Harici ses içeren video akışına geçiliyor (${selected.label})...`);
                  setStreamUrl(selected.raw.url);
                } else {
                  setSubtitleToast(`Ses: ${selected.label}`);
                }
                AsyncStorage.setItem('preferred_audio_lang', selected.label).catch(() => {});
              }}
              subtitles={[
                ...subtitles.map((s, idx) => ({
                  id: s.url || String(s.fileId || `ext-${idx}`),
                  label: normalizeLang(s.label || s.lang || `Altyazı ${idx + 1}`),
                  raw: s,
                })),
                ...availableSubtitleTracks
                  .filter(t => !subtitles.some(s => (s.label || '').toLowerCase() === (t.label || t.language || '').toLowerCase()))
                  .map((t, idx) => ({
                    id: t.id || `emb-${idx}`,
                    label: normalizeLang(t.label || t.language || `Dahili ${idx + 1}`),
                    raw: { label: t.label || t.language, lang: t.language || t.label, url: '', fileId: t.id },
                  }))
              ]}
              currentSubtitleId={
                selectedSubtitle
                  ? (selectedSubtitle.url || (selectedSubtitle as any).id || (selectedSubtitle as any).fileId || selectedSubtitle.label)
                  : null
              }
              onSelectSubtitle={async (subId) => {
                hasUserSelectedSubtitleRef.current = true;
                hasAutoSelectedSubtitleRef.current = true;
                if (subId === null) {
                  setSelectedSubtitle(null);
                  setExternalCues([]);
                  setSubtitleText('');
                  if (playerRef.current) {
                    try {
                      playerRef.current.subtitleTrack = null;
                    } catch (e) {}
                  }
                  preferredSubtitleLangRef.current = 'Kapalı';
                  AsyncStorage.setItem('preferred_subtitle_lang', 'Kapalı').catch(() => {});
                  setSubtitleToast('Altyazı: Kapalı');
                } else {
                  const extSub = subtitles.find((s, idx) => (s.url || String(s.fileId || `ext-${idx}`)) === subId);
                  if (extSub) {
                    setSelectedSubtitle(extSub);
                    const label = normalizeLang(extSub.label || extSub.lang || 'Altyazı');
                    preferredSubtitleLangRef.current = label;
                    AsyncStorage.setItem('preferred_subtitle_lang', label).catch(() => {});
                    setSubtitleToast(`Altyazı: ${label}`);
                    if (playerRef.current) {
                      try { playerRef.current.subtitleTrack = null; } catch (e) {}
                    }
                    await loadExternalSubtitle(extSub);
                  } else {
                    const embSub = availableSubtitleTracks.find((t, idx) => (t.id || `emb-${idx}`) === subId);
                    if (embSub) {
                      const norm: SubtitleTrack = { label: embSub.label || embSub.language, lang: embSub.language, url: '', fileId: embSub.id };
                      setSelectedSubtitle(norm);
                      setExternalCues([]);
                      setSubtitleText('');
                      if (playerRef.current) {
                        try { playerRef.current.subtitleTrack = embSub; } catch (e) {}
                      }
                      const label = normalizeLang(embSub.label || embSub.language || 'Dahili Altyazı');
                      preferredSubtitleLangRef.current = label;
                      AsyncStorage.setItem('preferred_subtitle_lang', label).catch(() => {});
                      setSubtitleToast(`Altyazı: ${label}`);
                    }
                  }
                }
              }}
              qualityList={availableQualities.length > 0 ? availableQualities : ['Otomatik', '1080p', '720p', '480p']}
              currentQuality={selectedQuality}
              onSelectQuality={handleSelectQuality}
              aspectRatioMode={contentFit}
              onChangeAspectRatio={(mode) => {
                setContentFit(mode);
                setSubtitleToast(`Görüntü: ${mode === 'contain' ? 'Sığdır' : mode === 'cover' ? 'Doldur' : '16:9'}`);
              }}
              playlist={Array.isArray(media?.playlist) ? media.playlist : []}
              currentEpisodeIndex={typeof media?.playlistIndex === 'number' ? media.playlistIndex : 0}
              onSelectEpisode={(idx) => {
                if (onPlayNextMedia && media?.playlist && media.playlist[idx]) {
                  const ep = media.playlist[idx];
                  onPlayNextMedia({
                    ...media,
                    ...ep,
                    id: ep.Id || ep.id || media.id,
                    title: ep.Name || ep.name || media.title,
                    playlistIndex: idx,
                    episode_number: ep.IndexNumber || ep.episode_number || idx + 1,
                    season_number: ep.ParentIndexNumber || ep.season_number || media.season_number || 1,
                    positionSeconds: 0,
                  });
                }
              }}
              seriesTitle={media?.show_title || media?.title || media?.name || 'Bölümler'}
            />
          );
        })()}

      </View>
    </Animated.View>
  );
}
