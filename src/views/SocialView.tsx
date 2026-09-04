import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TVFocusable } from '@/components/TVFocusable';
import { useAuth } from '@/contexts/AuthContext';
import { useUiStore } from '@/store/uiStore';
import {
  UserProfileDoc,
  UserPresence,
  FriendRelation,
} from '@/types/social';
import {
  getUserProfile,
  subscribeToFriends,
  subscribeToFriendPresences,
  updateLivePresence,
  searchUsersByUsername,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriend,
  sendWatchPartyInvite,
  formatRelativeTime,
} from '@/services/socialService';
import { createWatchPartyRoom, joinWatchPartyRoom } from '@/services/watchPartyService';
import { FriendProfileModal } from '@/components/FriendProfileModal';
import { DirectMessageModal } from '@/components/DirectMessageModal';
import { TMDB_IMAGE_BASE_URL } from '@/config/tmdb';

const isTV = Platform.isTV;

function getPosterUrl(media: any): string | null {
  if (!media) return null;
  const path = media.poster_path || media.posterUrl || media.backdrop_path || media.backdropUrl;
  if (!path) return null;
  if (typeof path === 'string' && (path.startsWith('http://') || path.startsWith('https://'))) {
    return path;
  }
  return `${TMDB_IMAGE_BASE_URL}/w300${path}`;
}

