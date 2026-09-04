import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ScreenLockOverlayProps {
  isLocked: boolean;
  onUnlock: () => void;
}

export function ScreenLockOverlay({ isLocked, onUnlock }: ScreenLockOverlayProps) {
  const [showUnlockBtn, setShowUnlockBtn] = useState(true);
  const opacityAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isLocked) {
      setShowUnlockBtn(true);
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShowUnlockBtn(false));
      }, 3500);

      return () => clearTimeout(timer);
    }
  }, [isLocked]);

  if (!isLocked) return null;

  const handleTap = () => {
    setShowUnlockBtn(true);
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setShowUnlockBtn(false));
    }, 3500);
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={handleTap}
      style={StyleSheet.absoluteFillObject}
    >
      {showUnlockBtn && (
        <Animated.View style={[styles.unlockContainer, { opacity: opacityAnim }]}>
          <TouchableOpacity
            style={styles.unlockBtn}
            onPress={onUnlock}
            activeOpacity={0.8}
          >
            <Ionicons name="lock-closed" size={22} color="#fff" />
            <Text style={styles.unlockTxt}>Kilidi Aç</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  unlockContainer: {
    position: 'absolute',
    left: 28,
    bottom: 36,
    zIndex: 9999,
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 20, 24, 0.88)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#e50914',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  unlockTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
