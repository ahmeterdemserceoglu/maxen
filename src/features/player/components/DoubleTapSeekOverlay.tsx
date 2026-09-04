import React, { useRef } from 'react';
import { View, StyleSheet, TouchableWithoutFeedback } from 'react-native';

interface DoubleTapSeekOverlayProps {
  isEmbedUrl: boolean;
  screenWidth: number;
  duration: number;
  player: any;
  onSeek: (newTime: number) => void;
  onToggleControls: () => void;
  prolongControls: () => void;
  onTriggerSeekAnim: (side: 'left' | 'right') => void;
  onStartFastForward?: () => void;
  onEndFastForward?: () => void;
}

export function DoubleTapSeekOverlay({
  isEmbedUrl,
  screenWidth,
  duration,
  player,
  onSeek,
  onToggleControls,
  prolongControls,
  onTriggerSeekAnim,
  onStartFastForward,
  onEndFastForward,
}: DoubleTapSeekOverlayProps) {
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const singleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFastForwardingRef = useRef(false);

  if (isEmbedUrl) return null;

  const handlePressOut = () => {
    if (isFastForwardingRef.current) {
      isFastForwardingRef.current = false;
      onEndFastForward?.();
    }
  };

  return (
    <TouchableWithoutFeedback
      delayLongPress={350}
      onLongPress={() => {
        // Uzun basıldığında tek tıklama zamanlayıcısını iptal et ve 2x Turbo hızlandırmayı başlat
        if (singleTapTimeoutRef.current) {
          clearTimeout(singleTapTimeoutRef.current);
          singleTapTimeoutRef.current = null;
        }
        lastTapRef.current = { time: 0, x: 0 };
        isFastForwardingRef.current = true;
        onStartFastForward?.();
      }}
      onPressOut={handlePressOut}
      onPress={(evt) => {
        // Eğer uzun basma aktif idiyse tıklamayı işleme alma
        if (isFastForwardingRef.current) {
          handlePressOut();
          return;
        }

        const now = Date.now();
        const { pageX } = evt.nativeEvent;
        const DOUBLE_TAP_DELAY = 280;

        // ÇİFT TIKLAMA
        if (lastTapRef.current.time > 0 && now - lastTapRef.current.time < DOUBLE_TAP_DELAY) {
          if (singleTapTimeoutRef.current) {
            clearTimeout(singleTapTimeoutRef.current);
            singleTapTimeoutRef.current = null;
          }

          const side = pageX < screenWidth / 2 ? 'left' : 'right';
          onTriggerSeekAnim(side);

          if (player) {
            try {
              const delta = side === 'left' ? -10 : 10;
              const current = player.currentTime || 0;
              const target = Math.max(0, Math.min(duration || 0, current + delta));
              player.currentTime = target;
              onSeek(target);
            } catch (e) {
              console.warn('Double tap seek error:', e);
            }
          }

          lastTapRef.current = { time: 0, x: 0 };
          prolongControls();
          return;
        }

        // İLK TIKLAMA
        lastTapRef.current = { time: now, x: pageX };

        if (singleTapTimeoutRef.current) {
          clearTimeout(singleTapTimeoutRef.current);
        }

        singleTapTimeoutRef.current = setTimeout(() => {
          onToggleControls();
          singleTapTimeoutRef.current = null;
          lastTapRef.current = { time: 0, x: 0 };
        }, DOUBLE_TAP_DELAY);
      }}
    >
      <View style={StyleSheet.absoluteFillObject} />
    </TouchableWithoutFeedback>
  );
}
