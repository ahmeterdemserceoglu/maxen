import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TVFocusable } from '@/components/TVFocusable';
import {
  type PlaybackSessionData,
  formatTime,
  clearActivePlaybackSession,
} from '@/services/crossDeviceHandoffService';

export interface CrossDeviceHandoffBannerProps {
  session: PlaybackSessionData | null;
  userId?: string;
  profileId?: string;
  onResume: (media: any, startSeconds: number) => void;
  onDismiss: () => void;
}

export function CrossDeviceHandoffBanner({
  session,
  userId,
  profileId,
  onResume,
  onDismiss,
}: CrossDeviceHandoffBannerProps) {
  const isTV = Platform.isTV;
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 768;

  const slideAnim = useRef(new Animated.Value(100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [secondsLeft, setSecondsLeft] = useState(14);

  useEffect(() => {
    if (!session) {
      slideAnim.setValue(100);
      opacityAnim.setValue(0);
      return;
    }

    setSecondsLeft(14);

    // Slide and fade in
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 50,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss countdown timer
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [session?.updatedAt]);

  if (!session) return null;

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (userId && profileId) {
        clearActivePlaybackSession(userId, profileId).catch(() => {});
      }
      onDismiss();
    });
  };

  const handleResume = () => {
    if (!session) return;
    const mediaToPlay = {
      ...session.media,
      positionSeconds: session.positionSeconds,
      durationSeconds: session.durationSeconds,
    };
    onResume(mediaToPlay, session.positionSeconds);
    handleDismiss();
  };

  const media = session.media;
  const posterUrl = media.posterUrl || media.backdropUrl;
  const isTvShow = media.type === 'tv' || !!media.season_number;
  const title = media.title || media.show_title || 'İçerik';
  const subtitle = isTvShow && media.season_number
    ? `Sezon ${media.season_number} • Bölüm ${media.episode_number || 1}`
    : `${formatTime(session.positionSeconds)} izlendi`;

  const deviceIcon =
    session.deviceType === 'web'
      ? 'laptop-outline'
      : session.deviceType === 'tv'
      ? 'tv-outline'
      : 'phone-portrait-outline';

  const deviceLabel =
    session.deviceType === 'web'
      ? 'Web Tarayıcıdan'
      : session.deviceType === 'tv'
      ? 'Başka TV\'den'
      : 'Telefondan';

  const progressPercent = Math.min(100, Math.max(5, Math.round(session.progress * 100)));

  return (
    <Animated.View
      style={[
        styles.container,
        isTV ? styles.containerTV : isDesktopWeb ? styles.containerWeb : styles.containerMobile,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <LinearGradient
        colors={['rgba(26, 26, 32, 0.96)', 'rgba(14, 14, 18, 0.98)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        {/* Glow Accent Border */}
        <View style={styles.glowLine} />

        <View style={styles.contentRow}>
          {/* Poster Thumbnail */}
          <View style={styles.posterWrap}>
            {posterUrl ? (
              <Image source={{ uri: posterUrl }} style={styles.posterImg} contentFit="cover" />
            ) : (
              <View style={styles.posterFallback}>
                <Ionicons name="play-circle" size={24} color="#E50914" />
              </View>
            )}
            <View style={styles.playBadge}>
              <Ionicons name="play" size={10} color="#FFFFFF" />
            </View>
          </View>

          {/* Info Details */}
          <View style={styles.infoCol}>
            <View style={styles.deviceHeader}>
              <Ionicons name={deviceIcon as any} size={12} color="#E50914" style={{ marginRight: 4 }} />
              <Text style={styles.deviceHeaderText}>
                {deviceLabel.toUpperCase()} DEVAM ET
              </Text>
              <Text style={styles.timerBadge}>{secondsLeft}s</Text>
            </View>

            <Text style={styles.titleText} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.subtitleText} numberOfLines={1}>
              {subtitle} • {formatTime(session.positionSeconds)}
            </Text>

            {/* Mini Progress Bar */}
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>

          {/* Close Button */}
          <TouchableOpacity onPress={handleDismiss} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={16} color="#888888" />
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TVFocusable
            onPress={handleResume}
            style={styles.resumeBtn}
            focusedStyle={styles.resumeBtnFocused}
            hasTVPreferredFocus={true}
          >
            <Ionicons name="play" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.resumeBtnText}>
              {isTV ? 'TV\'de Devam Et' : 'Kaldığın Yerden Devam Et'}
            </Text>
          </TVFocusable>

          <TVFocusable
            onPress={handleDismiss}
            style={styles.dismissBtn}
            focusedStyle={styles.dismissBtnFocused}
          >
            <Text style={styles.dismissBtnText}>Yoksay</Text>
          </TVFocusable>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 9999,
    elevation: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  containerTV: {
    bottom: 36,
    right: 48,
    width: 420,
  },
  containerWeb: {
    bottom: 28,
    right: 32,
    width: 390,
  },
  containerMobile: {
    bottom: 96,
    left: 16,
    right: 16,
  },
  cardGradient: {
    padding: 14,
    borderRadius: 16,
  },
  glowLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: '#E50914',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  posterWrap: {
    width: 52,
    height: 74,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#222',
    position: 'relative',
    marginRight: 12,
  },
  posterImg: {
    width: '100%',
    height: '100%',
  },
  posterFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(229, 9, 20, 0.9)',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  deviceHeaderText: {
    color: '#E50914',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    flex: 1,
  },
  timerBadge: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginRight: 4,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitleText: {
    color: '#AAAAAA',
    fontSize: 11.5,
    marginBottom: 6,
  },
  progressBarBg: {
    height: 3.5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#E50914',
    borderRadius: 2,
  },
  closeBtn: {
    padding: 4,
    alignSelf: 'flex-start',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resumeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  resumeBtnFocused: {
    backgroundColor: '#ff1f2f',
    borderColor: '#FFFFFF',
    borderWidth: 1.5,
    transform: [{ scale: 1.03 }],
  },
  resumeBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  dismissBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dismissBtnFocused: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: '#FFFFFF',
    borderWidth: 1,
  },
  dismissBtnText: {
    color: '#CCCCCC',
    fontSize: 12,
    fontWeight: '600',
  },
});
