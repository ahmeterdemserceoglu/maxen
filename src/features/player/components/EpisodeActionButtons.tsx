import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TVFocusable } from '@/components/TVFocusable';

interface EpisodeActionButtonsProps {
  showSkipIntro: boolean;
  showNextEpisode: boolean;
  controlsVisible: boolean;
  onSkipIntro: () => void;
  onPlayNextEpisode: () => void;
}

export function EpisodeActionButtons({
  showSkipIntro,
  showNextEpisode,
  controlsVisible,
  onSkipIntro,
  onPlayNextEpisode,
}: EpisodeActionButtonsProps) {
  if (!showSkipIntro && !showNextEpisode) return null;

  return (
    <View
      style={[
        styles.container,
        { bottom: controlsVisible ? 120 : 40 },
      ]}
      pointerEvents="box-none"
    >
      {showSkipIntro && (
        <TVFocusable
          hasTVPreferredFocus={true}
          style={styles.actionBtn}
          focusedStyle={styles.actionBtnFocused}
          onPress={onSkipIntro}
        >
          <Text style={styles.actionTxt}>İntroyu Atla</Text>
          <Ionicons name="play-forward" size={16} color="#000" style={styles.icon} />
        </TVFocusable>
      )}

      {showNextEpisode && !showSkipIntro && (
        <TVFocusable
          hasTVPreferredFocus={true}
          style={styles.actionBtn}
          focusedStyle={styles.actionBtnFocused}
          onPress={onPlayNextEpisode}
        >
          <Text style={styles.actionTxt}>Sonraki Bölüm</Text>
          <Ionicons name="play-skip-forward" size={16} color="#000" style={styles.icon} />
        </TVFocusable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 28,
    zIndex: 950,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  actionBtnFocused: {
    backgroundColor: '#fff',
    transform: [{ scale: 1.1 }],
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#ffffff',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 12,
  },
  actionTxt: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  icon: {
    marginLeft: 6,
  },
});
