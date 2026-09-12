import { TVModalSurface } from '@/components/TVModalSurface';
import { TVTouchable } from '@/components/TVTouchable';
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
  headers?: Record<string, string>;
  provider?: string;
  isDubbed?: boolean;
  isOriginalStream?: boolean;
  isFullStream?: boolean;
}

export function isUnknownAudioTrack(label?: string, language?: string): boolean {
  const raw = `${label || ''} ${language || ''}`.toLowerCase().trim();
  return (
    !raw ||
    raw === 'unknown' ||
    raw === 'unkown' ||
    raw === 'und' ||
    raw === 'undetermined' ||
    raw === 'belirsiz' ||
    raw === 'null' ||
    raw === 'undefined' ||
    raw === 'ses' ||
    raw === 'audio' ||
    raw === 'ses parçası' ||
    raw === 'audio track' ||
    raw === 'varsayılan ses' ||
    raw.includes('unknown') ||
    raw.includes('unkown')
  );
}

export function isGenericAudioPlaceholder(label?: string, language?: string): boolean {
  const rawLabel = (label || '').toLocaleLowerCase('tr-TR').trim();
  const rawLanguage = (language || '').toLowerCase().trim();
  return !rawLanguage && ['ses', 'audio', 'ses parçası', 'audio track'].includes(rawLabel);
}

export function formatAudioLabel(
  label?: string,
  language?: string,
  originalLanguage?: string
): string {
  const raw = `${label || ''} ${language || ''}`.toLowerCase().trim();

  // 1. Bilinen dilleri etiket veya dil kodundan yakala
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

  // 2. 'unknown' / 'unkown' / 'und' veya boş ise ASLA 'Unknown' döndürme!
  if (isUnknownAudioTrack(label, language)) {
    if (originalLanguage) {
      const orig = originalLanguage.toLowerCase().trim();
      if (orig === 'en' || orig.includes('eng')) return 'İngilizce';
      if (orig === 'tr' || orig.includes('tur')) return 'Türkçe';
      if (orig === 'es' || orig.includes('spa')) return 'İspanyolca';
      if (orig === 'fr' || orig.includes('fra')) return 'Fransızca';
      if (orig === 'de' || orig.includes('ger') || orig.includes('deu')) return 'Almanca';
      if (orig === 'it' || orig.includes('ita')) return 'İtalyanca';
      if (orig === 'ja' || orig.includes('jpn')) return 'Japonca';
      if (orig === 'ko' || orig.includes('kor')) return 'Korece';
      if (orig === 'ru' || orig.includes('rus')) return 'Rusça';
      if (orig === 'pt' || orig.includes('por')) return 'Portekizce';
    }
    return 'Orijinal Ses';
  }

  // 3. Dublaj / dub / orijinal eklerini temizle
  const cleaned = (label || language || '')
    .replace(/\s*\(?(dublaj|dubbed|dub|orijinal|original)\)?/gi, '')
    .trim();

  if (
    !cleaned ||
    isUnknownAudioTrack(cleaned, language) ||
    isGenericAudioPlaceholder(cleaned, language) ||
    cleaned.toLowerCase() === 'ses' ||
    cleaned.toLowerCase() === 'audio'
  ) {
    if (originalLanguage) {
      const orig = originalLanguage.toLowerCase().trim();
      if (orig === 'en' || orig.includes('eng')) return 'İngilizce';
      if (orig === 'tr' || orig.includes('tur')) return 'Türkçe';
      if (orig === 'es' || orig.includes('spa')) return 'İspanyolca';
      if (orig === 'fr' || orig.includes('fra')) return 'Fransızca';
      if (orig === 'de' || orig.includes('ger') || orig.includes('deu')) return 'Almanca';
      if (orig === 'it' || orig.includes('ita')) return 'İtalyanca';
      if (orig === 'ja' || orig.includes('jpn')) return 'Japonca';
      if (orig === 'ko' || orig.includes('kor')) return 'Korece';
      if (orig === 'ru' || orig.includes('rus')) return 'Rusça';
      if (orig === 'pt' || orig.includes('por')) return 'Portekizce';
    }
    return 'Orijinal Ses';
  }

  return cleaned;
}

