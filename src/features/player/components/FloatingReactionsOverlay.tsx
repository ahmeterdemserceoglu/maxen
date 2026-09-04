import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';

export interface ReactionParticle {
  id: string;
  emoji: string;
  senderName?: string;
  timestamp: number;
}

interface FloatingReactionsOverlayProps {
  reactions?: ReactionParticle[];
}

interface ParticleState {
  id: string;
  emoji: string;
  senderName?: string;
  animY: Animated.Value;
  animX: Animated.Value;
  animOpacity: Animated.Value;
  animScale: Animated.Value;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function FloatingReactionsOverlay({ reactions = [] }: FloatingReactionsOverlayProps) {
  const [particles, setParticles] = useState<ParticleState[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!reactions || reactions.length === 0) return;

    const newReactions = reactions.filter(
      (r) => !seenIdsRef.current.has(r.id) && Date.now() - r.timestamp < 10000
    );

    if (newReactions.length === 0) return;

    newReactions.forEach((r) => seenIdsRef.current.add(r.id));

    // Limit set size to avoid memory leak
    if (seenIdsRef.current.size > 200) {
      const arr = Array.from(seenIdsRef.current).slice(-100);
      seenIdsRef.current = new Set(arr);
    }

    const created: ParticleState[] = newReactions.map((r) => {
      const animY = new Animated.Value(0);
      const animX = new Animated.Value((Math.random() - 0.5) * 40); // random wobble
      const animOpacity = new Animated.Value(1);
      const animScale = new Animated.Value(0.4);

      // Random drifting distance between 250px and 450px up
      const targetY = -280 - Math.random() * 180;
      const targetX = (Math.random() - 0.5) * 100;
      const duration = 2400 + Math.random() * 800;

      Animated.parallel([
        Animated.timing(animY, {
          toValue: targetY,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(animX, {
          toValue: targetX,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.spring(animScale, {
            toValue: 1.2,
            friction: 4,
            useNativeDriver: true,
          }),
          Animated.timing(animScale, {
            toValue: 1.0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(duration * 0.55),
          Animated.timing(animOpacity, {
            toValue: 0,
            duration: duration * 0.45,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        setParticles((prev) => prev.filter((p) => p.id !== r.id));
      });

      return {
        id: r.id,
        emoji: r.emoji,
        senderName: r.senderName,
        animY,
        animX,
        animOpacity,
        animScale,
      };
    });

    setParticles((prev) => [...prev.slice(-15), ...created]);
  }, [reactions]);

  if (particles.length === 0) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {particles.map((p) => (
        <Animated.View
          key={p.id}
          style={[
            styles.particleContainer,
            {
              opacity: p.animOpacity,
              transform: [
                { translateY: p.animY },
                { translateX: p.animX },
                { scale: p.animScale },
              ],
            },
          ]}
        >
          <Text style={styles.emojiText}>{p.emoji}</Text>
          {p.senderName ? (
            <View style={styles.senderPill}>
              <Text style={styles.senderNameText} numberOfLines={1}>
                {p.senderName}
              </Text>
            </View>
          ) : null}
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    right: 28,
    bottom: 90,
    width: 140,
    height: 380,
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 998,
  },
  particleContainer: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 34,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  senderPill: {
    backgroundColor: 'rgba(15, 15, 18, 0.75)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginTop: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  senderNameText: {
    color: '#E0E0E0',
    fontSize: 10,
    fontWeight: '600',
  },
});
