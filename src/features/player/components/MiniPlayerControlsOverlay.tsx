import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Animated } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface MiniPlayerControlsOverlayProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onExpand: () => void;
  onClose: () => void;
  onSeekRelative?: (seconds: number) => void;
  currentTime: number;
  duration: number;
  title: string;
}

function formatMiniTime(sec: number): string {
  if (!sec || isNaN(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

export function MiniPlayerControlsOverlay({
  isPlaying,
  onPlayPause,
  onExpand,
  onClose,
  onSeekRelative,
  currentTime,
  duration,
  title,
}: MiniPlayerControlsOverlayProps) {
  const [showControls, setShowControls] = useState(false);
  const hideTimerRef = useRef<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const resetHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setShowControls(false));
    }, 3200);
  };

  const handleToggleControls = () => {
    if (!showControls) {
      setShowControls(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      resetHideTimer();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowControls(false));
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const progress = duration > 0 ? Math.min(Math.max(currentTime / duration, 0), 1) : 0;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Tap Surface */}
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={handleToggleControls}
      >
        {showControls && (
          <Animated.View style={[styles.controlsContainer, { opacity: fadeAnim }]}>
            {/* Top Gradient */}
            <LinearGradient
              colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.4)', 'transparent']}
              style={styles.topGradient}
              pointerEvents="none"
            />

            {/* Bottom Gradient */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.9)']}
              style={styles.bottomGradient}
              pointerEvents="none"
            />

            {/* Top Bar */}
            <View style={styles.topRow}>
              <View style={styles.titleWrap}>
                <View style={styles.liveDot} />
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
              </View>
              <View style={styles.topActions}>
                {/* Fullscreen / Expand */}
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    onExpand();
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="fullscreen" size={18} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Close */}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.closeBtn]}
                  onPress={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={15} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Center Controls: Rewind - Play/Pause - Fast Forward */}
            <View style={styles.centerControlsRow}>
              {onSeekRelative && (
                <TouchableOpacity
                  style={styles.seekBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    resetHideTimer();
                    onSeekRelative(-10);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="play-back" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.playPauseBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  resetHideTimer();
                  onPlayPause();
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={22}
                  color="#FFFFFF"
                  style={!isPlaying ? { marginLeft: 2 } : undefined}
                />
              </TouchableOpacity>

              {onSeekRelative && (
                <TouchableOpacity
                  style={styles.seekBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    resetHideTimer();
                    onSeekRelative(10);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="play-forward" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Bottom Time Counter */}
            <View style={styles.bottomInfoRow}>
              <Text style={styles.timeTxt}>
                {formatMiniTime(currentTime)} / {formatMiniTime(duration)}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Persistent Bottom Progress Bar */}
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  controlsContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 48,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E50914',
    marginRight: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  closeBtn: {
    backgroundColor: 'rgba(229, 9, 20, 0.3)',
    borderColor: 'rgba(229, 9, 20, 0.5)',
  },
  centerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    zIndex: 10,
  },
  seekBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  playPauseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E50914',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomInfoRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 10,
    paddingBottom: 2,
    paddingRight: 2,
  },
  timeTxt: {
    color: '#D4D4D8',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  progressBarTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#E50914',
  },
});
