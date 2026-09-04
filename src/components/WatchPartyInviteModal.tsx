import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TVFocusable } from '@/components/TVFocusable';
import { useAuth } from '@/contexts/AuthContext';
import { useUiStore } from '@/store/uiStore';
import { WatchPartyInvite } from '@/types/social';
import {
  subscribeToWatchPartyInvites,
  respondToWatchPartyInvite,
} from '@/services/socialService';
import { joinWatchPartyRoom } from '@/services/watchPartyService';
import { TMDB_IMAGE_BASE_URL } from '@/config/tmdb';

function getPosterUrl(media: any): string | null {
  if (!media) return null;
  const path = media.poster_path || media.posterUrl || media.backdrop_path || media.backdropUrl;
  if (!path) return null;
  if (typeof path === 'string' && (path.startsWith('http://') || path.startsWith('https://'))) {
    return path;
  }
  return `${TMDB_IMAGE_BASE_URL}/w300${path}`;
}

export function WatchPartyInviteModal() {
  const { user, activeProfile } = useAuth();
  const openWatchParty = useUiStore((state) => state.openWatchParty);
  const insets = useSafeAreaInsets();
  const isTV = Platform.isTV;

  const [invites, setInvites] = useState<WatchPartyInvite[]>([]);
  const [activeInvite, setActiveInvite] = useState<WatchPartyInvite | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Record<string, boolean>>({});

  // Slide and Fade animations
  const slideAnim = useRef(new Animated.Value(-150)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Real-time listener for invitations
  useEffect(() => {
    if (!user?.uid) {
      setInvites([]);
      setActiveInvite(null);
      return;
    }

    const unsub = subscribeToWatchPartyInvites(user.uid, (incomingInvites) => {
      setInvites(incomingInvites);
    });

    return () => unsub();
  }, [user?.uid]);

  // Update active invite when list changes
  useEffect(() => {
    const nextInvite = invites.find(
      (inv) => inv.status === 'pending' && !dismissedIds[inv.id]
    );
    setActiveInvite(nextInvite || null);
  }, [invites, dismissedIds]);

  // Handle entrance / exit animations
  useEffect(() => {
    if (activeInvite) {
      // Trigger Slide In
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Pulsing glow loop
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();

      return () => pulseLoop.stop();
    } else {
      // Slide Out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -150,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [activeInvite, slideAnim, opacityAnim, pulseAnim]);

  if (!activeInvite) return null;

  const senderName =
    activeInvite.senderDisplayName || activeInvite.senderUsername || 'Bir arkadaşın';
  const mediaTitle = activeInvite.media?.title || 'Film / Dizi';
  const posterUrl = getPosterUrl(activeInvite.media);
  const isTvShow = activeInvite.media?.type === 'tv' || !!activeInvite.media?.seasonNumber;
  const episodeInfo =
    isTvShow && activeInvite.media?.seasonNumber && activeInvite.media?.episodeNumber
      ? ` • S${activeInvite.media.seasonNumber}:B${activeInvite.media.episodeNumber}`
      : '';

  const handleAccept = async () => {
    if (!user || isJoining) return;
    try {
      setIsJoining(true);
      const res = await joinWatchPartyRoom(activeInvite.roomCode, user, activeProfile);
      if (res.success && res.room) {
        await respondToWatchPartyInvite(user.uid, activeInvite.id, 'accepted');
        setDismissedIds((prev) => ({ ...prev, [activeInvite.id]: true }));
        setActiveInvite(null);
        openWatchParty(res.room);
      } else {
        console.warn('Could not join room:', res.error);
        await respondToWatchPartyInvite(user.uid, activeInvite.id, 'declined');
        setDismissedIds((prev) => ({ ...prev, [activeInvite.id]: true }));
        setActiveInvite(null);
      }
    } catch (e) {
      console.warn('Accept invite error:', e);
    } finally {
      setIsJoining(false);
    }
  };

  const handleDecline = async () => {
    if (!user) return;
    try {
      setDismissedIds((prev) => ({ ...prev, [activeInvite.id]: true }));
      setActiveInvite(null);
      await respondToWatchPartyInvite(user.uid, activeInvite.id, 'declined');
    } catch (e) {
      console.warn('Decline invite error:', e);
    }
  };

  const topOffset = Math.max(insets.top, 16) + (isTV ? 20 : 8);

  return (
    <Animated.View
      style={[
        styles.container,
        isTV ? styles.containerTV : styles.containerMobile,
        {
          top: topOffset,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={[styles.card, isTV && styles.cardTV]}>
        {/* Glow Accent Background */}
        <LinearGradient
          colors={['rgba(34, 197, 94, 0.2)', 'rgba(18, 22, 32, 0.98)', '#0D111A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Ambient Top Light */}
        <Animated.View
          style={[
            styles.pulseGlow,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />

        {/* Top Header Row with Sender Info */}
        <View style={styles.headerRow}>
          <View style={styles.avatarPill}>
            <LinearGradient
              colors={['#22C55E', '#16A34A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarGradient}
            >
              <Ionicons name="people" size={14} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.partyBadgeText}>BİRLİKTE İZLE DAVETİ</Text>
          </View>

          <TVFocusable
            onPress={handleDecline}
            style={styles.closeBtn}
            focusedStyle={styles.closeBtnFocused}
            accessibilityLabel="Daveti Kapat"
          >
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
          </TVFocusable>
        </View>

        {/* Main Content Body */}
        <View style={styles.bodyRow}>
          {/* Media Poster Thumbnail */}
          <View style={styles.posterWrapper}>
            {posterUrl ? (
              <Image
                source={{ uri: posterUrl }}
                style={styles.posterImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={styles.posterFallback}>
                <Ionicons name="film-outline" size={24} color="#64748B" />
              </View>
            )}
            <View style={styles.liveLiveDot} />
          </View>

          {/* Invitation Text */}
          <View style={styles.textContainer}>
            <Text style={styles.inviteHeadline} numberOfLines={2}>
              <Text style={styles.senderHighlight}>{senderName}</Text> seni{' '}
              <Text style={styles.mediaHighlight}>{mediaTitle}</Text> izlemeye davet etti!
            </Text>

            <View style={styles.metaRow}>
              <Ionicons name="sparkles" size={12} color="#4ADE80" />
              <Text style={styles.metaText}>
                Canlı Senkronize Oda {episodeInfo}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionsRow}>
          {/* Reddet Button */}
          <TVFocusable
            onPress={handleDecline}
            style={styles.declineButton}
            focusedStyle={styles.declineButtonFocused}
            disabled={isJoining}
            accessibilityLabel="Daveti Reddet"
          >
            {({ focused }) => (
              <Text style={[styles.declineText, focused && styles.declineTextFocused]}>
                Reddet
              </Text>
            )}
          </TVFocusable>

          {/* Hemen Katıl Button */}
          <TVFocusable
            onPress={handleAccept}
            style={styles.acceptButton}
            focusedStyle={styles.acceptButtonFocused}
            disabled={isJoining}
            hasTVPreferredFocus
            accessibilityLabel="Hemen Katıl ve İzle"
          >
            {({ focused }) => (
              <LinearGradient
                colors={focused ? ['#4ADE80', '#22C55E'] : ['#22C55E', '#16A34A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.acceptGradient}
              >
                {isJoining ? (
                  <ActivityIndicator size="small" color="#052E16" />
                ) : (
                  <>
                    <Ionicons name="play" size={16} color="#052E16" />
                    <Text style={styles.acceptText}>Hemen Katıl</Text>
                  </>
                )}
              </LinearGradient>
            )}
          </TVFocusable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 99999,
    elevation: 50,
  },
  containerMobile: {
    left: 12,
    right: 12,
    alignItems: 'center',
  },
  containerTV: {
    right: 32,
    top: 32,
    width: 480,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    overflow: 'hidden',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 24,
  },
  cardTV: {
    maxWidth: 480,
    padding: 20,
    borderRadius: 24,
  },
  pulseGlow: {
    position: 'absolute',
    top: -40,
    left: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(34, 197, 94, 0.25)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  avatarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
    gap: 6,
  },
  avatarGradient: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partyBadgeText: {
    color: '#4ADE80',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnFocused: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: '#FFFFFF',
    borderWidth: 2,
    transform: [{ scale: 1.1 }],
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  posterWrapper: {
    position: 'relative',
    width: 58,
    height: 84,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    flexShrink: 0,
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  posterFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveLiveDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  inviteHeadline: {
    color: '#F1F5F9',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    marginBottom: 6,
  },
  senderHighlight: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  mediaHighlight: {
    color: '#4ADE80',
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  declineButton: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButtonFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.12)',
    transform: [{ scale: 1.05 }],
  },
  declineText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  declineTextFocused: {
    color: '#FFFFFF',
  },
  acceptButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  acceptButtonFocused: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
    transform: [{ scale: 1.06 }],
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 8,
  },
  acceptGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  acceptText: {
    color: '#052E16',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
