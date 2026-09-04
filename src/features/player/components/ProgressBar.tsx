import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

const isTV = Platform.isTV;

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  panHandlers: any;
  onLayout?: (e: any) => void;
  formatTime: (sec: number) => string;
  isSeeking?: boolean;
  seekPreviewTime?: number;
  previewThumbnail?: any;
}

export function ProgressBar({
  currentTime,
  duration,
  panHandlers,
  onLayout,
  formatTime,
  isSeeking,
  seekPreviewTime,
  previewThumbnail,
}: ProgressBarProps) {
  const displayTime = isSeeking && seekPreviewTime !== undefined ? seekPreviewTime : currentTime;
  const percent = duration > 0 ? Math.max(0, Math.min(100, (displayTime / duration) * 100)) : 0;

  // Ekran kenarlarından taşmayı engelleyen dinamik yatay kaydırma
  const getBubbleOffset = (pct: number) => {
    if (pct < 18) return (18 - pct) * 3.2; // sola taşmayı önle, sağa kaydır
    if (pct > 82) return (82 - pct) * 3.2; // sağa taşmayı önle, sola kaydır
    return 0;
  };

  return (
    <View style={[styles.container, isTV && styles.containerTV]}>
      {isTV ? (
        <View style={styles.timeRowTV}>
          <View style={styles.timeBadgeTV}>
            <Ionicons name="play" size={14} color="#E50914" style={{ marginRight: 6 }} />
            <Text style={styles.timeTxtTV}>
              {formatTime(currentTime)} <Text style={styles.timeSeparatorTV}>/</Text> {formatTime(duration)}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.timeRow}>
          <Text style={styles.timeTxt}>{formatTime(currentTime)}</Text>
          <Text style={styles.timeTxt}>-{formatTime(Math.max(0, duration - currentTime))}</Text>
        </View>
      )}
      <View style={styles.progressRow}>
        <View
          style={styles.progressTrackContainer}
          {...panHandlers}
          onLayout={onLayout}
        >
          <View style={[styles.progressTrack, isTV && styles.progressTrackTV]}>
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
            <View style={[styles.progressDot, isTV && styles.progressDotTV, { left: `${percent}%` }]}>
              {isSeeking && (
                <View
                  style={[
                    styles.seekBubble,
                    { transform: [{ translateX: getBubbleOffset(percent) }] },
                  ]}
                  pointerEvents="none"
                >
                  <View style={[styles.thumbnailContainer, isTV && styles.thumbnailContainerTV]}>
                    {previewThumbnail ? (
                      <Image
                         source={previewThumbnail}
                         style={styles.thumbnailImg}
                         contentFit="cover"
                         transition={100}
                       />
                    ) : (
                      <View style={styles.thumbnailPlaceholder}>
                        <ActivityIndicator size="small" color="#E50914" />
                      </View>
                    )}
                    <View style={styles.timeBadge}>
                      <Text style={[styles.seekBubbleTxt, isTV && styles.seekBubbleTxtTV]} numberOfLines={1}>
                        {formatTime(displayTime)}
                      </Text>
                    </View>
                  </View>
                  {/* Minik üçgen ok ucu */}
                  <View style={styles.bubbleArrow} />
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 28,
    marginBottom: 20,
  },
  containerTV: {
    paddingHorizontal: 0,
    marginBottom: 16,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timeRowTV: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeBadgeTV: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  timeTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  timeTxtTV: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.6,
    fontVariant: ['tabular-nums'],
  },
  timeSeparatorTV: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '400',
  },
  progressRow: {
    width: '100%',
    height: 30,
    justifyContent: 'center',
  },
  progressTrackContainer: {
    width: '100%',
    height: 30,
    justifyContent: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 3,
  },
  progressTrackTV: {
    height: 10,
    borderRadius: 5,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#e50914',
    borderRadius: 5,
  },
  progressDot: {
    position: 'absolute',
    top: -7,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e50914',
    marginLeft: -10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  progressDotTV: {
    top: -11,
    width: 32,
    height: 32,
    borderRadius: 16,
    marginLeft: -16,
    borderWidth: 3,
  },
  seekBubble: {
    position: 'absolute',
    bottom: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  thumbnailContainer: {
    width: 140,
    height: 84,
    borderRadius: 8,
    backgroundColor: '#0F0F12',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 12,
  },
  thumbnailContainerTV: {
    width: 240,
    height: 135,
    borderWidth: 2,
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 20, 24, 0.95)',
  },
  timeBadge: {
    position: 'absolute',
    bottom: 4,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  seekBubbleTxt: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  seekBubbleTxtTV: {
    fontSize: 16,
  },
  bubbleArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
    marginTop: -0.5,
  },
});
