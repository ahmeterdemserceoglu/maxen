import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TVFocusable } from '@/components/TVFocusable';
import { useAuth } from '@/contexts/AuthContext';
import {
  getFriendProfileDetail,
  FriendProfileDetail,
  formatRelativeTime,
  sendFriendRequest,
} from '@/services/socialService';
import { TMDB_IMAGE_BASE_URL } from '@/config/tmdb';

const isTV = Platform.isTV;

export interface FriendProfileModalProps {
  visible: boolean;
  friendUid: string | null;
  onClose: () => void;
  onSelectMedia: (media: any) => void;
  onWatchTogether?: (friend: any, media: any) => void;
  onOpenDirectMessage?: (friend: any) => void;
}

function getPosterUri(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${TMDB_IMAGE_BASE_URL}/w300${path}`;
}

export function FriendProfileModal({
  visible,
  friendUid,
  onClose,
  onSelectMedia,
  onWatchTogether,
  onOpenDirectMessage,
}: FriendProfileModalProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<FriendProfileDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    if (!visible || !friendUid || !user?.uid) {
      setProfileData(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setRequestSent(false);

    getFriendProfileDetail(user.uid, friendUid)
      .then((data) => {
        if (isMounted) {
          setProfileData(data);
        }
      })
      .catch((e) => console.warn('Error loading friend profile detail:', e))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [visible, friendUid, user?.uid]);

  const handleSendFriendRequest = async () => {
    if (!user || !profileData?.user) return;
    setSendingRequest(true);
    try {
      await sendFriendRequest(
        {
          uid: user.uid,
          username: user.displayName || 'user',
          displayName: user.displayName || 'Kullanıcı',
        },
        {
          uid: profileData.user.uid,
          username: profileData.user.username,
          displayName: profileData.user.displayName,
        }
      );
      setRequestSent(true);
    } catch (e) {
      console.warn('Send request error:', e);
    } finally {
      setSendingRequest(false);
    }
  };

  if (!visible) return null;

  const isWatchingLive = profileData?.presence?.status === 'watching' && !!profileData.presence.media;
  const isOnline = profileData?.presence?.status === 'online';

  const topInset = insets.top || 20;
  const bottomInset = insets.bottom || 24;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.infiniteContainer}>
        {/* Infinite Background Ambient Gradient */}
        <LinearGradient
          colors={['#1c080a', '#10070c', '#070709', '#050507']}
          locations={[0, 0.3, 0.65, 1]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* FLOATING TOP NAVIGATION BAR (Edge-to-Edge) */}
        <View style={[styles.floatingNavBar, { paddingTop: topInset + 6 }]}>
          <LinearGradient
            colors={['rgba(7, 7, 9, 0.95)', 'rgba(7, 7, 9, 0.6)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <View style={[styles.navBarContent, isTV && styles.navBarContentTV]}>
            <TVFocusable
              onPress={onClose}
              style={styles.backButton}
              focusedStyle={styles.backButtonFocused}
              accessibilityLabel="Geri Dön"
            >
              <View style={styles.backButtonInner}>
                <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                <Text style={styles.backButtonText}>Geri</Text>
              </View>
            </TVFocusable>

            <Text style={styles.brandTitle}>MAXEN</Text>

            <View style={{ width: 70 }} />
          </View>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#E50914" />
            <Text style={styles.loadingText}>Profil bilgileri getiriliyor...</Text>
          </View>
        ) : !profileData ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={54} color="#71717A" />
            <Text style={styles.errorText}>Profil bilgisi bulunamadı.</Text>
          </View>
        ) : !profileData.isFriend ? (
          /* ============================================================ */
          /* PRIVACY SCREEN (NOT FRIENDS) - INFINITE EDGE-TO-EDGE CANVAS  */
          /* ============================================================ */
          <View style={[styles.privateCanvas, { paddingTop: topInset + 80, paddingBottom: bottomInset }]}>
            <View style={styles.privateCardBox}>
              <View
                style={[
                  styles.profileAvatarLarge,
                  { backgroundColor: profileData.user.avatarColor || '#E50914' },
                ]}
              >
                <Text style={styles.profileAvatarLargeLetter}>
                  {profileData.user.displayName?.[0]?.toUpperCase() ||
                    profileData.user.username?.[0]?.toUpperCase() ||
                    'U'}
                </Text>
              </View>

              <Text style={styles.profileDisplayNameLarge}>{profileData.user.displayName}</Text>
              <Text style={styles.profileUsernameLarge}>@{profileData.user.username}</Text>

              <View style={styles.lockBox}>
                <View style={styles.lockIconCircle}>
                  <Ionicons name="lock-closed" size={30} color="#E50914" />
                </View>
                <Text style={styles.lockTitle}>Gizli Profil</Text>
                <Text style={styles.lockDesc}>
                  Bu kullanıcının izlediği yapımları ve favorilerini yalnızca karşılıklı arkadaşları görüntüleyebilir.
                </Text>
              </View>

              {requestSent ? (
                <View style={styles.requestSentTag}>
                  <Ionicons name="checkmark-circle" size={18} color="#22C55E" style={{ marginRight: 8 }} />
                  <Text style={styles.requestSentText}>Arkadaşlık İsteği Gönderildi</Text>
                </View>
              ) : (
                <TVFocusable
                  onPress={handleSendFriendRequest}
                  style={styles.addFriendBtn}
                  focusedStyle={styles.addFriendBtnFocused}
                  disabled={sendingRequest}
                  accessibilityLabel="Arkadaşlık İsteği Gönder"
                >
                  <View style={styles.addFriendBtnInner}>
                    {sendingRequest ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="person-add" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={styles.addFriendBtnText}>Arkadaşlık İsteği Gönder</Text>
                      </>
                    )}
                  </View>
                </TVFocusable>
              )}
            </View>
          </View>
        ) : (
          /* ============================================================ */
          /* FRIEND PROFILE & ACTIVITY - INFINITE SCROLL CANVAS           */
          /* ============================================================ */
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              isTV && styles.scrollContentTV,
              { paddingTop: topInset + 75, paddingBottom: bottomInset + 40 },
            ]}
          >
            {/* HERO PROFILE BANNER */}
            <View style={styles.heroProfileCard}>
              <LinearGradient
                colors={['rgba(229, 9, 20, 0.22)', 'rgba(18, 18, 23, 0.95)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.heroProfileInner}>
                <View
                  style={[
                    styles.heroAvatar,
                    { backgroundColor: profileData.user.avatarColor || '#E50914' },
                  ]}
                >
                  <Text style={styles.heroAvatarText}>
                    {profileData.user.displayName?.[0]?.toUpperCase() ||
                      profileData.user.username?.[0]?.toUpperCase() ||
                      'U'}
                  </Text>
                </View>

                <View style={styles.heroMetaCol}>
                  <Text style={styles.heroDisplayName} numberOfLines={1}>
                    {profileData.user.displayName}
                  </Text>
                  <Text style={styles.heroUsername} numberOfLines={1}>
                    @{profileData.user.username}
                  </Text>

                    <View style={styles.heroStatusRow}>
                      {isWatchingLive ? (
                        <View style={styles.statusLivePill}>
                          <View style={styles.liveGreenDot} />
                          <Text style={styles.statusLiveText}>Şu an İzliyor</Text>
                        </View>
                      ) : isOnline ? (
                        <View style={styles.statusOnlinePill}>
                          <View style={styles.onlineWhiteDot} />
                          <Text style={styles.statusOnlineText}>Çevrimiçi</Text>
                        </View>
                      ) : (
                        <Text style={styles.statusOfflineText}>
                          Son görülme: {formatRelativeTime(profileData.presence?.lastSeen || 0)}
                        </Text>
                      )}
                    </View>

                    {profileData.isFriend && onOpenDirectMessage && (
                      <TVFocusable
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: '#1E1E24',
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 8,
                          alignSelf: 'flex-start',
                          marginTop: 8,
                          gap: 6,
                          borderWidth: 1,
                          borderColor: 'rgba(255,255,255,0.12)',
                        }}
                        focusedStyle={{ backgroundColor: '#E50914' }}
                        onPress={() => onOpenDirectMessage(profileData.user)}
                      >
                        <Ionicons name="chatbubble-ellipses" size={14} color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Mesaj Gönder</Text>
                      </TVFocusable>
                    )}
                  </View>
                </View>
              </View>

            {/* LIVE WATCHING PROMINENT HERO CARD */}
            {isWatchingLive && profileData.presence?.media && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionHeaderTitle}>🔴 Şu An Canlı İzleniyor</Text>
                <View style={styles.liveHeroCard}>
                  {getPosterUri(profileData.presence.media.posterUrl || (profileData.presence.media as any).poster_path) ? (
                    <Image
                      source={{
                        uri: getPosterUri(
                          profileData.presence.media.posterUrl || (profileData.presence.media as any).poster_path
                        )!,
                      }}
                      style={styles.liveHeroPoster}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.liveHeroPosterPlaceholder}>
                      <Ionicons name="film" size={32} color="#71717A" />
                    </View>
                  )}

                  <View style={styles.liveHeroMetaCol}>
                    <Text style={styles.liveHeroTitle} numberOfLines={2}>
                      {profileData.presence.media.title || 'Video'}
                    </Text>
                    {profileData.presence.media.type === 'tv' && profileData.presence.media.seasonNum ? (
                      <Text style={styles.liveHeroSub}>
                        {`Sezon ${profileData.presence.media.seasonNum} • Bölüm ${profileData.presence.media.episodeNum || 1}`}
                      </Text>
                    ) : (
                      <Text style={styles.liveHeroSub}>Film</Text>
                    )}

                    {onWatchTogether && (
                      <TVFocusable
                        onPress={() => onWatchTogether(profileData.user, profileData.presence?.media)}
                        style={styles.liveHeroWatchBtn}
                        focusedStyle={styles.liveHeroWatchBtnFocused}
                        accessibilityLabel="Birlikte İzle"
                      >
                        <View style={styles.liveHeroWatchBtnInner}>
                          <Ionicons name="play" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.liveHeroWatchBtnText}>Birlikte İzle</Text>
                        </View>
                      </TVFocusable>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* CONTINUE WATCHING SECTION */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="play-circle" size={22} color="#E50914" style={{ marginRight: 8 }} />
                <Text style={styles.sectionHeaderTitle}>İzlemeye Devam Ettikleri</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{profileData.continueWatching.length}</Text>
                </View>
              </View>

              {profileData.continueWatching.length === 0 ? (
                <View style={styles.emptySectionBox}>
                  <Ionicons name="film-outline" size={36} color="#3F3F46" style={{ marginBottom: 8 }} />
                  <Text style={styles.emptySectionMuted}>Aktif izlenen dizi veya film bulunmuyor.</Text>
                </View>
              ) : (
                <FlatList
                  data={profileData.continueWatching}
                  keyExtractor={(cw) => String(cw.id || cw.tmdbId)}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalRowContent}
                  renderItem={({ item: cw }) => {
                    const poster = getPosterUri(cw.posterUrl || cw.backdropUrl);
                    const progressPercent = Math.round((cw.progress || 0) * 100);

                    return (
                      <View style={styles.mediaCardWrapper}>
                        <TVFocusable
                          onPress={() => {
                            onClose();
                            onSelectMedia(cw);
                          }}
                          style={styles.mediaCardFocusable}
                          focusedStyle={styles.mediaCardFocused}
                          accessibilityLabel={cw.title}
                        >
                          <View style={styles.mediaCardInner}>
                            {poster ? (
                              <Image source={{ uri: poster }} style={styles.mediaPosterImg} contentFit="cover" />
                            ) : (
                              <View style={styles.mediaPosterPlaceholder}>
                                <Ionicons name="film-outline" size={32} color="#71717A" />
                              </View>
                            )}

                            {/* Episode overlay tag */}
                            {cw.seasonNumber && (
                              <View style={styles.episodeOverlayPill}>
                                <Text style={styles.episodeOverlayText}>
                                  {`S${cw.seasonNumber}:B${cw.episodeNumber || 1}`}
                                </Text>
                              </View>
                            )}

                            {/* Progress bar */}
                            {cw.progress > 0 && (
                              <View style={styles.progressBarBg}>
                                <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                              </View>
                            )}
                          </View>
                        </TVFocusable>
                        <Text style={styles.mediaCardTitle} numberOfLines={1}>
                          {cw.title}
                        </Text>
                      </View>
                    );
                  }}
                />
              )}
            </View>

            {/* FAVORITES SECTION */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="heart" size={22} color="#E50914" style={{ marginRight: 8 }} />
                <Text style={styles.sectionHeaderTitle}>Favori Yapımları</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{profileData.favorites.length}</Text>
                </View>
              </View>

              {profileData.favorites.length === 0 ? (
                <View style={styles.emptySectionBox}>
                  <Ionicons name="heart-dislike-outline" size={36} color="#3F3F46" style={{ marginBottom: 8 }} />
                  <Text style={styles.emptySectionMuted}>Henüz favori eklenmemiş.</Text>
                </View>
              ) : (
                <FlatList
                  data={profileData.favorites}
                  keyExtractor={(fav) => String(fav.id || fav.tmdbId)}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalRowContent}
                  renderItem={({ item: fav }) => {
                    const poster = getPosterUri(fav.posterUrl);

                    return (
                      <View style={styles.mediaCardWrapper}>
                        <TVFocusable
                          onPress={() => {
                            onClose();
                            onSelectMedia(fav);
                          }}
                          style={styles.mediaCardFocusable}
                          focusedStyle={styles.mediaCardFocused}
                          accessibilityLabel={fav.title}
                        >
                          <View style={styles.mediaCardInner}>
                            {poster ? (
                              <Image source={{ uri: poster }} style={styles.mediaPosterImg} contentFit="cover" />
                            ) : (
                              <View style={styles.mediaPosterPlaceholder}>
                                <Ionicons name="star-outline" size={32} color="#71717A" />
                              </View>
                            )}
                          </View>
                        </TVFocusable>
                        <Text style={styles.mediaCardTitle} numberOfLines={1}>
                          {fav.title}
                        </Text>
                      </View>
                    );
                  }}
                />
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  infiniteContainer: {
    flex: 1,
    backgroundColor: '#070709',
  },

  /* ──── FLOATING TOP NAV BAR ──── */
  floatingNavBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  navBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  navBarContentTV: {
    paddingHorizontal: 40,
    paddingBottom: 18,
  },
  backButton: {
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  backButtonFocused: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderColor: '#FFFFFF',
    borderWidth: 2,
    transform: [{ scale: 1.05 }],
  },
  backButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  brandTitle: {
    color: '#E50914',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
  },

  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
  },
  loadingText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#71717A',
    fontSize: 14,
    fontWeight: '600',
  },

  /* ──── PRIVACY SCREEN ──── */
  privateCanvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  privateCardBox: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#121217',
    borderRadius: 26,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 24,
  },
  profileAvatarLarge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  profileAvatarLargeLetter: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
  },
  profileDisplayNameLarge: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  profileUsernameLarge: {
    color: '#71717A',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 22,
  },
  lockBox: {
    backgroundColor: 'rgba(229, 9, 20, 0.08)',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.22)',
    marginBottom: 24,
    width: '100%',
  },
  lockIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(229, 9, 20, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  lockTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  lockDesc: {
    color: '#A1A1AA',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  addFriendBtn: {
    borderRadius: 16,
    backgroundColor: '#E50914',
    width: '100%',
  },
  addFriendBtnFocused: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
    transform: [{ scale: 1.03 }],
  },
  addFriendBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  addFriendBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
  requestSentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  requestSentText: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: '700',
  },

  /* ──── SCROLL CONTENT ──── */
  scrollContent: {
    paddingHorizontal: 20,
    gap: 26,
  },
  scrollContentTV: {
    paddingHorizontal: 40,
    gap: 30,
  },

  /* ──── HERO PROFILE BANNER ──── */
  heroProfileCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  heroProfileInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 22,
  },
  heroAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  heroAvatarText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
  },
  heroMetaCol: {
    flex: 1,
  },
  heroDisplayName: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
  },
  heroUsername: {
    color: '#A1A1AA',
    fontSize: 13.5,
    fontWeight: '600',
    marginTop: 2,
  },
  heroStatusRow: {
    marginTop: 10,
  },
  statusLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.16)',
    paddingVertical: 4,
    paddingHorizontal: 11,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 6,
  },
  liveGreenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#22C55E',
  },
  statusLiveText: {
    color: '#4ADE80',
    fontSize: 11.5,
    fontWeight: '800',
  },
  statusOnlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    paddingVertical: 4,
    paddingHorizontal: 11,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 6,
  },
  onlineWhiteDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  statusOnlineText: {
    color: '#E4E4E7',
    fontSize: 11.5,
    fontWeight: '700',
  },
  statusOfflineText: {
    color: '#71717A',
    fontSize: 12,
  },

  /* ──── SECTIONS ──── */
  sectionContainer: {
    gap: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  countBadge: {
    marginLeft: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countBadgeText: {
    color: '#A1A1AA',
    fontSize: 11.5,
    fontWeight: '800',
  },
  emptySectionBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptySectionMuted: {
    color: '#71717A',
    fontSize: 13,
  },

  /* ──── LIVE HERO CARD ──── */
  liveHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14141A',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.25)',
  },
  liveHeroPoster: {
    width: 68,
    height: 102,
    borderRadius: 12,
    backgroundColor: '#1E1E26',
    marginRight: 16,
  },
  liveHeroPosterPlaceholder: {
    width: 68,
    height: 102,
    borderRadius: 12,
    backgroundColor: '#1E1E26',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  liveHeroMetaCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  liveHeroTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  liveHeroSub: {
    color: '#A1A1AA',
    fontSize: 12.5,
    fontWeight: '600',
    marginBottom: 8,
  },
  liveHeroWatchBtn: {
    borderRadius: 12,
    backgroundColor: '#E50914',
    alignSelf: 'flex-start',
  },
  liveHeroWatchBtnFocused: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
    transform: [{ scale: 1.05 }],
  },
  liveHeroWatchBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  liveHeroWatchBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },

  /* ──── MEDIA CARDS ──── */
  horizontalRowContent: {
    gap: 14,
    paddingVertical: 6,
  },
  mediaCardWrapper: {
    width: isTV ? 150 : 120,
  },
  mediaCardFocusable: {
    width: isTV ? 150 : 120,
    height: isTV ? 225 : 180,
    borderRadius: 14,
    overflow: 'hidden',
  },
  mediaCardFocused: {
    borderColor: '#E50914',
    borderWidth: 2.5,
    transform: [{ scale: 1.05 }],
  },
  mediaCardInner: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1A1A22',
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
  },
  mediaPosterImg: {
    width: '100%',
    height: '100%',
  },
  mediaPosterPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  episodeOverlayPill: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  episodeOverlayText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  progressBarBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4.5,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#E50914',
  },
  mediaCardTitle: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 6,
  },
});