export function SocialView() {
  const { user, activeProfile } = useAuth();
  const openWatchParty = useUiStore((state) => state.openWatchParty);
  const openDetail = useUiStore((state) => state.openDetail);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Profile and Friends State
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfileDoc | null>(null);
  const [friends, setFriends] = useState<FriendRelation[]>([]);
  const [presences, setPresences] = useState<Record<string, UserPresence>>({});
  const [filterTab, setFilterTab] = useState<'all' | 'watching' | 'online' | 'offline'>('all');
  const [searchFriendQuery, setSearchFriendQuery] = useState('');
  const [isStartingParty, setIsStartingParty] = useState<string | null>(null);
  const [selectedProfileUid, setSelectedProfileUid] = useState<string | null>(null);
  const [activeDmFriend, setActiveDmFriend] = useState<any | null>(null);

  // Modals state
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);

  // Add Friend Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfileDoc[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [requestSendingUids, setRequestSendingUids] = useState<Record<string, boolean>>({});

  // Incoming requests action state
  const [actionProcessingUids, setActionProcessingUids] = useState<Record<string, boolean>>({});

  // 1. Initialize Current User Profile & Set Presence
  useEffect(() => {
    if (!user?.uid) return;

    let isMounted = true;
    getUserProfile(user.uid).then(async (profile: UserProfileDoc | null) => {
      if (!isMounted) return;
      if (profile && profile.username) {
        setCurrentUserProfile(profile);
        updateLivePresence(
          {
            uid: user.uid,
            username: profile.username,
            displayName: profile.displayName,
          },
          'online'
        );
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  // 2. Real-time Friends Listener
  useEffect(() => {
    if (!user?.uid) return;

    const unsub = subscribeToFriends(user.uid, (friendsList) => {
      setFriends(friendsList);
    });

    return () => unsub();
  }, [user?.uid]);

  // 3. Real-time Presences for Friends
  useEffect(() => {
    const friendUids = friends
      .filter((f) => f.status === 'accepted')
      .map((f) => f.friendUid);

    if (friendUids.length === 0) {
      setPresences({});
      return;
    }

    const unsub = subscribeToFriendPresences(friendUids, (presencesMap) => {
      setPresences(presencesMap);
    });

    return () => unsub();
  }, [friends]);

  // Separate friends and pending requests
  const acceptedFriends = useMemo(() => {
    return friends.filter((f) => f.status === 'accepted');
  }, [friends]);

  const incomingRequests = useMemo(() => {
    return friends.filter((f) => f.status === 'pending_received');
  }, [friends]);

  const sentRequests = useMemo(() => {
    return friends.filter((f) => f.status === 'pending_sent');
  }, [friends]);

  // Filtered and Sorted Friends List
  const displayFriends = useMemo(() => {
    let list = acceptedFriends.map((f) => {
      const presence = presences[f.friendUid] || {
        uid: f.friendUid,
        username: f.friendUsername,
        displayName: f.friendDisplayName,
        status: 'offline' as const,
        lastSeen: f.updatedAt || 0,
        media: null,
      };
      return {
        ...f,
        presence,
      };
    });

    // Text search filter
    if (searchFriendQuery.trim()) {
      const q = searchFriendQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.friendDisplayName.toLowerCase().includes(q) ||
          item.friendUsername.toLowerCase().includes(q)
      );
    }

    // Status Tab filter
    if (filterTab === 'watching') {
      list = list.filter((item) => item.presence.status === 'watching');
    } else if (filterTab === 'online') {
      list = list.filter((item) => item.presence.status === 'online');
    } else if (filterTab === 'offline') {
      list = list.filter((item) => item.presence.status === 'offline');
    }

    // Priority Sort: Watching > Online > Offline (by lastSeen desc)
    return list.sort((a, b) => {
      const getPriority = (status: string) => {
        if (status === 'watching') return 3;
        if (status === 'online') return 2;
        return 1;
      };
      const pA = getPriority(a.presence.status);
      const pB = getPriority(b.presence.status);
      if (pA !== pB) return pB - pA;
      return (b.presence.lastSeen || 0) - (a.presence.lastSeen || 0);
    });
  }, [acceptedFriends, presences, filterTab, searchFriendQuery]);

  // Counts for tabs
  const watchingCount = useMemo(() => {
    return acceptedFriends.filter((f) => presences[f.friendUid]?.status === 'watching').length;
  }, [acceptedFriends, presences]);

  const onlineCount = useMemo(() => {
    return acceptedFriends.filter((f) => presences[f.friendUid]?.status === 'online').length;
  }, [acceptedFriends, presences]);

  const offlineCount = useMemo(() => {
    return acceptedFriends.filter(
      (f) => !presences[f.friendUid] || presences[f.friendUid]?.status === 'offline'
    ).length;
  }, [acceptedFriends, presences]);

  // Handle Search Users for Adding
  const handleSearchUsers = useCallback(
    async (term: string) => {
      setSearchQuery(term);
      if (!user || term.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchUsersByUsername(term.trim(), user.uid);
        setSearchResults(results);
      } catch (e) {
        console.warn('Search error:', e);
      } finally {
        setIsSearching(false);
      }
    },
    [user]
  );

  // Handle Send Friend Request
  const handleSendRequest = async (targetUser: UserProfileDoc) => {
    if (!user || !currentUserProfile) return;

    setRequestSendingUids((prev) => ({ ...prev, [targetUser.uid]: true }));
    try {
      const res = await sendFriendRequest(
        {
          uid: user.uid,
          username: currentUserProfile.username,
          displayName: currentUserProfile.displayName,
        },
        {
          uid: targetUser.uid,
          username: targetUser.username,
          displayName: targetUser.displayName,
        }
      );

      if (res.success) {
        if (Platform.OS !== 'web') {
          Alert.alert('Başarılı', `@${targetUser.username} kullanıcısına arkadaşlık isteği gönderildi.`);
        }
      } else {
        if (Platform.OS !== 'web') {
          Alert.alert('Uyarı', res.error || 'İstek gönderilemedi.');
        }
      }
    } catch (e: any) {
      console.warn('Send request error:', e);
    } finally {
      setRequestSendingUids((prev) => ({ ...prev, [targetUser.uid]: false }));
    }
  };

  // Handle Accept Request
  const handleAcceptRequest = async (friendUid: string) => {
    if (!user) return;
    setActionProcessingUids((prev) => ({ ...prev, [friendUid]: true }));
    try {
      await acceptFriendRequest(user.uid, friendUid);
    } catch (e) {
      console.warn('Accept friend request error:', e);
    } finally {
      setActionProcessingUids((prev) => ({ ...prev, [friendUid]: false }));
    }
  };

  // Handle Reject Request
  const handleRejectRequest = async (friendUid: string) => {
    if (!user) return;
    setActionProcessingUids((prev) => ({ ...prev, [friendUid]: true }));
    try {
      await removeFriend(user.uid, friendUid);
    } catch (e) {
      console.warn('Reject friend request error:', e);
    } finally {
      setActionProcessingUids((prev) => ({ ...prev, [friendUid]: false }));
    }
  };

  // Handle "Birlikte İzle" instant party creation and invite
  const handleWatchTogether = async (friend: FriendRelation, media: any) => {
    if (!user || !currentUserProfile || isStartingParty) return;
    if (!media) {
      Alert.alert('Bilgi', 'Arkadaşınız şu an aktif bir içerik izlemiyor.');
      return;
    }

    try {
      setIsStartingParty(friend.friendUid);

      // 1. Create Watch Party Room
      const room = await createWatchPartyRoom(
        user,
        activeProfile,
        media,
        0,
        true
      );

      // 2. Send instant Watch Party Invite to the friend
      await sendWatchPartyInvite(
        {
          uid: user.uid,
          username: currentUserProfile.username,
          displayName: currentUserProfile.displayName,
        },
        friend.friendUid,
        room.code,
        media
      );

      // 3. Open room directly in Video Player
      openWatchParty(room);
    } catch (e: any) {
      console.warn('Watch together error:', e);
      Alert.alert('Hata', 'Birlikte izle odası başlatılamadı.');
    } finally {
      setIsStartingParty(null);
    }
  };

  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 52 : isTV ? 28 : 40);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      {/* Background Ambience */}
      <LinearGradient
        colors={['rgba(229, 9, 20, 0.16)', 'rgba(10, 10, 14, 0.95)', '#060608']}
        locations={[0, 0.25, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ============================================================ */}
      {/* 1. TOP HEADER                                                */}
      {/* ============================================================ */}
      <View style={[styles.header, isTV && styles.headerTV]}>
        <View>
          <Text style={styles.headerBrandTitle}>MAXEN</Text>
          {currentUserProfile?.username ? (
            <Text style={styles.headerAccountHandle}>@{currentUserProfile.username}</Text>
          ) : null}
        </View>

        <View style={styles.headerActions}>
          {/* Requests Icon Button */}
          <TVFocusable
            onPress={() => setShowRequestsModal(true)}
            style={styles.iconActionBtn}
            focusedStyle={styles.iconActionBtnFocused}
            accessibilityLabel="Gelen Arkadaşlık İstekleri"
          >
            <View style={styles.iconActionBtnInner}>
              <Ionicons name="mail-outline" size={18} color="#E4E4E7" />
              {incomingRequests.length > 0 && (
                <View style={styles.badgeCount}>
                  <Text style={styles.badgeCountText}>{incomingRequests.length}</Text>
                </View>
              )}
            </View>
          </TVFocusable>

          {/* Add Friend Button */}
          <TVFocusable
            onPress={() => setShowAddFriendModal(true)}
            style={styles.addFriendPrimaryBtn}
            focusedStyle={styles.addFriendPrimaryBtnFocused}
            accessibilityLabel="Arkadaş Ekle"
          >
            <View style={styles.addFriendPrimaryBtnInner}>
              <Ionicons name="person-add" size={15} color="#FFFFFF" />
              <Text style={styles.addFriendPrimaryBtnText}>Ekle</Text>
            </View>
          </TVFocusable>
        </View>
      </View>

      {/* ============================================================ */}
      {/* 2. SEARCH BAR & FILTER TABS (CLEAN SINGLE-SCROLL)           */}
      {/* ============================================================ */}
      <View style={[styles.filterBarSection, isTV && styles.filterBarSectionTV]}>
        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={15} color="#71717A" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={searchFriendQuery}
            onChangeText={setSearchFriendQuery}
            placeholder="Arkadaşlarında ara..."
            placeholderTextColor="#71717A"
            autoCorrect={false}
          />
          {searchFriendQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchFriendQuery('')}>
              <Ionicons name="close-circle" size={16} color="#A1A1AA" />
            </TouchableOpacity>
          )}
        </View>

        {/* Horizontal Filter Tabs (Never Wrap) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTabsContent}
        >
          <TVFocusable
            onPress={() => setFilterTab('all')}
            style={[styles.tabChip, filterTab === 'all' && styles.tabChipActive]}
            focusedStyle={styles.tabChipFocused}
          >
            <Text style={[styles.tabChipText, filterTab === 'all' && styles.tabChipTextActive]}>
              Tümü ({acceptedFriends.length})
            </Text>
          </TVFocusable>

          <TVFocusable
            onPress={() => setFilterTab('watching')}
            style={[styles.tabChip, filterTab === 'watching' && styles.tabChipActive]}
            focusedStyle={styles.tabChipFocused}
          >
            <View style={styles.chipInnerWithDot}>
              <View style={[styles.statusDotSmall, { backgroundColor: '#22C55E' }]} />
              <Text style={[styles.tabChipText, filterTab === 'watching' && styles.tabChipTextActive]}>
                İzleyenler ({watchingCount})
              </Text>
            </View>
          </TVFocusable>

          <TVFocusable
            onPress={() => setFilterTab('online')}
            style={[styles.tabChip, filterTab === 'online' && styles.tabChipActive]}
            focusedStyle={styles.tabChipFocused}
          >
            <View style={styles.chipInnerWithDot}>
              <View style={[styles.statusDotSmall, { backgroundColor: '#E4E4E7' }]} />
              <Text style={[styles.tabChipText, filterTab === 'online' && styles.tabChipTextActive]}>
                Çevrimiçi ({onlineCount})
              </Text>
            </View>
          </TVFocusable>

          <TVFocusable
            onPress={() => setFilterTab('offline')}
            style={[styles.tabChip, filterTab === 'offline' && styles.tabChipActive]}
            focusedStyle={styles.tabChipFocused}
          >
            <View style={styles.chipInnerWithDot}>
              <View style={[styles.statusDotSmall, { backgroundColor: '#71717A' }]} />
              <Text style={[styles.tabChipText, filterTab === 'offline' && styles.tabChipTextActive]}>
                Çevrimdışı ({offlineCount})
              </Text>
            </View>
          </TVFocusable>
        </ScrollView>
      </View>

      {/* ============================================================ */}
      {/* 3. FRIENDS LIST & LIVE ACTIVITY                              */}
      {/* ============================================================ */}
      <FlatList
        data={displayFriends}
        keyExtractor={(item) => item.friendUid}
        contentContainerStyle={[
          styles.listContent,
          isTV && styles.listContentTV,
          displayFriends.length === 0 && styles.listEmptyContainer,
        ]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const presence = item.presence;
          const isWatching = presence.status === 'watching' && !!presence.media;
          const isOnline = presence.status === 'online';
          const posterUrl = isWatching ? getPosterUrl(presence.media) : null;
          const isBusyStarting = isStartingParty === item.friendUid;

          return (
            <View style={[styles.friendCard, isTV && styles.friendCardTV]}>
              {/* Top Row: User Avatar, Name & Status Tag (Pressable to inspect profile) */}
              <TVFocusable
                onPress={() => setSelectedProfileUid(item.friendUid)}
                style={styles.cardHeaderFocusable}
                focusedStyle={styles.cardHeaderFocused}
                accessibilityLabel={`${item.friendDisplayName} Profilini İncele`}
              >
                <View style={styles.cardHeaderRow}>
                  <View style={styles.avatarWrap}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarLetter}>
                        {item.friendDisplayName?.[0]?.toUpperCase() ||
                          item.friendUsername?.[0]?.toUpperCase() ||
                          'U'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.avatarStatusBadge,
                        isWatching && styles.badgeWatching,
                        isOnline && styles.badgeOnline,
                        !isWatching && !isOnline && styles.badgeOffline,
                      ]}
                    />
                  </View>

                  <View style={styles.userInfoCol}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.userNameText} numberOfLines={1}>
                        {item.friendDisplayName}
                      </Text>
                      <Ionicons name="chevron-forward" size={13} color="#71717A" />
                    </View>
                    <Text style={styles.userHandleText} numberOfLines={1}>
                      @{item.friendUsername}
                    </Text>
                  </View>

                  {/* Status Pill on Top Right */}
                  <View style={styles.statusPillRight}>
                    {isWatching ? (
                      <View style={styles.watchingLivePill}>
                        <View style={styles.greenPulse} />
                        <Text style={styles.watchingLivePillText}>İZLİYOR</Text>
                      </View>
                    ) : isOnline ? (
                      <View style={styles.onlinePill}>
                        <Text style={styles.onlinePillText}>Çevrimiçi</Text>
                      </View>
                    ) : (
                      <Text style={styles.offlineTimeText}>
                        {formatRelativeTime(presence.lastSeen)}
                      </Text>
                    )}
                  </View>
                </View>
              </TVFocusable>

              {/* Watching Content Banner */}
              {isWatching && presence.media && (
                <View style={styles.watchingBanner}>
                  {posterUrl ? (
                    <Image
                      source={{ uri: posterUrl }}
                      style={styles.watchingPoster}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View style={styles.watchingPosterPlaceholder}>
                      <Ionicons name="film-outline" size={18} color="#71717A" />
                    </View>
                  )}

                  <View style={styles.watchingMetaCol}>
                    <Text style={styles.watchingTitle} numberOfLines={1}>
                      {presence.media.title || 'Video'}
                    </Text>
                    {presence.media.type === 'tv' && presence.media.seasonNum ? (
                      <Text style={styles.watchingSubtitle}>
                        {`Sezon ${presence.media.seasonNum} • Bölüm ${presence.media.episodeNum || 1}`}
                      </Text>
                    ) : (
                      <Text style={styles.watchingSubtitle}>Film</Text>
                    )}
                  </View>

                  {/* Birlikte İzle Button */}
                  <TVFocusable
                    onPress={() => handleWatchTogether(item, presence.media)}
                    style={styles.watchPartyBtn}
                    focusedStyle={styles.watchPartyBtnFocused}
                    disabled={isBusyStarting}
                    accessibilityLabel={`${item.friendDisplayName} ile Birlikte İzle`}
                  >
                    {isBusyStarting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <View style={styles.watchPartyBtnInner}>
                        <Ionicons name="play" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.watchPartyBtnText}>Birlikte İzle</Text>
                      </View>
                    )}
                  </TVFocusable>
                </View>
              )}

              {/* Action row with Direct Message button */}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12, paddingBottom: 8, gap: 8 }}>
                <TVFocusable
                  onPress={() => setActiveDmFriend({
                    uid: item.friendUid,
                    displayName: item.friendDisplayName,
                    username: item.friendUsername,
                  })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 6,
                    gap: 4,
                  }}
                  focusedStyle={{ backgroundColor: '#E50914' }}
                  accessibilityLabel={`${item.friendDisplayName} ile Mesajlaş`}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={13} color="#D1D5DB" />
                  <Text style={{ color: '#E5E7EB', fontSize: 11, fontWeight: '600' }}>Mesaj</Text>
                </TVFocusable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="people-outline" size={36} color="#E50914" />
            </View>
            <Text style={styles.emptyTitle}>
              {acceptedFriends.length === 0
                ? 'Henüz Arkadaşın Yok'
                : 'Bu Filtrede Arkadaş Bulunamadı'}
            </Text>
            <Text style={styles.emptyDesc}>
              {acceptedFriends.length === 0
                ? 'Arkadaşlarını kullanıcı adıyla ekle, ne izlediklerini canlı takip et ve tek tıkla senkronize Birlikte İzle odaları aç!'
                : 'Arama terimini veya filtreyi değiştirmeyi deneyin.'}
            </Text>

            {acceptedFriends.length === 0 && (
              <TVFocusable
                onPress={() => setShowAddFriendModal(true)}
                style={styles.emptyAddBtn}
                focusedStyle={styles.emptyAddBtnFocused}
                accessibilityLabel="Arkadaş Ekle"
              >
                <View style={styles.emptyAddBtnInner}>
                  <Ionicons name="person-add" size={16} color="#FFFFFF" />
                  <Text style={styles.emptyAddBtnText}>Arkadaş Bul & Ekle</Text>
                </View>
              </TVFocusable>
            )}
          </View>
        )}
      />

      {/* ============================================================ */}
      {/* 4. "ARKADAŞ EKLE" MODAL                                       */}
      {/* ============================================================ */}
      <Modal
        visible={showAddFriendModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddFriendModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isTV && styles.modalCardTV]}>
            {/* Modal Header */}
            <View style={styles.modalTopRow}>
              <Text style={styles.modalMainTitle}>Arkadaş Ekle</Text>
              <TVFocusable
                onPress={() => setShowAddFriendModal(false)}
                style={styles.modalCloseBtn}
                focusedStyle={styles.modalCloseBtnFocused}
              >
                <Ionicons name="close" size={20} color="#A1A1AA" />
              </TVFocusable>
            </View>

            <Text style={styles.modalDesc}>
              Kullanıcı adı yazarak arkadaşlarını ara ve anında istek gönder.
            </Text>

            {/* Input */}
            <View style={styles.inputWrap}>
              <Text style={styles.atPrefix}>@</Text>
              <TextInput
                style={styles.textInputBox}
                value={searchQuery}
                onChangeText={handleSearchUsers}
                placeholder="kullanici_adi"
                placeholderTextColor="#71717A"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              {isSearching && <ActivityIndicator size="small" color="#E50914" />}
            </View>

            {/* Search Results */}
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.uid}
              style={styles.modalList}
              contentContainerStyle={{ paddingVertical: 6 }}
              renderItem={({ item }) => {
                const isAlreadyFriend = acceptedFriends.some((f) => f.friendUid === item.uid);
                const isSentPending = sentRequests.some((f) => f.friendUid === item.uid);
                const isReceivedPending = incomingRequests.some((f) => f.friendUid === item.uid);
                const isSending = !!requestSendingUids[item.uid];

                return (
                  <View style={styles.userResultRow}>
                    <View style={styles.resultAvatar}>
                      <Text style={styles.resultAvatarLetter}>
                        {item.displayName?.[0]?.toUpperCase() ||
                          item.username?.[0]?.toUpperCase() ||
                          'U'}
                      </Text>
                    </View>

                    <View style={styles.resultInfoCol}>
                      <Text style={styles.resultDisplayName} numberOfLines={1}>
                        {item.displayName}
                      </Text>
                      <Text style={styles.resultUsername} numberOfLines={1}>
                        @{item.username}
                      </Text>
                    </View>

                    {isAlreadyFriend ? (
                      <View style={styles.tagAlreadyFriend}>
                        <Ionicons name="checkmark" size={13} color="#22C55E" style={{ marginRight: 3 }} />
                        <Text style={styles.tagAlreadyFriendText}>Arkadaşsınız</Text>
                      </View>
                    ) : isSentPending ? (
                      <View style={styles.tagPendingSent}>
                        <Text style={styles.tagPendingSentText}>İletildi</Text>
                      </View>
                    ) : isReceivedPending ? (
                      <TVFocusable
                        onPress={() => handleAcceptRequest(item.uid)}
                        style={styles.quickAcceptBtn}
                        focusedStyle={styles.quickAcceptBtnFocused}
                      >
                        <Text style={styles.quickAcceptBtnText}>Kabul Et</Text>
                      </TVFocusable>
                    ) : (
                      <TVFocusable
                        onPress={() => handleSendRequest(item)}
                        style={styles.quickSendBtn}
                        focusedStyle={styles.quickSendBtnFocused}
                        disabled={isSending}
                      >
                        {isSending ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.quickSendBtnText}>Ekle</Text>
                        )}
                      </TVFocusable>
                    )}
                  </View>
                );
              }}
              ListEmptyComponent={() => {
                if (searchQuery.trim().length >= 2 && !isSearching) {
                  return (
                    <View style={styles.modalEmptyState}>
                      <Text style={styles.modalEmptyText}>
                        "@{searchQuery}" kullanıcısı bulunamadı.
                      </Text>
                    </View>
                  );
                }
                return (
                  <View style={styles.modalEmptyState}>
                    <Text style={styles.modalEmptyMuted}>
                      Aramak için en az 2 karakter girin.
                    </Text>
                  </View>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* 5. "GELEN İSTEKLER" MODAL                                     */}
      {/* ============================================================ */}
      <Modal
        visible={showRequestsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRequestsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isTV && styles.modalCardTV]}>
            <View style={styles.modalTopRow}>
              <Text style={styles.modalMainTitle}>Arkadaşlık İstekleri</Text>
              <TVFocusable
                onPress={() => setShowRequestsModal(false)}
                style={styles.modalCloseBtn}
                focusedStyle={styles.modalCloseBtnFocused}
              >
                <Ionicons name="close" size={20} color="#A1A1AA" />
              </TVFocusable>
            </View>

            <Text style={styles.modalDesc}>
              Sana arkadaşlık isteği gönderen kullanıcılar:
            </Text>

            <FlatList
              data={incomingRequests}
              keyExtractor={(item) => item.friendUid}
              style={styles.modalList}
              contentContainerStyle={{ paddingVertical: 6 }}
              renderItem={({ item }) => {
                const isProcessing = !!actionProcessingUids[item.friendUid];

                return (
                  <View style={styles.requestCardRow}>
                    <View style={styles.resultAvatar}>
                      <Text style={styles.resultAvatarLetter}>
                        {item.friendDisplayName?.[0]?.toUpperCase() ||
                          item.friendUsername?.[0]?.toUpperCase() ||
                          'U'}
                      </Text>
                    </View>

                    <View style={styles.resultInfoCol}>
                      <Text style={styles.resultDisplayName} numberOfLines={1}>
                        {item.friendDisplayName}
                      </Text>
                      <Text style={styles.resultUsername} numberOfLines={1}>
                        @{item.friendUsername}
                      </Text>
                      <Text style={styles.requestTimeMuted}>
                        {formatRelativeTime(item.updatedAt)}
                      </Text>
                    </View>

                    <View style={styles.requestBtnGroup}>
                      <TVFocusable
                        onPress={() => handleAcceptRequest(item.friendUid)}
                        style={styles.acceptPillBtn}
                        focusedStyle={styles.acceptPillBtnFocused}
                        disabled={isProcessing}
                      >
                        <Text style={styles.acceptPillBtnText}>Kabul Et</Text>
                      </TVFocusable>

                      <TVFocusable
                        onPress={() => handleRejectRequest(item.friendUid)}
                        style={styles.rejectPillBtn}
                        focusedStyle={styles.rejectPillBtnFocused}
                        disabled={isProcessing}
                      >
                        <Ionicons name="close" size={16} color="#71717A" />
                      </TVFocusable>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={() => (
                <View style={styles.modalEmptyState}>
                  <Ionicons name="mail-open-outline" size={32} color="#71717A" style={{ marginBottom: 8 }} />
                  <Text style={styles.modalEmptyText}>Bekleyen istek bulunmuyor.</Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Friend Profile & Watching History Modal */}
      <FriendProfileModal
        visible={!!selectedProfileUid}
        friendUid={selectedProfileUid}
        onClose={() => setSelectedProfileUid(null)}
        onSelectMedia={(m) => openDetail(m)}
        onWatchTogether={(f, m) => handleWatchTogether(f, m)}
        onOpenDirectMessage={(f) => {
          setSelectedProfileUid(null);
          setActiveDmFriend(f);
        }}
      />

      {/* 1'e 1 Doğrudan Mesajlaşma Modal */}
      {user?.uid && (
        <DirectMessageModal
          visible={!!activeDmFriend}
          friend={activeDmFriend}
          currentUser={{
            uid: user.uid,
            displayName: currentUserProfile?.displayName,
            username: currentUserProfile?.username,
          }}
          onClose={() => setActiveDmFriend(null)}
          onSelectMedia={(m) => openDetail(m)}
          onJoinWatchParty={async (code) => {
            try {
              const res = await joinWatchPartyRoom(code, user, activeProfile);
              if (res.success && res.room) {
                openWatchParty(res.room);
              }
            } catch (e) {
              console.warn('Failed to join watch party from DM:', e);
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070709',
  },

  /* ──── HEADER ──── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: isTV ? 40 : 20,
    paddingBottom: 12,
  },
  headerTV: {
    paddingHorizontal: 40,
    paddingBottom: 16,
  },
  headerBrandTitle: {
    fontSize: isTV ? 32 : 26,
    fontWeight: '900',
    color: '#E50914',
    letterSpacing: 2.5,
  },
  headerAccountHandle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A1A1AA',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconActionBtn: {
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'visible',
    position: 'relative',
  },
  iconActionBtnFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    transform: [{ scale: 1.05 }],
  },
  iconActionBtnInner: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  badgeCount: {
    position: 'absolute',
    top: -7,
    right: -7,
    backgroundColor: '#E50914',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#070709',
    zIndex: 9999,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
  badgeCountText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
  },
  addFriendPrimaryBtn: {
    borderRadius: 20,
    backgroundColor: '#E50914',
  },
  addFriendPrimaryBtnFocused: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
    transform: [{ scale: 1.05 }],
  },
  addFriendPrimaryBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    gap: 5,
  },
  addFriendPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },

  /* ──── FILTER TABS & SEARCH ──── */
  filterBarSection: {
    paddingHorizontal: isTV ? 40 : 20,
    paddingBottom: 14,
    gap: 10,
  },
  filterBarSectionTV: {
    paddingHorizontal: 40,
    paddingBottom: 16,
  },
  filterTabsContent: {
    gap: 8,
    paddingRight: 20,
  },
  tabChip: {
    paddingVertical: 6.5,
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabChipActive: {
    backgroundColor: '#E50914',
    borderColor: '#E50914',
  },
  tabChipFocused: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
    transform: [{ scale: 1.05 }],
  },
  tabChipText: {
    color: '#A1A1AA',
    fontSize: 11.5,
    fontWeight: '700',
  },
  tabChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  chipInnerWithDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchInput: {
    color: '#FFFFFF',
    fontSize: 13,
    flex: 1,
    paddingVertical: 2,
  },

  /* ──── FRIENDS LIST ──── */
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 10,
  },
  listContentTV: {
    paddingHorizontal: 40,
    paddingBottom: 60,
    gap: 14,
  },
  listEmptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  friendCard: {
    backgroundColor: '#121217',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 12,
  },
  friendCardTV: {
    padding: 18,
    borderRadius: 20,
  },
  cardHeaderFocusable: {
    borderRadius: 12,
  },
  cardHeaderFocused: {
    backgroundColor: isTV ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)',
    borderColor: isTV ? '#E50914' : 'transparent',
    borderWidth: isTV ? 2 : 0,
    borderRadius: 12,
    transform: isTV ? [{ scale: 1.02 }] : undefined,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 2,
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E1E26',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  avatarStatusBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#121217',
  },
  badgeWatching: {
    backgroundColor: '#22C55E',
  },
  badgeOnline: {
    backgroundColor: '#E4E4E7',
  },
  badgeOffline: {
    backgroundColor: '#71717A',
  },
  userInfoCol: {
    flex: 1,
  },
  userNameText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
  userHandleText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  statusPillRight: {
    alignItems: 'flex-end',
  },
  watchingLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  greenPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  watchingLivePillText: {
    color: '#4ADE80',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  onlinePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  onlinePillText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '600',
  },
  offlineTimeText: {
    color: '#52525B',
    fontSize: 11,
    fontWeight: '500',
  },

  /* ──── WATCHING BANNER (INSIDE CARD) ──── */
  watchingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  watchingPoster: {
    width: 38,
    height: 54,
    borderRadius: 6,
    backgroundColor: '#1E1E26',
    marginRight: 10,
  },
  watchingPosterPlaceholder: {
    width: 38,
    height: 54,
    borderRadius: 6,
    backgroundColor: '#1E1E26',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  watchingMetaCol: {
    flex: 1,
    marginRight: 8,
  },
  watchingTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  watchingSubtitle: {
    color: '#A1A1AA',
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
  watchPartyBtn: {
    backgroundColor: '#E50914',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  watchPartyBtnFocused: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
    transform: [{ scale: 1.06 }],
  },
  watchPartyBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  watchPartyBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },

  /* ──── EMPTY STATE ──── */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 40,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.25)',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyDesc: {
    color: '#71717A',
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 340,
    marginBottom: 20,
  },
  emptyAddBtn: {
    borderRadius: 14,
    backgroundColor: '#E50914',
  },
  emptyAddBtnFocused: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
    transform: [{ scale: 1.05 }],
  },
  emptyAddBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  /* ──── MODALS ──── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    backgroundColor: '#131318',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 24,
  },
  modalCardTV: {
    maxWidth: 540,
    padding: 28,
  },
  modalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalMainTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  modalCloseBtn: {
    padding: 4,
    borderRadius: 8,
  },
  modalCloseBtnFocused: {
    borderColor: '#FFFFFF',
    borderWidth: 1,
  },
  modalDesc: {
    color: '#A1A1AA',
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 16,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  atPrefix: {
    color: '#E50914',
    fontSize: 16,
    fontWeight: '800',
    marginRight: 6,
  },
  textInputBox: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 10,
  },
  modalList: {
    maxHeight: 280,
  },
  userResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  resultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  resultAvatarLetter: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  resultInfoCol: {
    flex: 1,
  },
  resultDisplayName: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  resultUsername: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 1,
  },
  tagAlreadyFriend: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  tagAlreadyFriendText: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '700',
  },
  tagPendingSent: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
  },
  tagPendingSentText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
  },
  quickAcceptBtn: {
    backgroundColor: '#22C55E',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickAcceptBtnFocused: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
    transform: [{ scale: 1.05 }],
  },
  quickAcceptBtnText: {
    color: '#052E16',
    fontSize: 11.5,
    fontWeight: '800',
  },
  quickSendBtn: {
    backgroundColor: '#E50914',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickSendBtnFocused: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
    transform: [{ scale: 1.05 }],
  },
  quickSendBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  modalEmptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  modalEmptyText: {
    color: '#E4E4E7',
    fontSize: 12.5,
    fontWeight: '600',
  },
  modalEmptyMuted: {
    color: '#71717A',
    fontSize: 12,
  },
  requestCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  requestTimeMuted: {
    color: '#71717A',
    fontSize: 10,
    marginTop: 2,
  },
  requestBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  acceptPillBtn: {
    backgroundColor: '#22C55E',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  acceptPillBtnFocused: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
    transform: [{ scale: 1.05 }],
  },
  acceptPillBtnText: {
    color: '#052E16',
    fontSize: 11.5,
    fontWeight: '800',
  },
  rejectPillBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    padding: 6,
  },
  rejectPillBtnFocused: {
    borderColor: '#FFFFFF',
    borderWidth: 1,
  },
});
