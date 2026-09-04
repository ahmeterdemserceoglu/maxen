import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableWithoutFeedback, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TVFocusable } from '@/components/TVFocusable';

const isTV = Platform.isTV;

export interface AudioTrack {
  id?: string;
  label: string;
  language: string;
  url?: string;
}

export function formatAudioLabel(label?: string, language?: string): string {
  if (!label && !language) return 'Varsayılan Ses';
  const raw = `${label || ''} ${language || ''}`.toLowerCase().trim();
  if (raw.includes('türk') || raw.includes('tur') || raw === 'tr') {
    return 'Türkçe';
  }
  if (raw.includes('eng') || raw.includes('ing') || raw === 'en') {
    return 'İngilizce';
  }
  if (raw.includes('ita') || raw === 'it') {
    return 'İtalyanca';
  }
  if (raw.includes('ger') || raw.includes('deu') || raw === 'de') {
    return 'Almanca';
  }
  if (raw.includes('fre') || raw.includes('fra') || raw === 'fr') {
    return 'Fransızca';
  }
  if (raw.includes('spa') || raw.includes('esp') || raw === 'es') {
    return 'İspanyolca';
  }
  if (raw.includes('rus') || raw === 'ru') {
    return 'Rusça';
  }
  if (raw.includes('jpn') || raw === 'ja') {
    return 'Japonca';
  }
  if (raw.includes('kor') || raw === 'ko') {
    return 'Korece';
  }
  if (raw.includes('ara') || raw === 'ar') {
    return 'Arapça';
  }
  if (raw.includes('por') || raw === 'pt') {
    return 'Portekizce';
  }
  if (raw.includes('zho') || raw.includes('chi') || raw === 'zh') {
    return 'Çince';
  }
  if (raw.includes('hin') || raw === 'hi') {
    return 'Hintçe';
  }

  // Dublaj / dub / orijinal eklerini temizle
  const cleaned = (label || language || 'Alternatif Ses')
    .replace(/\s*\(?(dublaj|dubbed|dub|orijinal|original)\)?/gi, '')
    .trim();

  return cleaned || 'Alternatif Ses';
}

interface AudioMenuModalProps {
  visible: boolean;
  onClose: () => void;
  player: any;
  availableAudioTracks?: any[];
  currentAudioTrack?: any;
  audioTracks: AudioTrack[];
  streamUrl: string | null;
  onSelectTrack: (track: { id: string; label: string; language: string; isEmbedded: boolean; raw: any }) => void;
}

