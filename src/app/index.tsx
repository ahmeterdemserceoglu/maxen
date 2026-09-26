import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, BackHandler, Platform, Text, Alert, useWindowDimensions, ToastAndroid } from 'react-native';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';
import { TVSidebar } from '@/components/TVSidebar';
import { TVFocusGroup } from '@/components/TVFocusGroup';
import { NetflixWebNavbar } from '@/components/NetflixWebNavbar';
import { useAuth } from '@/contexts/AuthContext';

import { LoginView } from '@/views/LoginView';
import { HomeView } from '@/views/HomeView';
import { SearchView } from '@/views/SearchView';
import { SettingsView } from '@/views/SettingsView';
import { VideoPlayerView } from '@/views/VideoPlayerView';
import { DetailView } from '@/views/DetailView';
import { ActorDetailView } from '@/views/ActorDetailView';
import { ReelsFeedView } from '@/views/ReelsFeedView';
import { ComingSoonView } from '@/views/ComingSoonView';
import { DownloadsView } from '@/views/DownloadsView';
import { SocialView } from '@/views/SocialView';
import { MediaHubView } from '@/views/MediaHubView';
import { DiscoveryHubModal } from '@/components/DiscoveryHubModal';
import { JoinWatchPartyModal } from '@/components/JoinWatchPartyModal';
import { WatchPartyInviteModal } from '@/components/WatchPartyInviteModal';
import { UsernameSetupModal } from '@/components/UsernameSetupModal';
import { CrossDeviceHandoffBanner } from '@/components/CrossDeviceHandoffBanner';
import { VirtualTvRemoteModal } from '@/components/VirtualTvRemoteModal';
import { networkService } from '@/services/networkService';
import {
  subscribeToCrossDeviceHandoff,
  getOrCreateDeviceId,
  type PlaybackSessionData,
} from '@/services/crossDeviceHandoffService';
import { getUserProfile, subscribeToFriends } from '@/services/socialService';
import { confirmTvSessionFromMobile } from '@/services/tvAuthService';
import {
  TV_HEARTBEAT_MS,
  ackTvPlayCommand,
  heartbeatTvDevice,
  registerTvDevice,
  subscribeToTvPlayCommands,
  subscribeToTvRemoteActions,
  unregisterTvDevice,
} from '@/services/tvRemotePlayService';
import { useUiStore, TabKey } from '@/store/uiStore';
import { usePlayerStore } from '@/store/playerStore';
import { TVScreensaver } from '@/components/TVScreensaver';
import { onUserActivity, reportUserActivity } from '@/utils/userActivity';

type TabConfig = {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
};

const TABS: TabConfig[] = [
  { key: 'home', label: 'Ana Sayfa', icon: 'home-outline', activeIcon: 'home' },
  { key: 'media', label: 'Medya', icon: 'film-outline', activeIcon: 'film' },
  { key: 'social', label: 'Sosyal', icon: 'people-outline', activeIcon: 'people' },
  { key: 'search', label: 'Keşfet', icon: 'compass-outline', activeIcon: 'compass' },
  { key: 'settings', label: 'Ayarlar', icon: 'settings-outline', activeIcon: 'settings' },
];