interface AudioMenuModalProps {
  visible: boolean;
  onClose: () => void;
  player: any;
  availableAudioTracks?: any[];
  currentAudioTrack?: any;
  audioTracks: AudioTrack[];
  streamUrl: string | null;
  originalLanguage?: string;
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
  originalLanguage = 'en',
  onSelectTrack,
}: AudioMenuModalProps) {
  if (!visible) return null;

  console.log('[AudioMenuModal] ========================================');
  console.log('[AudioMenuModal] 🔊 Ses Menüsü Açıldı.');
  console.log('[AudioMenuModal] 📥 availableAudioTracks (dahili):', (availableAudioTracks && availableAudioTracks.length > 0) ? availableAudioTracks : (player?.availableAudioTracks || []));
  console.log('[AudioMenuModal] 📥 audioTracks prop (harici/dublaj):', audioTracks);
  console.log('[AudioMenuModal] 📥 currentAudioTrack / player.audioTrack:', currentAudioTrack || player?.audioTrack || null);
  console.log('[AudioMenuModal] 📥 streamUrl:', streamUrl);
  console.log('[AudioMenuModal] 📥 originalLanguage:', originalLanguage);

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
  const activeTrack: any = currentAudioTrack || player?.audioTrack || null;
  const isPlayingExternalStream = Boolean(
    streamUrl && (audioTracks || []).some((t: any) => t.url && t.url === streamUrl && !t.isOriginalStream)
  );

  // 1. Dâhili (embedded / expo-video) ses parçaları
  const allAvailable = (availableAudioTracks && availableAudioTracks.length > 0)
    ? availableAudioTracks
    : (player?.availableAudioTracks || []);

  allAvailable.forEach((track: any, i: number) => {
    if (isGenericAudioPlaceholder(track.label, track.language)) return;
    let formattedName = formatAudioLabel(track.label, track.language, originalLanguage);
    let lang = track.language || '';

    if (isUnknownAudioTrack(track.label, track.language)) {
      if (originalLanguage) {
        lang = originalLanguage;
      }
    }

    const langKey = (lang || formattedName || '').toLowerCase().trim();
    const labelKey = formattedName.toLowerCase().trim();

    // "unknown" veya "unkown" isimli hiçbir parça gösterilmesin!
    if (labelKey === 'unknown' || labelKey === 'unkown' || labelKey === 'und') {
      console.log(`[AudioMenuModal] 🚫 "Unknown" dâhili parça engellendi:`, track);
      return;
    }

    if (seenLanguages.has(langKey) || seenLabels.has(labelKey)) {
      console.log(`[AudioMenuModal] ⏭️ Dahili parça atlandı (tekrar): label=${track.label}, lang=${track.language}`);
      return;
    }
    if (langKey) seenLanguages.add(langKey);
    seenLabels.add(labelKey);

    const isActive = !isPlayingExternalStream && (activeTrack
      ? (activeTrack.id !== undefined && track.id !== undefined && activeTrack.id === track.id) ||
        (activeTrack.language && track.language && activeTrack.language.toLowerCase() === track.language.toLowerCase()) ||
        (activeTrack.label && track.label && activeTrack.label.toLowerCase() === track.label.toLowerCase()) ||
        (activeTrack.index !== undefined && track.index !== undefined && activeTrack.index === track.index)
      : (i === 0));

    unifiedTracks.push({
      id: track.id ? String(track.id) : `emb-${i}`,
      label: formattedName,
      language: lang,
      isEmbedded: true,
      isActive: Boolean(isActive),
      raw: track,
    });
  });

  // 2. Harici (external / m3u8 extracted / Turkish dubbing) ses parçaları
  (audioTracks || []).forEach((track: any, i: number) => {
    // Sahte VixSrc dil akışlarını engelle (VixSrc'de sadece m3u8 içindeki dâhili izler vardır)
    if (
      track.id?.startsWith('vix-language-') ||
      track.provider?.startsWith('VixSrc Direct (') ||
      (track.url && track.url.includes('vixsrc.to') && track.url.includes('&lang=') && !track.isOriginalStream)
    ) {
      return;
    }

    if (isGenericAudioPlaceholder(track.label, track.language)) return;
    let formattedName = formatAudioLabel(track.label, track.language, originalLanguage);
    let lang = track.language || '';

    if (isUnknownAudioTrack(track.label, track.language)) {
      if (originalLanguage) {
        lang = originalLanguage;
      }
    }

    // Dublaj ve normal izlerde temiz etiket
    let displayLabel = formattedName;
    if (track.isOriginalStream && isPlayingExternalStream) {
      displayLabel = `${formattedName} (Orijinal)`;
    }

    const langKey = (lang || formattedName || '').toLowerCase().trim();
    const labelKey = displayLabel.toLowerCase().trim();

    if (labelKey === 'unknown' || labelKey === 'unkown' || labelKey === 'und') {
      return;
    }

    const isDirectMatch = streamUrl === track.url;
    const isActive = isPlayingExternalStream
      ? isDirectMatch
      : (activeTrack
          ? (activeTrack.language && track.language && activeTrack.language.toLowerCase() === track.language.toLowerCase()) ||
            (activeTrack.label && track.label && activeTrack.label.toLowerCase() === track.label.toLowerCase())
          : isDirectMatch);

    // Kullanıcı kuralı: Birden fazla kaynaktan dublaj çekilse bile menüde yalnızca 1 tane Türkçe seçeneği görünsün
    const isTurkishTrack = langKey === 'tr' || labelKey.includes('türk');
    if (seenLabels.has(labelKey) || (isTurkishTrack && seenLanguages.has('tr'))) {
      if (track.isDubbed) {
        // Eğer listedeki mevcut Türkçe kaydı gömülü ise çalışan harici dublajla güncelle
        const existingIdx = unifiedTracks.findIndex(
          (t) => t.language === 'tr' || t.label.toLowerCase().includes('türk')
        );
        if (existingIdx !== -1 && (!unifiedTracks[existingIdx].raw?.url || !unifiedTracks[existingIdx].raw?.isDubbed)) {
          unifiedTracks[existingIdx] = {
            id: track.id ? String(track.id) : (track.url || `ext-${i}`),
            label: displayLabel,
            language: 'tr',
            isEmbedded: false,
            isActive: Boolean(isActive),
            raw: track,
          };
        }
      }
      return;
    }

    // Orijinal akış parçası ise ve dahili olarak zaten eklenmişse atla
    if (track.isOriginalStream && seenLanguages.has(langKey)) {
      return;
    }

    if (langKey) {
      seenLanguages.add(langKey);
    }
    seenLabels.add(labelKey);

    unifiedTracks.push({
      id: track.id ? String(track.id) : (track.url || `ext-${i}`),
      label: displayLabel,
      language: lang,
      isEmbedded: false,
      isActive: Boolean(isActive),
      raw: track,
    });
  });

  // Nihai filtre: Her ihtimale karşı "unknown" / "unkown" isimli hiçbir seçenek UI'a sızmasın
  const finalTracks = unifiedTracks.filter(
    (t) => t.label && t.label.toLowerCase() !== 'unknown' && t.label.toLowerCase() !== 'unkown' && t.label.toLowerCase() !== 'und'
  );

  // Hiçbir track aktif değilse ilkini aktif göster
  if (finalTracks.length > 0 && !finalTracks.some(t => t.isActive)) {
    finalTracks[0].isActive = true;
  }

  console.log('[AudioMenuModal] 🎯 Ekranda gösterilecek nihai ses seçenekleri:', finalTracks.map(t => ({
    id: t.id,
    label: t.label,
    lang: t.language,
    isEmbedded: t.isEmbedded,
    isActive: t.isActive,
    url: t.raw?.url ? `${t.raw.url.slice(0, 40)}...` : undefined,
  })));
  console.log('[AudioMenuModal] ========================================');

  return (
    <TVModalSurface onClose={onClose} style={styles.settingsOverlay}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.settingsCloseMask} />
      </TouchableWithoutFeedback>
      <View style={[styles.settingsPanel, isTV && { width: 380 }]}>
        <ScrollView>
          <Text style={[styles.panelSectionTitle, isTV && { fontSize: 14 }]}>SES DİLİ</Text>

          {finalTracks.map((track, i) => {
            const shouldFocus = isTV && track.isActive;
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
                  AsyncStorage.setItem('preferred_audio_lang', track.language || track.label).catch(() => {});
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

          {finalTracks.length === 0 && (
            <Text style={styles.infoTxt}>Başka ses seçeneği yok</Text>
          )}
        </ScrollView>
        {Platform.isTV && <TVFocusable onPress={onClose} style={{ padding: 12, marginTop: 8 }} accessibilityLabel="Kapat"><Text style={{ color: '#fff', fontSize: 18 }}>Kapat</Text></TVFocusable>}
      </View>
    </TVModalSurface>
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
    fontSize: Platform.isTV ? 15 : 11,
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
