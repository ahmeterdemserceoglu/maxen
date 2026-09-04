import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface DoubleTapSeekRippleProps {
  side: 'left' | 'right' | null;
  seconds?: number;
}

export function DoubleTapSeekRipple({ side, seconds = 10 }: DoubleTapSeekRippleProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.7)).current;
  const arrowAnim1 = useRef(new Animated.Value(0.3)).current;
  const arrowAnim2 = useRef(new Animated.Value(0.3)).current;
  const arrowAnim3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (side) {
      opacity.setValue(0);
      scale.setValue(0.7);

      // Ana dalga animasyonu
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();

      // Okların peş peşe yanıp sönme animasyonu (YouTube chevron ripple)
      const animateArrows = () => {
        Animated.sequence([
          Animated.timing(arrowAnim1, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(arrowAnim2, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(arrowAnim3, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(arrowAnim1, { toValue: 0.3, duration: 120, useNativeDriver: true }),
            Animated.timing(arrowAnim2, { toValue: 0.3, duration: 120, useNativeDriver: true }),
            Animated.timing(arrowAnim3, { toValue: 0.3, duration: 120, useNativeDriver: true }),
          ]),
        ]).start();
      };

      animateArrows();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [side, opacity, scale, arrowAnim1, arrowAnim2, arrowAnim3]);

  if (!side) return null;

  const isLeft = side === 'left';

  return (
    <Animated.View
      style={[
        styles.container,
        isLeft ? styles.leftContainer : styles.rightContainer,
        { opacity, transform: [{ scale }] },
      ]}
      pointerEvents="none"
    >
      <View style={[styles.rippleArc, isLeft ? styles.leftArc : styles.rightArc]}>
        {/* Animated Chevron Icons */}
        <View style={[styles.iconRow, isLeft && styles.iconRowReverse]}>
          <Animated.View style={{ opacity: arrowAnim1, transform: [{ scale: arrowAnim1 }] }}>
            <Ionicons
              name={isLeft ? 'play-back' : 'play-forward'}
              size={20}
              color="#FFFFFF"
            />
          </Animated.View>
          <Animated.View style={{ opacity: arrowAnim2, transform: [{ scale: arrowAnim2 }] }}>
            <Ionicons
              name={isLeft ? 'play-back' : 'play-forward'}
              size={24}
              color="#FFFFFF"
            />
          </Animated.View>
          <Animated.View style={{ opacity: arrowAnim3, transform: [{ scale: arrowAnim3 }] }}>
            <Ionicons
              name={isLeft ? 'play-back' : 'play-forward'}
              size={20}
              color="#FFFFFF"
            />
          </Animated.View>
        </View>

        {/* Seconds Text */}
        <Text style={styles.secondsText}>
          {seconds} saniye {isLeft ? 'geri' : 'ileri'}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '38%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9500,
    pointerEvents: 'none',
  },
  leftContainer: {
    left: 0,
  },
  rightContainer: {
    right: 0,
  },
  rippleArc: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  leftArc: {
    borderTopRightRadius: 260,
    borderBottomRightRadius: 260,
  },
  rightArc: {
    borderTopLeftRadius: 260,
    borderBottomLeftRadius: 260,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconRowReverse: {
    flexDirection: 'row-reverse',
  },
  secondsText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 4,
    letterSpacing: 0.3,
  },
});
