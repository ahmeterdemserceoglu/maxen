import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface PlayerGestureHUDProps {
  visible: boolean;
  type: 'brightness' | 'volume' | null;
  value: number; // 0.0 to 1.0
}

export function PlayerGestureHUD({ visible, type, value }: PlayerGestureHUDProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const clampedValue = Math.max(0, Math.min(1, value ?? 1));
  const percentage = Math.round(clampedValue * 100);

  useEffect(() => {
    if (visible && type) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, type, opacity]);

  if (!type) return null;

  const isBrightness = type === 'brightness';

  const getVolumeIcon = () => {
    if (clampedValue <= 0.01) return 'volume-mute';
    if (clampedValue < 0.5) return 'volume-low';
    return 'volume-high';
  };

  return (
    <Animated.View
      style={[
        styles.hudContainer,
        isBrightness ? styles.leftSide : styles.rightSide,
        { opacity },
      ]}
      pointerEvents="none"
    >
      <View style={styles.floatingContainer}>
        {/* Icon with Drop Shadow */}
        <View style={styles.iconWrapper}>
          <Ionicons
            name={isBrightness ? 'sunny' : getVolumeIcon()}
            size={24}
            color="#FFFFFF"
            style={styles.iconShadow}
          />
        </View>

        {/* Minimalist Vertical Bar */}
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { height: `${percentage}%` }]} />
        </View>

        {/* Floating Percentage Text */}
        <Text style={styles.percentageText} numberOfLines={1}>
          %{percentage}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hudContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 9000,
    pointerEvents: 'none',
  },
  leftSide: {
    left: 40,
  },
  rightSide: {
    right: 40,
  },
  floatingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  iconWrapper: {
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconShadow: {
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  barTrack: {
    width: 5,
    height: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 3,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
  barFill: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
  percentageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 10,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 4,
    letterSpacing: -0.3,
  },
});
