import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TVFocusable } from '@/components/TVFocusable';

interface PlayerControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onRewind: () => void;
  onForward: () => void;
  onFocusControls: () => void;
  controlsVisible: boolean;
  onNextEpisode?: () => void;
  hasNextEpisode: boolean;
}

export function PlayerControls(props: PlayerControlsProps) {
  return (
    <View style={styles.centerControls}>
      <TVFocusable
        style={styles.ctrlBtn}
        focusedStyle={styles.focusedCtrlBtn}
        onFocus={props.onFocusControls}
        onPress={props.onRewind}
      >
        <Ionicons name="play-back" size={40} color="#fff" />
      </TVFocusable>

      <TVFocusable
        hasTVPreferredFocus={props.controlsVisible}
        style={styles.ctrlBtnBig}
        focusedStyle={styles.focusedCtrlBtnBig}
        onFocus={props.onFocusControls}
        onPress={props.onPlayPause}
      >
        <Ionicons name={props.isPlaying ? 'pause' : 'play'} size={52} color="#fff" />
      </TVFocusable>

      <TVFocusable
        style={styles.ctrlBtn}
        focusedStyle={styles.focusedCtrlBtn}
        onFocus={props.onFocusControls}
        onPress={props.onForward}
      >
        <Ionicons name="play-forward" size={40} color="#fff" />
      </TVFocusable>

      {props.hasNextEpisode && props.onNextEpisode && (
        <TVFocusable
          style={styles.ctrlBtn}
          focusedStyle={styles.focusedCtrlBtn}
          onFocus={props.onFocusControls}
          onPress={props.onNextEpisode}
        >
          <Ionicons name="play-skip-forward" size={40} color="#fff" />
        </TVFocusable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
  },
  ctrlBtn: {
    padding: 10,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  focusedCtrlBtn: {
    transform: [{ scale: 1.15 }],
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: '#E50914',
    borderWidth: 2,
  },
  ctrlBtnBig: {
    padding: 15,
    borderRadius: 45,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  focusedCtrlBtnBig: {
    transform: [{ scale: 1.15 }],
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: '#E50914',
    borderWidth: 2,
  },
});
