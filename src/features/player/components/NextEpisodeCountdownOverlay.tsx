import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { TVFocusable } from '@/components/TVFocusable';
import { TMDB_IMAGE_BASE_URL } from '@/config/tmdb';

const isTV = Platform.isTV;

export interface NextEpisodeCountdownOverlayProps {
  visible: boolean;
  nextMedia: any;
  countdownSeconds?: number;
  onPlayNext: () => void;
  onDismiss: () => void;
}

export function NextEpisodeCountdownOverlay({
  visible,
  nextMedia,
  countdownSeconds = 5,
  onPlayNext,
  onDismiss,
}: NextEpisodeCountdownOverlayProps) {
  const { width } = useWindowDimensions();
  const isDesktopOrTv = isTV || width > 768;

  const [secondsRemaining, setSecondsRemaining] = useState(countdownSeconds);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;

  // Handle slide/fade in/out animations
  useEffect(() => {
    if (visible) {
      setSecondsRemaining(countdownSeconds);
      progressAnim.setValue(1);

      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 9,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: countdownSeconds * 1000,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 400,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, countdownSeconds, slideAnim, fadeAnim, progressAnim]);

  // Handle countdown interval
  useEffect(() => {
    if (!visible || !nextMedia) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onPlayNext();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [visible, nextMedia, onPlayNext]);

  if (!visible || !nextMedia) return null;

  const episodeNumber = nextMedia.episode_number || nextMedia.IndexNumber || 1;
  const seasonNumber = nextMedia.season_number || nextMedia.ParentIndexNumber || 1;
  const episodeTitle = nextMedia.name || nextMedia.title || `${episodeNumber}. Bölüm`;
  const showTitle = nextMedia.show_title || nextMedia.SeriesName || '';

  const rawImage =
    nextMedia.still_path ||
    nextMedia.backdrop_path ||
    nextMedia.poster_path ||
    nextMedia.stillUrl ||
    nextMedia.backdropUrl ||
    nextMedia.posterUrl;

  const thumbnailUri = rawImage
    ? (rawImage.startsWith('http') ? rawImage : `${TMDB_IMAGE_BASE_URL}/w500${rawImage}`)
    : null;

  return (
    <Animated.View
      style={[
        styles.container,
        isDesktopOrTv ? styles.containerDesktop : styles.containerMobile,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.card}>
        {/* Üst İlerleme Çubuğu (Smooth Progress Bar) */}
        <View style={styles.progressBarBackground}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        <View style={styles.contentRow}>
          {/* Bölüm Küçük Resmi (Thumbnail) */}
          <View style={styles.thumbnailContainer}>
            {thumbnailUri ? (
              <Image source={{ uri: thumbnailUri }} style={styles.thumbnail} contentFit="cover" />
            ) : (
              <View style={[styles.thumbnail, styles.placeholderThumbnail]}>
                <Ionicons name="film-outline" size={28} color="#888" />
              </View>
            )}
            <View style={styles.countdownBadge}>
              <Text style={styles.countdownBadgeTxt}>{secondsRemaining}s</Text>
            </View>
          </View>

          {/* Bölüm Bilgileri */}
          <View style={styles.infoContainer}>
            <View style={styles.badgeRow}>
              <View style={styles.upNextTag}>
                <Text style={styles.upNextTagTxt}>SIRADAKİ BÖLÜM</Text>
              </View>
              {showTitle ? (
                <Text style={styles.showTitleTxt} numberOfLines={1}>
                  {showTitle}
                </Text>
              ) : null}
            </View>

            <Text style={styles.episodeHeaderTxt} numberOfLines={1}>
              S{seasonNumber}:B{episodeNumber} • {episodeTitle}
            </Text>

            <Text style={styles.autoAdvanceTxt}>
              {secondsRemaining > 0
                ? `${secondsRemaining} saniye içinde otomatik başlatılıyor...`
                : 'Başlatılıyor...'}
            </Text>

            {/* Aksiyon Butonları */}
            <View style={styles.actionsRow}>
              <TVFocusable
                hasTVPreferredFocus={isTV}
                style={styles.playNowBtn}
                focusedStyle={styles.playNowBtnFocused}
                onPress={onPlayNext}
                accessibilityLabel="Şimdi Başlat"
              >
                <Ionicons name="play" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.playNowBtnTxt}>Şimdi Başlat</Text>
              </TVFocusable>

              <TVFocusable
                style={styles.dismissBtn}
                focusedStyle={styles.dismissBtnFocused}
                onPress={onDismiss}
                accessibilityLabel="İptal"
              >
                <Text style={styles.dismissBtnTxt}>İptal</Text>
              </TVFocusable>
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 99999,
  },
  containerDesktop: {
    bottom: isTV ? 80 : 40,
    right: isTV ? 60 : 32,
    width: 440,
  },
  containerMobile: {
    bottom: 24,
    left: 16,
    right: 16,
  },
  card: {
    backgroundColor: 'rgba(14, 14, 18, 0.95)',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.7,
    shadowRadius: 18,
    elevation: 20,
  },
  progressBarBackground: {
    height: 4,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#E50914',
  },
  contentRow: {
    flexDirection: 'row',
    padding: 14,
    gap: 14,
    alignItems: 'center',
  },
  thumbnailContainer: {
    width: isTV ? 140 : 110,
    height: isTV ? 85 : 68,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1a1a20',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholderThumbnail: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  countdownBadgeTxt: {
    color: '#E50914',
    fontSize: 11,
    fontWeight: '800',
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  upNextTag: {
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(229, 9, 20, 0.5)',
  },
  upNextTagTxt: {
    color: '#ff4d58',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  showTitleTxt: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  episodeHeaderTxt: {
    color: '#fff',
    fontSize: isTV ? 15 : 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  autoAdvanceTxt: {
    color: '#a1a1aa',
    fontSize: 11,
    marginBottom: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E50914',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
  },
  playNowBtnFocused: {
    backgroundColor: '#ff1f2d',
    transform: [{ scale: 1.05 }],
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#E50914',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  playNowBtnTxt: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  dismissBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissBtnFocused: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1,
    borderColor: '#fff',
  },
  dismissBtnTxt: {
    color: '#d4d4d8',
    fontSize: 12,
    fontWeight: '600',
  },
});
