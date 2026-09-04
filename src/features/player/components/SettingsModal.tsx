import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TVFocusable } from '@/components/TVFocusable';
export interface SubtitleTrack {
  url?: string;
  lang?: string;
  label?: string;
}

interface SettingsModalProps {
  show: boolean;
  onClose: () => void;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  playerRef: any;
  subtitles: SubtitleTrack[];
  selectedSubtitle: SubtitleTrack | null;
  setSelectedSubtitle: (sub: SubtitleTrack | null) => void;
  availableSubtitleTracks: any[];
  currentSubtitleTrack: any;
  normalizeLang: (lang: string) => string;
  onPickExternalSubtitle?: (sub: SubtitleTrack) => void;
  onPickInternalSubtitle?: (track: any) => void;
  hasUserSelectedSubtitleRef: any;
}

export function SettingsModal(props: SettingsModalProps) {
  if (!props.show) return null;

  return (
    <View style={styles.settingsOverlay}>
      <TouchableWithoutFeedback onPress={props.onClose}>
        <View style={styles.settingsCloseMask} />
      </TouchableWithoutFeedback>
      <View style={styles.settingsPanel}>
        <ScrollView>
          <Text style={styles.panelSectionTitle}>OYNATMA HIZI</Text>
          <View style={styles.chipContainer}>
            {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((rate) => (
              <TVFocusable
                key={`speed-${rate}`}
                style={[styles.speedChip, props.playbackRate === rate && styles.panelItemActive]}
                focusedStyle={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6 }}
                onPress={() => {
                  props.setPlaybackRate(rate);
                  if (props.playerRef.current) {
                    try {
                      props.playerRef.current.preservesPitch = true;
                      props.playerRef.current.playbackRate = rate;
                    } catch (e) {}
                  }
                  props.onClose();
                }}
              >
                <Text style={[styles.speedChipTxt, props.playbackRate === rate && styles.panelItemTxtActive]}>
                  {rate === 1.0 ? '1.0x (Normal)' : `${rate}x`}
                </Text>
              </TVFocusable>
            ))}
          </View>

          <Text style={styles.panelSectionTitle}>ALTYAZILAR</Text>

          <TVFocusable
            style={[styles.panelItem, !props.selectedSubtitle && !props.currentSubtitleTrack && styles.panelItemActive]}
            focusedStyle={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8 }}
            onPress={() => {
              props.hasUserSelectedSubtitleRef.current = true;
              props.setSelectedSubtitle(null);
              if (props.playerRef.current) {
                try { props.playerRef.current.subtitleTrack = null; } catch (e) {}
              }
              props.onClose();
            }}
          >
            <Ionicons name="close-circle-outline" size={20} color={!props.selectedSubtitle && !props.currentSubtitleTrack ? '#E50914' : '#fff'} />
            <Text style={[styles.panelItemTxt, !props.selectedSubtitle && !props.currentSubtitleTrack && styles.panelItemTxtActive]}>
              Kapalı
            </Text>
          </TVFocusable>

          {/* Dâhili (Gömülü) Altyazılar */}
          {props.availableSubtitleTracks.map((track, i) => {
            const trackLang = props.normalizeLang(track.label || track.language || '');
            const isActive = props.currentSubtitleTrack && props.normalizeLang(props.currentSubtitleTrack.language || '') === trackLang;
            return (
              <TVFocusable
                key={`emb-${i}`}
                style={[styles.panelItem, isActive && styles.panelItemActive]}
                focusedStyle={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8 }}
                onPress={() => {
                  if (props.onPickInternalSubtitle) {
                    props.onPickInternalSubtitle(track);
                  }
                }}
              >
                <Ionicons name="text-outline" size={20} color={isActive ? '#E50914' : '#fff'} />
                <Text style={[styles.panelItemTxt, isActive && styles.panelItemTxtActive]}>
                  {track.label || track.language || `İz ${i + 1}`} (Gömülü)
                </Text>
              </TVFocusable>
            );
          })}

          {/* Harici (Dışarıdan Yüklenen) Altyazılar */}
          {props.subtitles.map((sub, i) => {
            const isActive = props.selectedSubtitle?.url === sub.url;
            return (
              <TVFocusable
                key={`ext-${i}`}
                style={[styles.panelItem, isActive && styles.panelItemActive]}
                focusedStyle={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8 }}
                onPress={() => {
                  if (props.onPickExternalSubtitle) {
                    props.onPickExternalSubtitle(sub);
                  }
                }}
              >
                <Ionicons name="document-text-outline" size={20} color={isActive ? '#E50914' : '#fff'} />
                <Text style={[styles.panelItemTxt, isActive && styles.panelItemTxtActive]}>
                  {sub.label || sub.lang || 'Bilinmeyen'} (Harici)
                </Text>
              </TVFocusable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  settingsOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    zIndex: 2000,
  },
  settingsCloseMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  settingsPanel: {
    width: 350,
    backgroundColor: 'rgba(17,17,17,0.95)',
    borderLeftWidth: 1,
    borderLeftColor: '#333',
    padding: 20,
    paddingTop: 40,
  },
  panelSectionTitle: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    letterSpacing: 1,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  speedChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  speedChipTxt: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
  },
  panelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  panelItemActive: {
    backgroundColor: 'rgba(229,9,20,0.1)',
  },
  panelItemTxt: {
    color: '#ddd',
    fontSize: 16,
    marginLeft: 12,
  },
  panelItemTxtActive: {
    color: '#E50914',
    fontWeight: 'bold',
  },
});