export default function Index() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const isTV = Platform.isTV;
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 768;
  const { user, loading, activeProfile, clearProfile, profiles } = useAuth();
  const profileId = activeProfile?.id ?? 'global';

  const activeTab = useUiStore((state) => state.activeTab);
  const setActiveTab = useUiStore((state) => state.setActiveTab);
  const activeVideo = useUiStore((state) => state.activeVideo);
  const setActiveVideo = useUiStore((state) => state.setActiveVideo);
  const isMiniPlayer = useUiStore((state) => state.isMiniPlayer);
  const openVideo = useUiStore((state) => state.openVideo);
  const closeVideo = useUiStore((state) => state.closeVideo);
  const activeDetail = useUiStore((state) => state.activeDetail);
  const setActiveDetail = useUiStore((state) => state.setActiveDetail);
  const openDetail = useUiStore((state) => state.openDetail);
  const closeDetail = useUiStore((state) => state.closeDetail);
  const activeActor = useUiStore((state) => state.activeActor);
  const setActiveActor = useUiStore((state) => state.setActiveActor);
  const openActor = useUiStore((state) => state.openActor);
  const closeActor = useUiStore((state) => state.closeActor);
  const showDiscoveryHub = useUiStore((state) => state.showDiscoveryHub);
  const setShowDiscoveryHub = useUiStore((state) => state.setShowDiscoveryHub);
  const openDiscoveryHub = useUiStore((state) => state.openDiscoveryHub);
  const closeDiscoveryHub = useUiStore((state) => state.closeDiscoveryHub);
  const showReelsModal = useUiStore((state) => state.showReelsModal);
  const setShowReelsModal = useUiStore((state) => state.setShowReelsModal);
  const openReels = useUiStore((state) => state.openReels);
  const closeReels = useUiStore((state) => state.closeReels);
  const showComingSoonModal = useUiStore((state) => state.showComingSoonModal);
  const setShowComingSoonModal = useUiStore((state) => state.setShowComingSoonModal);
  const openComingSoon = useUiStore((state) => state.openComingSoon);
  const closeComingSoon = useUiStore((state) => state.closeComingSoon);
  const showDownloadsModal = useUiStore((state) => state.showDownloadsModal);
  const openDownloads = useUiStore((state) => state.openDownloads);
  const closeDownloads = useUiStore((state) => state.closeDownloads);
  const showJoinPartyModal = useUiStore((state) => state.showJoinPartyModal);
  const setShowJoinPartyModal = useUiStore((state) => state.setShowJoinPartyModal);
  const showVirtualRemoteModal = useUiStore((state) => state.showVirtualRemoteModal);
  const setShowVirtualRemoteModal = useUiStore((state) => state.setShowVirtualRemoteModal);
  const openWatchParty = useUiStore((state) => state.openWatchParty);
  const returnToModal = useUiStore((state) => state.returnToModal);
  const setReturnToModal = useUiStore((state) => state.setReturnToModal);
  const clearModals = useUiStore((state) => state.clearModals);
  const pendingFriendRequestsCount = useUiStore((state) => state.pendingFriendRequestsCount);
  const setPendingFriendRequestsCount = useUiStore((state) => state.setPendingFriendRequestsCount);

  const [reelsActiveIndex, setReelsActiveIndex] = useState(0);
  const [showUsernameSetup, setShowUsernameSetup] = useState(false);
  const [handoffSession, setHandoffSession] = useState<PlaybackSessionData | null>(null);
  const [isOffline, setIsOffline] = useState(!networkService.getStatus());
  const lastBackPressRef = useRef<number>(0);
  const videoOriginDetailRef = useRef<any>(null);
  const handledWatchNextUrlRef = useRef<string | null>(null);

  const handleCloseActiveVideo = useCallback(() => {
    const originDetail = videoOriginDetailRef.current;
    videoOriginDetailRef.current = null;
    closeVideo();
    if (originDetail) {
      requestAnimationFrame(() => setActiveDetail(originDetail));
    }
  }, [closeVideo, setActiveDetail]);

  useEffect(() => {
    const unsub = networkService.subscribe((online) => {
      const offlineNow = !online;
      setIsOffline(offlineNow);
      if (offlineNow) {
        openDownloads();
      }
    });
    return () => unsub();
  }, [openDownloads]);

  useEffect(() => {
    if (user?.uid) {
      getUserProfile(user.uid).then((profile) => {
        if (!profile || !profile.username) {
          setShowUsernameSetup(true);
        }
      });

      const unsub = subscribeToFriends(user.uid, (friendsList) => {
        const incoming = friendsList.filter((f) => f.status === 'pending_received').length;
        setPendingFriendRequestsCount(incoming);
      });

      return () => unsub();
    }
  }, [user?.uid, setPendingFriendRequestsCount]);

  // Cihazlar arası kesintisiz devam bildirimi (Cross-Device Handoff)
  useEffect(() => {
    if (!user?.uid) return;
    let unsub: (() => void) | undefined;

    getOrCreateDeviceId().then((currentDeviceId) => {
      unsub = subscribeToCrossDeviceHandoff(
        user.uid,
        profileId,
        currentDeviceId,
        (session) => {
          setHandoffSession(session);
        }
      );
    });

    return () => {
      unsub?.();
    };
  }, [user?.uid, profileId]);

  // Android TV: aynı hesapla çevrimiçi ol, telefondan gelen oynat & kumanda komutlarını dinle
  const isTVDevice = isTV || (Platform.OS === 'android' && width >= 900);
  useEffect(() => {
    if (!isTVDevice || !user?.uid) return;

    let cancelled = false;
    let unsubPlay: (() => void) | undefined;
    let unsubRemote: (() => void) | undefined;
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

    (async () => {
      try {
        const deviceId = await registerTvDevice({
          ownerUid: user.uid,
          deviceName: 'Maxen TV',
        });
        if (cancelled) return;

        unsubPlay = subscribeToTvPlayCommands(deviceId, (command) => {
          openVideo(command.media);
          ackTvPlayCommand(deviceId);
        });

        unsubRemote = subscribeToTvRemoteActions(deviceId, (action) => {
          // Oynatıcı ve ekranların anlık dinleyebilmesi için store'a yayınla
          useUiStore.getState().dispatchRemoteAction(action.type, action.payload);

          if (action.type === 'back') {
            if (activeVideo) handleCloseActiveVideo();
            else if (activeActor) closeActor();
            else if (activeDetail) closeDetail();
            else if (showDiscoveryHub) closeDiscoveryHub();
            else if (showReelsModal) closeReels();
            else if (showComingSoonModal) closeComingSoon();
          } else if (action.type === 'home') {
            clearModals();
            setActiveTab('home');
          } else if (action.type === 'tab_switch' && action.payload) {
            clearModals();
            setActiveTab(action.payload);
          } else if (action.type === 'search_query' && action.payload) {
            clearModals();
            setActiveTab('search');
          }
        });

        heartbeatTimer = setInterval(() => {
          heartbeatTvDevice(user.uid).catch(() => {});
        }, TV_HEARTBEAT_MS);
      } catch (e) {
        console.warn('TV remote play register error:', e);
      }
    })();

    return () => {
      cancelled = true;
      unsubPlay?.();
      unsubRemote?.();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    };
  }, [
    isTVDevice,
    user?.uid,
    openVideo,
    handleCloseActiveVideo,
    activeVideo,
    activeActor,
    activeDetail,
    showDiscoveryHub,
    showReelsModal,
    showComingSoonModal,
    closeDetail,
    closeActor,
    closeDiscoveryHub,
    closeReels,
    closeComingSoon,
    clearModals,
    setActiveTab,
  ]);

  // TV Ekran Koruyucu (OLED Ambient Screensaver) 3 dk (180.000 ms) inaktivite takibi
  const [showScreensaver, setShowScreensaver] = useState(false);
  const playerStatus = usePlayerStore((s) => s.status);

  useEffect(() => {
    if (!isTV) return;

    // SADECE ana menüde (home sekmesinde) hiçbir video, detay veya modal açık değilken çalışır
    const isIdleInMainMenu =
      !activeVideo &&
      !activeDetail &&
      !activeActor &&
      !showReelsModal &&
      !showComingSoonModal &&
      activeTab === 'home';

    if (!isIdleInMainMenu) {
      setShowScreensaver(false);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setShowScreensaver(true);
      }, 3 * 60 * 1000); // 3 dakika inaktivite
    };

    resetTimer();

    const unsub = onUserActivity(() => {
      setShowScreensaver(false);
      resetTimer();
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [
    isTV,
    activeVideo,
    activeDetail,
    activeActor,
    showReelsModal,
    showComingSoonModal,
    activeTab,
  ]);

  // Handle Android TV Watch Next and mobile TV-pair deep links.
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      const url = event.url;
      if (!url) return;

      if (url.includes('maxen://watch')) {
        if (!user?.uid || handledWatchNextUrlRef.current === url) return;
        try {
          const parsed = Linking.parse(url);
          const value = (key: string) => {
            const raw = parsed.queryParams?.[key];
            return Array.isArray(raw) ? raw[0] : raw;
          };
          const id = String(value('id') || '').trim();
          if (!id) return;

          const type = value('type') === 'tv' ? 'tv' : 'movie';
          const season = Number(value('season') || 1);
          const episode = Number(value('episode') || 1);
          const position = Number(value('position') || 0);
          const title = String(value('title') || 'Maxen');
          const poster = value('poster');

          handledWatchNextUrlRef.current = url;
          clearModals();
          openVideo({
            id,
            tmdbId: id,
            show_id: type === 'tv' ? id : undefined,
            type,
            title,
            show_title: type === 'tv' ? title : undefined,
            season_number: type === 'tv' ? season : undefined,
            episode_number: type === 'tv' ? episode : undefined,
            positionSeconds: Number.isFinite(position) ? position : 0,
            posterUrl: typeof poster === 'string' ? poster : undefined,
          });
          return;
        } catch (e) {
          console.warn('Watch Next deep link parsing error:', e);
        }
      }

      if (url.includes('tv-pair') || url.includes('code=')) {
        try {
          const parsed = Linking.parse(url);
          const rawCode = (parsed.queryParams?.code as string) || '';
          const code = rawCode.trim().toUpperCase();

          if (code && code.length === 6) {
            if (user?.uid) {
              const res = await confirmTvSessionFromMobile(
                code,
                user.uid,
                user.email || undefined,
                activeProfile?.id,
                user.displayName || user.email?.split('@')[0] || undefined,
                profiles
              );
              if (res.success) {
                Alert.alert('TV Bağlantısı Başarılı! 🎉', 'TV ekranınızda oturum açıldı.');
              } else {
                Alert.alert('Bağlantı Uyarısı', res.error || 'TV eşleşmesi onaylanamadı.');
              }
            } else {
              Alert.alert('Giriş Yapın', 'TV eşleşmesini onaylamak için önce telefonunuzda oturum açmış olmalısınız.');
            }
          }
        } catch (e) {
          console.warn('TV deep link parsing error:', e);
        }
      }
    };

    const sub = Linking.addEventListener('url', handleUrl);

    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) {
        handleUrl({ url: initialUrl });
      }
    });

    return () => {
      sub.remove();
    };
  }, [user?.uid, user?.email, user?.displayName, activeProfile?.id, clearModals, openVideo, profiles]);

  useEffect(() => {
    const onBackPress = () => {
      // 0. Alt Modallar
      if (showJoinPartyModal) {
        setShowJoinPartyModal(false);
        return true;
      }
      if (showVirtualRemoteModal) {
        setShowVirtualRemoteModal(false);
        return true;
      }
      if (showDownloadsModal) {
        if (!isOffline) {
          closeDownloads();
          return true;
        }
        const now = Date.now();
        if (now - lastBackPressRef.current < 2000) {
          BackHandler.exitApp();
        } else {
          lastBackPressRef.current = now;
          if (Platform.OS === 'android') {
            ToastAndroid.show('Çıkmak için tekrar basın', ToastAndroid.SHORT);
          }
        }
        return true;
      }
      // 1. activeVideo (closes video player)
      if (activeVideo) {
        handleCloseActiveVideo();
        return true;
      }
      // 2. activeActor (closes actor detail and restores parent modal if returnToModal is set)
      if (activeActor) {
        closeActor();
        return true;
      }
      // 3. activeDetail (closes detail view and smoothly returns to parent modal if returnToModal is set)
      if (activeDetail) {
        closeDetail();
        return true;
      }
      // 4. showDiscoveryHub (closes discovery hub modal)
      if (showDiscoveryHub) {
        closeDiscoveryHub();
        return true;
      }
      // 5. showReelsModal (closes reels modal)
      if (showReelsModal) {
        setReelsActiveIndex(0);
        closeReels();
        setReturnToModal(null);
        return true;
      }
      // 6. showComingSoonModal (closes coming soon modal)
      if (showComingSoonModal) {
        closeComingSoon();
        setReturnToModal(null);
        return true;
      }
      // 7. Ana sayfada değilsek önce Ana Sayfaya dön
      if (activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }
      // 8. Ana sayfadayız ve açık modal yok: Çift tıklama ile güvenli çıkış
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPressRef.current = now;
      if (Platform.OS === 'android') {
        ToastAndroid.show('Çıkmak için tekrar basın', ToastAndroid.SHORT);
      }
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    let popHandler: any;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      popHandler = () => {
        onBackPress();
      };
      window.addEventListener('popstate', popHandler);
    }

    return () => {
      subscription.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined' && popHandler) {
        window.removeEventListener('popstate', popHandler);
      }
    };
  }, [
    showJoinPartyModal,
    showVirtualRemoteModal,
    showDownloadsModal,
    activeVideo,
    activeActor,
    activeDetail,
    showDiscoveryHub,
    showReelsModal,
    showComingSoonModal,
    activeTab,
    handleCloseActiveVideo,
    closeActor,
    closeDetail,
    closeDiscoveryHub,
    closeReels,
    closeComingSoon,
    closeDownloads,
    setActiveTab,
    setReturnToModal,
    setShowJoinPartyModal,
    setShowVirtualRemoteModal,
    setReelsActiveIndex,
  ]);

  const handleChangeProfile = useCallback(async () => {
    clearModals();
    await clearProfile();
  }, [clearProfile, clearModals]);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'home':
        return <HomeView key="tv-home" activeTab="home" profileId={profileId} />;
      case 'movies':
        return isTV ? (
          <HomeView key="tv-movies" activeTab="movies" profileId={profileId} />
        ) : (
          <MediaHubView onSelectMedia={(media) => openDetail(media)} />
        );
      case 'tv':
        return isTV ? (
          <HomeView key="tv-series" activeTab="tv" profileId={profileId} />
        ) : (
          <MediaHubView onSelectMedia={(media) => openDetail(media)} />
        );
      case 'media':
        return <MediaHubView onSelectMedia={(media) => openDetail(media)} />;
      case 'social':
        return <SocialView />;
      case 'search':
        return <SearchView profileId={profileId} />;
      case 'settings':
        return activeProfile ? (
          <SettingsView activeProfile={activeProfile} onChangeProfile={handleChangeProfile} />
        ) : null;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={[styles.splash, { backgroundColor: theme.background }]}>
        <ThemedText style={{ fontSize: 36, fontWeight: '900', color: '#E50914', letterSpacing: 4 }}>
          MAXEN
        </ThemedText>
        <ActivityIndicator size="large" color="#E50914" style={{ marginTop: 24 }} />
      </View>
    );
  }

  if (!user || !activeProfile) {
    return <LoginView />;
  }

  const bottomInset = Math.max(insets.bottom, 8);
  const isNoModalOpen =
    !showDiscoveryHub &&
    !showReelsModal &&
    !showComingSoonModal &&
    !showDownloadsModal &&
    !activeDetail &&
    !activeActor &&
    (!activeVideo || isMiniPlayer);

  return (
    <View
      style={[styles.container, { backgroundColor: theme.background }]}
      onStartShouldSetResponderCapture={() => {
        reportUserActivity();
        return false;
      }}
    >
      <TVFocusGroup
        style={[
          styles.viewContainer,
          isTV && styles.tvViewContainer,
          isDesktopWeb && styles.desktopWebViewContainer,
        ]}
      >
        {(!activeVideo || isMiniPlayer) && !activeDetail && !activeActor ? renderActiveView() : null}
      </TVFocusGroup>

      {/* Netflix Top Navigation Bar for Desktop Web */}
      {isDesktopWeb && isNoModalOpen && (
        <NetflixWebNavbar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            if (tab === 'search') {
              openDiscoveryHub();
            } else {
              setActiveTab(tab);
            }
          }}
          activeProfile={activeProfile}
          onChangeProfile={handleChangeProfile}
          onOpenDiscoveryHub={openDiscoveryHub}
          onOpenWatchParty={() => setShowJoinPartyModal(true)}
          pendingFriendRequestsCount={pendingFriendRequestsCount}
        />
      )}

      {/* Edge-to-Edge Left Sidebar Navigation (TV Only) */}
      {isTV && isNoModalOpen && (
        <TVSidebar
          activeTab={activeTab}
          onTabSelect={(tab) => {
            if (tab === 'search') {
              openDiscoveryHub();
            } else {
              setActiveTab(tab);
            }
          }}
          activeProfile={activeProfile}
          onChangeProfile={handleChangeProfile}
        />
      )}

      {/* Keşif & Arama Hub Modalı */}
      <DiscoveryHubModal
        visible={showDiscoveryHub}
        onClose={closeDiscoveryHub}
        onSelectSearch={() => {
          closeDiscoveryHub();
          setActiveTab('search');
        }}
        onSelectReels={() => {
          openReels();
        }}
        onSelectComingSoon={() => {
          openComingSoon();
        }}
        onSelectDownloads={() => {
          openDownloads();
        }}
      />

      {/* Keşfet Reels Modal */}
      {showReelsModal && (
        <ReelsFeedView
          profileId={profileId}
          initialIndex={reelsActiveIndex}
          onActiveIndexChange={setReelsActiveIndex}
          onPlayMedia={(mediaToPlay) => {
            setShowReelsModal(false);
            openVideo(mediaToPlay, 'reels');
          }}
          onSelectMedia={(mediaToSelect) => {
            setShowReelsModal(false);
            openDetail(mediaToSelect, 'reels');
          }}
          onClose={() => {
            setReelsActiveIndex(0);
            closeReels();
            setReturnToModal(null);
          }}
        />
      )}

      {/* Vizyon Takvimi Modal */}
      {showComingSoonModal && (
        <ComingSoonView
          onClose={() => {
            closeComingSoon();
            setReturnToModal(null);
          }}
          onSelectMedia={(mediaToSelect: any) => {
            setShowComingSoonModal(false);
            openDetail(mediaToSelect, 'comingSoon');
          }}
        />
      )}

      {/* Çevrimdışı İndirilenler Modal (Tam Sayfa / Sonsuz Ekran) */}
      {showDownloadsModal && (
        <View style={styles.fullscreenModalContainer}>
          <DownloadsView
            isOfflineMode={isOffline}
            onBack={isOffline ? undefined : () => closeDownloads()}
            onPlayMedia={(mediaToPlay) => {
              if (!isOffline) {
                closeDownloads();
              }
              openVideo(mediaToPlay);
            }}
          />
        </View>
      )}

      {activeDetail && (
        <DetailView
          media={activeDetail}
          profileId={profileId}
          onClose={() => {
            closeDetail();
          }}
          onSelectActor={(actor) => {
            openActor(actor, true);
          }}
          onPlayMedia={(mediaToPlay) => {
            videoOriginDetailRef.current = activeDetail;
            setActiveDetail(null);
            openVideo(mediaToPlay);
          }}
          onSelectMedia={(mediaToSelect) => {
            openDetail(mediaToSelect);
          }}
        />
      )}

      {activeActor && (
        <ActorDetailView
          actor={activeActor}
          onClose={() => {
            closeActor();
          }}
          onSelectMedia={(mediaToSelect) => {
            openDetail(mediaToSelect);
          }}
        />
      )}

      {activeVideo && (
        <VideoPlayerView
          key={String(activeVideo.id || activeVideo.tmdbId || activeVideo.Id || 'active-video') + '-' + String(activeVideo.season_number || activeVideo.seasonNumber || 1) + '-' + String(activeVideo.episode_number || activeVideo.episodeNumber || 1)}
          media={activeVideo}
          profileId={profileId}
          startSeconds={activeVideo.positionSeconds || 0}
          onClose={() => {
            handleCloseActiveVideo();
          }}
          onPlayNextMedia={(nextMedia) => setActiveVideo(nextMedia)}
        />
      )}

      {/* Birlikte İzle / Watch Party Odaya Katılma Modalı */}
      <JoinWatchPartyModal
        visible={showJoinPartyModal}
        onClose={() => setShowJoinPartyModal(false)}
        onJoined={(room) => openWatchParty(room)}
      />

      {/* Real-time Watch Party Gelen Davet Modalı */}
      <WatchPartyInviteModal />

      {/* Kullanıcı Adı Belirleme Modalı (İlk Giriş veya Eksik Hesaplar İçin) */}
      <UsernameSetupModal
        visible={showUsernameSetup}
        onComplete={() => setShowUsernameSetup(false)}
      />

      {/* Cihazlar Arası Kesintisiz Geçiş Bildirimi (Live Handoff) */}
      <CrossDeviceHandoffBanner
        session={handoffSession}
        userId={user?.uid}
        profileId={profileId}
        onResume={(mediaToPlay, startSec) => {
          openVideo(mediaToPlay);
        }}
        onDismiss={() => setHandoffSession(null)}
      />

      {/* Sanal TV Kumandası Modalı */}
      <VirtualTvRemoteModal
        visible={showVirtualRemoteModal}
        onClose={() => setShowVirtualRemoteModal(false)}
      />

      {/* Mobile/Tablet Bottom Tab Bar */}
      {!isTV && !isDesktopWeb && isNoModalOpen && (
        <View style={[styles.tabBarWrapper, { bottom: bottomInset + 8 }]}>
          <View style={styles.tabBar}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TVFocusable
                  key={tab.key}
                  onPress={() => {
                    if (tab.key === 'search') {
                      openDiscoveryHub();
                    } else {
                      setActiveTab(tab.key as any);
                    }
                  }}
                  style={styles.tabItem}
                  focusedStyle={{ backgroundColor: 'rgba(229,9,20,0.12)', borderRadius: 14 }}
                >
                  <View style={styles.tabItemInner}>
                    <View style={{ position: 'relative' }}>
                      <Ionicons
                        name={isActive ? tab.activeIcon : tab.icon}
                        size={22}
                        color={isActive ? '#E50914' : '#737373'}
                      />
                      {tab.key === 'social' && pendingFriendRequestsCount > 0 && (
                        <View style={styles.tabBadge}>
                          <Text style={styles.tabBadgeText}>
                            {pendingFriendRequestsCount > 99 ? '99+' : pendingFriendRequestsCount}
                          </Text>
                        </View>
                      )}
                    </View>
                    {isActive && <View style={styles.activeDot} />}
                    <ThemedText style={[styles.tabLabel, { color: isActive ? '#E50914' : '#737373' }]}>
                      {tab.label}
                    </ThemedText>
                  </View>
                </TVFocusable>
              );
            })}
          </View>
        </View>
      )}

      {/* TV Ekran Koruyucu (OLED Ambient Screensaver) */}
      {isTV && (
        <TVScreensaver
          visible={showScreensaver}
          onDismiss={() => {
            setShowScreensaver(false);
            reportUserActivity();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  viewContainer: { flex: 1, overflow: 'hidden' },
  tvViewContainer: { flex: 1, paddingLeft: 60, overflow: 'visible' },
  desktopWebViewContainer: { flex: 1, paddingTop: 68, overflow: 'hidden' },
  tabBarWrapper: { position: 'absolute', left: 12, right: 12, alignItems: 'center', zIndex: 100 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(18,18,18,0.95)',
    borderRadius: 28,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 14,
    width: '100%',
    maxWidth: 480,
    justifyContent: 'space-around',
  },
  tabItem: { flex: 1, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 14, alignItems: 'center' },
  tabItemInner: { alignItems: 'center', justifyContent: 'center', position: 'relative', paddingVertical: 2 },
  activeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#E50914', marginTop: 2, marginBottom: -4 },
  tabLabel: { fontSize: 10, fontWeight: '600', marginTop: 4, letterSpacing: 0.2 },
  tabBadge: {
    position: 'absolute',
    top: -5,
    right: -8,
    backgroundColor: '#E50914',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#121212',
    zIndex: 999,
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  fullscreenModalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    backgroundColor: '#09090D',
  },
});
