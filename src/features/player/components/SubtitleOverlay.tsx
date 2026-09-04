import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SubtitleSettings, DEFAULT_SUBTITLE_SETTINGS } from './SubtitleAppearanceModal';

interface SubtitleOverlayProps {
  subtitleText: string;
  subtitleBottomOffset: number;
  controlsVisible?: boolean;
  isMiniPlayer?: boolean;
  settings?: SubtitleSettings;
}

export function SubtitleOverlay({ 
  subtitleText, 
  subtitleBottomOffset, 
  controlsVisible, 
  isMiniPlayer = false,
  settings = DEFAULT_SUBTITLE_SETTINGS 
}: SubtitleOverlayProps) {
  if (!subtitleText) return null;

  // Küçük ekranda alt boşluk ve font boyutunu uyarla
  const bottomOffset = isMiniPlayer ? 8 : (controlsVisible ? subtitleBottomOffset : 48);
  const fontSize = isMiniPlayer ? Math.max(Math.round(settings.fontSize * 0.45), 10) : settings.fontSize;
  const paddingHorizontal = isMiniPlayer ? 4 : 8;

  return (
    <View
      style={[
        styles.subtitleOverlay,
        isMiniPlayer ? styles.miniSubtitleOverlay : null,
        { bottom: bottomOffset },
      ]}
      pointerEvents="none"
    >
      <Text 
        style={[
          styles.subtitleText,
          {
            fontSize: fontSize,
            lineHeight: isMiniPlayer ? 13 : undefined,
            paddingHorizontal: paddingHorizontal,
            color: settings.color,
            backgroundColor: settings.backgroundColor,
            textShadowRadius: isMiniPlayer ? 1 : settings.textShadowRadius,
            textShadowColor: settings.textShadowColor,
          }
        ]}
      >
        {subtitleText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  subtitleOverlay: {
    position: 'absolute',
    left: 40,
    right: 40,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 99999,
    elevation: 100,
  },
  miniSubtitleOverlay: {
    left: 6,
    right: 6,
  },
  subtitleText: {
    fontWeight: '800',
    textAlign: 'center',
    textShadowOffset: { width: 1, height: 1 },
    borderRadius: 4,
  },
});
