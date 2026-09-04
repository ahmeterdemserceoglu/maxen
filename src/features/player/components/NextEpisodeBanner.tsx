import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { TVFocusable } from '@/components/TVFocusable';

const isTV = Platform.isTV;

interface NextEpisodeBannerProps {
  visible: boolean;
  nextEpisodeTitle?: string;
  nextEpisodeNumber?: number;
  nextSeasonNumber?: number;
  thumbnail?: string | null;
  onPlayNext: () => void;
  onDismiss: () => void;
  countdown?: number; // geri sayım (saniye, null ise yok)
}

export const NextEpisodeBanner: React.FC<NextEpisodeBannerProps> = ({
  visible,
  nextEpisodeTitle,
  nextEpisodeNumber,
  nextSeasonNumber,
  thumbnail,
  onPlayNext,
  onDismiss,
  countdown,
}) => {
  const slideAnim = useRef(new Animated.Value(500)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 500,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  if (!visible) return null;

  const episodeText = `S${nextSeasonNumber || 1}:E${nextEpisodeNumber || 1}`;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateX: slideAnim }],
        },
      ]}
    >
      <View style={styles.thumbnailContainer}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.thumbnail} contentFit="cover" />
        ) : (
          <View style={[styles.thumbnail, styles.placeholder]}>
            <Ionicons name="film-outline" size={24} color="#666" />
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.upNextText}>SIRADAKİ BÖLÜM</Text>
        <Text style={styles.titleText} numberOfLines={1}>
          {episodeText} {nextEpisodeTitle && `- ${nextEpisodeTitle}`}
        </Text>

        {countdown != null && countdown > 0 && (
          <Text style={styles.countdownText}>Otomatik: {countdown}s</Text>
        )}

        <View style={styles.actions}>
          <TVFocusable
            onPress={onPlayNext}
            hasTVPreferredFocus
            style={({ focused }) => [
              styles.playBtn,
              focused && styles.playBtnFocused,
            ]}
          >
            <Ionicons name="play" size={16} color="#fff" style={styles.playIcon} />
            <Text style={styles.playBtnText}>Şimdi Oynat</Text>
          </TVFocusable>

          <TVFocusable
            onPress={onDismiss}
            style={({ focused }) => [
              styles.dismissBtn,
              focused && styles.dismissBtnFocused,
            ]}
          >
            <Text style={styles.dismissBtnText}>İptal</Text>
          </TVFocusable>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: isTV ? 120 : 80,
    right: isTV ? 48 : 24,
    backgroundColor: 'rgba(15,15,18,0.92)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    zIndex: 9999,
  },
  thumbnailContainer: {
    width: isTV ? 240 : 160,
    height: isTV ? 135 : 90,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: isTV ? 20 : 12,
    justifyContent: 'center',
    minWidth: isTV ? 260 : 200,
    maxWidth: isTV ? 320 : 240,
  },
  upNextText: {
    color: '#fff',
    fontSize: 11,
    textTransform: 'uppercase',
    opacity: 0.6,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  titleText: {
    color: '#fff',
    fontSize: isTV ? 18 : 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  countdownText: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playBtn: {
    backgroundColor: '#e50914',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    justifyContent: 'center',
  },
  playBtnFocused: {
    backgroundColor: '#f40612',
    transform: [{ scale: 1.06 }],
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#ffffff',
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 10,
  },
  playIcon: {
    marginRight: 6,
  },
  playBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  dismissBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissBtnFocused: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    transform: [{ scale: 1.06 }],
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#ffffff',
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 10,
  },
  dismissBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
