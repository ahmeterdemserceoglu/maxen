import { TVModalSurface } from '@/components/TVModalSurface';
import { TVTouchable } from '@/components/TVTouchable';
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableWithoutFeedback, Platform } from 'react-native';
import { TVFocusable } from '@/components/TVFocusable';
import { normalizeLang } from '@/features/player/services';
import { Ionicons } from '@expo/vector-icons';

const isTV = Platform.isTV;

export interface SubtitleTrack {
  label: string;
  lang: string;
  url: string;
  content?: string;
  fileId?: number;
  headers?: Record<string, string>;
  provider?: string;
}

interface SubtitleMenuModalProps {
  visible: boolean;
  onClose: () => void;
  selectedSubtitle: SubtitleTrack | null;
  subtitles: SubtitleTrack[];
  availableSubtitleTracks: any[];
  openSubtitlesLoading: boolean;
  onSelectSubtitle: (sub: SubtitleTrack | null) => void;
}

export function SubtitleMenuModal({
  visible,
  onClose,
  selectedSubtitle,
  subtitles,
  availableSubtitleTracks,
  openSubtitlesLoading,
  onSelectSubtitle,
}: SubtitleMenuModalProps) {
  if (!visible) return null;

  // Yalnız harici (VTT/SRT/HLS subtitle playlist) altyazıları göster.
  const allSubtitles = React.useMemo(() => {
    return subtitles.filter((subtitle) => Boolean(subtitle.url || subtitle.content));
  }, [subtitles]);

  const isSubActive = (sub: SubtitleTrack) => {
    if (!selectedSubtitle) return false;
    if (sub.url && selectedSubtitle.url) {
      return sub.url === selectedSubtitle.url;
    }
    if (sub.fileId && (selectedSubtitle as any).fileId) {
      return sub.fileId === (selectedSubtitle as any).fileId;
    }
    if ((sub as any).id && (selectedSubtitle as any).id) {
      return (sub as any).id === (selectedSubtitle as any).id;
    }
    return normalizeLang(sub.label || '').toLowerCase() === normalizeLang(selectedSubtitle.label || '').toLowerCase();
  };

  const isClosedActive = selectedSubtitle === null;

  return (
    <TVModalSurface onClose={onClose} style={styles.overlay}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.closeMask} />
      </TouchableWithoutFeedback>
      <View style={[styles.panel, isTV && { width: 380 }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={[styles.panelSectionTitle, isTV && { fontSize: 14 }]}>ALTYAZI DİLİ</Text>

          {/* 1. Altyazı Kapalı Seçeneği */}
          <TVFocusable
            hasTVPreferredFocus={isTV && isClosedActive}
            style={[
              styles.panelItem,
              isClosedActive && styles.panelItemActive,
              isTV && { minHeight: 64, paddingVertical: 20 }
            ]}
            focusedStyle={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, borderWidth: 2, borderColor: '#E50914' }}
            onPress={() => {
              onSelectSubtitle(null);
              onClose();
            }}
          >
            <Text style={[styles.panelItemTxt, isTV && { fontSize: 18 }, isClosedActive && styles.panelItemTxtActive]}>
              Kapalı
            </Text>
            <View style={{ flex: 1 }} />
            {isClosedActive && (
              <Ionicons name="checkmark-circle" size={isTV ? 28 : 20} color="#E50914" />
            )}
          </TVFocusable>

          {/* 2. Mevcut Altyazı Dilleri */}
          {allSubtitles.length > 0 && (
            <>
              {allSubtitles.map((sub, i) => {
                const isActive = isSubActive(sub);
                const label = normalizeLang(sub.label || sub.lang || `Altyazı ${i + 1}`);
                return (
                  <TVFocusable
                    key={`sub-${sub.url || sub.fileId || i}`}
                    hasTVPreferredFocus={isTV && isActive}
                    style={[
                      styles.panelItem,
                      isActive && styles.panelItemActive,
                      isTV && { minHeight: 64, paddingVertical: 20 }
                    ]}
                    focusedStyle={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, borderWidth: 2, borderColor: '#E50914' }}
                    onPress={() => {
                      onSelectSubtitle(sub);
                      onClose();
                    }}
                  >
                    <Text style={[styles.panelItemTxt, isTV && { fontSize: 18 }, isActive && styles.panelItemTxtActive]}>
                      {label}
                    </Text>
                    <View style={{ flex: 1 }} />
                    {isActive && (
                      <Ionicons name="checkmark-circle" size={isTV ? 28 : 20} color="#E50914" />
                    )}
                  </TVFocusable>
                );
              })}
            </>
          )}

          {allSubtitles.length === 0 && (
            <Text style={styles.infoTxt}>
              {openSubtitlesLoading ? 'Aranıyor...' : 'Altyazı bulunamadı'}
            </Text>
          )}
        </ScrollView>
        {Platform.isTV && <TVFocusable onPress={onClose} style={{ padding: 12, marginTop: 8 }} accessibilityLabel="Kapat"><Text style={{ color: '#fff', fontSize: 18 }}>Kapat</Text></TVFocusable>}
      </View>
    </TVModalSurface>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  closeMask: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    width: 290,
    backgroundColor: 'rgba(18,18,20,0.94)',
    borderRadius: 14,
    marginRight: 24,
    paddingVertical: 14,
    paddingHorizontal: 12,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  panelSectionTitle: {
    color: '#8e8e93',
    fontSize: Platform.isTV ? 15 : 11,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: 12,
    marginTop: 6,
    marginBottom: 8,
  },
  panelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginVertical: 2,
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