export function AudioMenuModal({
  visible,
  onClose,
  player,
  availableAudioTracks,
  currentAudioTrack,
  audioTracks,
  streamUrl,
  onSelectTrack,
}: AudioMenuModalProps) {
  if (!visible) return null;

  // Unified, deduplicated audio tracks (strictly 1 entry per language/label)
  const unifiedTracks: Array<{
    id: string;
    label: string;
    language: string;
    isEmbedded: boolean;
    isActive: boolean;
    raw: any;
  }> = [];

  const seenLanguages = new Set<string>();
  const seenLabels = new Set<string>();
  const activeTrack = currentAudioTrack || player?.audioTrack;

  // 1. Dâhili (embedded / expo-video) ses parçaları
  const allAvailable = (availableAudioTracks && availableAudioTracks.length > 0)
    ? availableAudioTracks
    : (player?.availableAudioTracks || []);

  allAvailable.forEach((track: any, i: number) => {
    const formattedName = formatAudioLabel(track.label, track.language);
    const langKey = (track.language || track.label || '').toLowerCase().trim();
    const labelKey = formattedName.toLowerCase().trim();

    if (seenLanguages.has(langKey) || seenLabels.has(labelKey)) return;
    if (langKey) seenLanguages.add(langKey);
    seenLabels.add(labelKey);

    const isActive = activeTrack
      ? (activeTrack.id !== undefined && track.id !== undefined && activeTrack.id === track.id) ||
        (activeTrack.language && track.language && activeTrack.language.toLowerCase() === track.language.toLowerCase()) ||
        (activeTrack.label && track.label && activeTrack.label.toLowerCase() === track.label.toLowerCase()) ||
        (activeTrack.index !== undefined && track.index !== undefined && activeTrack.index === track.index)
      : (i === 0);

    unifiedTracks.push({
      id: track.id ? String(track.id) : `emb-${i}`,
      label: formattedName,
      language: track.language || '',
      isEmbedded: true,
      isActive: Boolean(isActive),
      raw: track,
    });
  });

  // 2. Harici (external / m3u8 extracted) ses parçaları
  (audioTracks || []).forEach((track: any, i: number) => {
    const formattedName = formatAudioLabel(track.label, track.language);
    const langKey = (track.language || track.label || '').toLowerCase().trim();
    const labelKey = formattedName.toLowerCase().trim();

    if (seenLanguages.has(langKey) || seenLabels.has(labelKey)) return;
    if (langKey) seenLanguages.add(langKey);
    seenLabels.add(labelKey);

    const isActive = activeTrack
      ? (activeTrack.language && track.language && activeTrack.language.toLowerCase() === track.language.toLowerCase()) ||
        (activeTrack.label && track.label && activeTrack.label.toLowerCase() === track.label.toLowerCase())
      : (streamUrl === track.url);

    unifiedTracks.push({
      id: track.id ? String(track.id) : (track.url || `ext-${i}`),
      label: formattedName,
      language: track.language || '',
      isEmbedded: false,
      isActive: Boolean(isActive),
      raw: track,
    });
  });

  // Hiçbir track aktif değilse ilkini aktif göster
  if (unifiedTracks.length > 0 && !unifiedTracks.some(t => t.isActive)) {
    unifiedTracks[0].isActive = true;
  }

  return (
    <View style={styles.settingsOverlay}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.settingsCloseMask} />
      </TouchableWithoutFeedback>
      <View style={[styles.settingsPanel, isTV && { width: 380 }]}>
        <ScrollView>
          <Text style={[styles.panelSectionTitle, isTV && { fontSize: 14 }]}>SES DİLİ</Text>

          {unifiedTracks.map((track, i) => {
            const shouldFocus = isTV && (track.isActive || i === 0);
            return (
              <TVFocusable
                key={`audio-${track.id}-${i}`}
                hasTVPreferredFocus={shouldFocus}
                style={[
                  styles.panelItem,
                  track.isActive && styles.panelItemActive,
                  isTV && { paddingVertical: 20, minHeight: 64 }
                ]}
                focusedStyle={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, borderWidth: 2, borderColor: '#E50914' }}
                onPress={() => {
                  onSelectTrack(track);
                  onClose();
                  AsyncStorage.setItem('preferred_audio_lang', track.label).catch(() => {});
                }}
              >
                <Ionicons name="volume-high-outline" size={isTV ? 28 : 20} color={track.isActive ? '#E50914' : '#fff'} />
                <Text style={[styles.panelItemTxt, isTV && { fontSize: 18 }, track.isActive && styles.panelItemTxtActive]}>
                  {track.label}
                </Text>
                <View style={{ flex: 1 }} />
                {track.isActive && (
                  <Ionicons name="checkmark-circle" size={isTV ? 28 : 20} color="#E50914" />
                )}
              </TVFocusable>
            );
          })}

          {unifiedTracks.length === 0 && (
            <Text style={styles.infoTxt}>Başka ses seçeneği yok</Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  settingsOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  settingsCloseMask: {
    ...StyleSheet.absoluteFillObject,
  },
  settingsPanel: {
    width: 290,
    backgroundColor: 'rgba(18,18,20,0.92)',
    borderRadius: 14,
    marginRight: 24,
    paddingVertical: 14,
    paddingHorizontal: 12,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  panelSectionTitle: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
  },
  panelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginVertical: 1,
  },
  panelItemActive: {
    backgroundColor: '#0a4975',
  },
  panelItemTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  panelItemTxtActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  infoTxt: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 8,
    paddingHorizontal: 12,
  },
});
