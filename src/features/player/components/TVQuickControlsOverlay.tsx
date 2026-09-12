import { TVModalSurface } from '@/components/TVModalSurface';
import React, { useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';

export interface TVQuickControlsOverlayProps {
  visibleMode: 'none' | 'topBar' | 'bottomShelf';
  onClose: () => void;

  // Audio & Subtitles
  audioTracks?: Array<{ id: string; label: string }>;
  currentAudioTrackId?: string;
  onSelectAudioTrack?: (id: string) => void;

  subtitles?: Array<{ id: string | number; label: string }>;
  currentSubtitleId?: string | number | null;
  onSelectSubtitle?: (id: string | number | null) => void;

  // Quality
  qualityList?: string[];
  currentQuality?: string;
  onSelectQuality?: (q: string) => void;

  // Aspect Ratio
  aspectRatioMode?: 'contain' | 'cover' | 'fill';
  onChangeAspectRatio?: (mode: 'contain' | 'cover' | 'fill') => void;

  // Bottom Shelf: Episodes / Playlist
  playlist?: any[];
  currentEpisodeIndex?: number;
  onSelectEpisode?: (index: number) => void;
  seriesTitle?: string;
}

export function TVQuickControlsOverlay({
  visibleMode,
  onClose,
  audioTracks = [],
  currentAudioTrackId,
  onSelectAudioTrack,
  subtitles = [],
  currentSubtitleId,
  onSelectSubtitle,
  qualityList = ['Otomatik', '1080p', '720p', '480p'],
  currentQuality = 'Otomatik',
  onSelectQuality,
  aspectRatioMode = 'contain',
  onChangeAspectRatio,
  playlist = [],
  currentEpisodeIndex = 0,
  onSelectEpisode,
  seriesTitle = 'Dizi Bölümleri',
}: TVQuickControlsOverlayProps) {
  const { width } = useWindowDimensions();
  const episodeList = useRef<FlatList>(null);
  // Settings stay open until a selection or Back; reading time is not limited.
  const resetAutoClose = () => {};

  if (visibleMode === 'none') return null;

  // 1. ÜST ŞERİT (Yukarı Tuşu ile Açılan Hızlı Ayarlar)
  if (visibleMode === 'topBar') {
    const cycleAudio = () => {
      if (audioTracks.length <= 1) return;
      const curIdx = audioTracks.findIndex((t) => t.id === currentAudioTrackId);
      const nextIdx = (curIdx + 1) % audioTracks.length;
      onSelectAudioTrack?.(audioTracks[nextIdx].id);
      resetAutoClose();
    };

    const cycleSubtitle = () => {
      const options = [{ id: null, label: 'Kapalı' }, ...subtitles];
      const curIdx = options.findIndex((s) => s.id === currentSubtitleId);
      const nextIdx = (curIdx + 1) % options.length;
      onSelectSubtitle?.(options[nextIdx].id);
      resetAutoClose();
    };

    const cycleQuality = () => {
      if (qualityList.length === 0) return;
      const curIdx = qualityList.findIndex((q) => q === currentQuality);
      const nextIdx = (curIdx + 1) % qualityList.length;
      onSelectQuality?.(qualityList[nextIdx]);
      resetAutoClose();
    };

    const cycleAspectRatio = () => {
      const modes: Array<'contain' | 'cover' | 'fill'> = ['contain', 'cover', 'fill'];
      const curIdx = modes.indexOf(aspectRatioMode);
      const nextIdx = (curIdx + 1) % modes.length;
      onChangeAspectRatio?.(modes[nextIdx]);
      resetAutoClose();
    };

    const currentAudioLabel =
      audioTracks.find((t) => t.id === currentAudioTrackId)?.label ||
      (audioTracks.length > 0 ? audioTracks[0].label : 'Varsayılan');
    const currentSubLabel =
      currentSubtitleId === null
        ? 'Kapalı'
        : subtitles.find((s) => s.id === currentSubtitleId)?.label || 'Türkçe';

    const aspectLabels = {
      contain: 'Sığdır',
      cover: 'Doldur',
      fill: '16:9',
    };

    return (
      <TVModalSurface onClose={onClose} style={StyleSheet.absoluteFill}>
      <View style={styles.topBarContainer} pointerEvents="box-none">
        <View style={[styles.topBarPill, { maxWidth: width - 64, flexWrap: 'wrap' }]}>
          {/* Audio Quick Pill */}
          <TVFocusable
            hasTVPreferredFocus={true}
            onPress={cycleAudio}
            style={styles.quickPill}
            focusedStyle={styles.quickPillFocused}
          >
            <Ionicons name="volume-high" size={18} color="#E50914" style={{ marginRight: 8 }} />
            <View>
              <ThemedText style={styles.pillLabel}>SES</ThemedText>
              <ThemedText style={styles.pillValue} numberOfLines={1}>
                {currentAudioLabel}
              </ThemedText>
            </View>
          </TVFocusable>

          {/* Subtitle Quick Pill */}
          <TVFocusable
            onPress={cycleSubtitle}
            style={styles.quickPill}
            focusedStyle={styles.quickPillFocused}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#3B82F6" style={{ marginRight: 8 }} />
            <View>
              <ThemedText style={styles.pillLabel}>ALTYAZI</ThemedText>
              <ThemedText style={styles.pillValue} numberOfLines={1}>
                {currentSubLabel}
              </ThemedText>
            </View>
          </TVFocusable>

          {/* Quality Quick Pill */}
          <TVFocusable
            onPress={cycleQuality}
            style={styles.quickPill}
            focusedStyle={styles.quickPillFocused}
          >
            <Ionicons name="sparkles" size={18} color="#F5C518" style={{ marginRight: 8 }} />
            <View>
              <ThemedText style={styles.pillLabel}>KALİTE</ThemedText>
              <ThemedText style={styles.pillValue}>{currentQuality}</ThemedText>
            </View>
          </TVFocusable>

          {/* Aspect Ratio Quick Pill */}
          <TVFocusable
            onPress={cycleAspectRatio}
            style={styles.quickPill}
            focusedStyle={styles.quickPillFocused}
          >
            <Ionicons name="scan-outline" size={18} color="#10B981" style={{ marginRight: 8 }} />
            <View>
              <ThemedText style={styles.pillLabel}>EN / BOY</ThemedText>
              <ThemedText style={styles.pillValue}>{aspectLabels[aspectRatioMode]}</ThemedText>
            </View>
          </TVFocusable>
          <TVFocusable style={styles.quickPill} onPress={onClose}><ThemedText style={styles.pillValue}>Kapat</ThemedText></TVFocusable>
        </View>
      </View>
      </TVModalSurface>
    );
  }

  // 2. ALT RAY (Aşağı Tuşu ile Açılan Hızlı Bölüm Listesi)
  if (visibleMode === 'bottomShelf') {
    if (!playlist || playlist.length === 0) {
      return (
        <TVModalSurface onClose={onClose} style={StyleSheet.absoluteFill}>
        <View style={styles.bottomShelfContainer} pointerEvents="box-none">
          <View style={styles.emptyShelfCard}>
            <Ionicons name="film-outline" size={24} color="#E50914" style={{ marginRight: 10 }} />
            <ThemedText style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
              Film Modu • Bu içerik tek bölümlüdür
            </ThemedText>
          </View>
          <TVFocusable hasTVPreferredFocus onPress={onClose}><ThemedText style={styles.pillValue}>Kapat</ThemedText></TVFocusable>
        </View>
        </TVModalSurface>
      );
    }

    return (
      <TVModalSurface onClose={onClose} style={StyleSheet.absoluteFill}>
        <View style={styles.bottomShelfContainer} pointerEvents="box-none">
        <View style={styles.shelfHeader}>
          <Ionicons name="layers" size={18} color="#E50914" style={{ marginRight: 8 }} />
          <ThemedText style={styles.shelfTitle}>{seriesTitle}</ThemedText>
          <ThemedText style={styles.shelfSubtitle}>Hızlı Bölüm Seçimi</ThemedText>
        </View>

        <FlatList
          ref={episodeList}
          data={playlist}
          keyExtractor={(ep, index) => String(ep.id ?? ep.Id ?? index)}
          initialScrollIndex={Math.max(0, Math.min(currentEpisodeIndex, playlist.length - 1))}
          initialNumToRender={6}
          maxToRenderPerBatch={3}
          windowSize={3}
          removeClippedSubviews={false}
          getItemLayout={(_, index) => ({ length: 214, offset: 36 + index * 214, index })}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shelfScrollContent}
          renderItem={({ item: ep, index: idx }) => {
            const isCurrent = idx === currentEpisodeIndex;
            const stillUrl = ep.still_path
              ? `https://image.tmdb.org/t/p/w300${ep.still_path}`
              : ep.stillUrl || ep.posterUrl || null;
            const epNum = ep.episode_number || idx + 1;
            const sNum = ep.season_number || 1;
            const epTitle = ep.title || ep.name || `${epNum}. Bölüm`;

            return (
              <TVFocusable
                key={idx}
                hasTVPreferredFocus={isCurrent}
                onFocus={() => episodeList.current?.scrollToIndex({ index: idx, viewPosition: 0.5, animated: true })}
                onPress={() => {
                  onSelectEpisode?.(idx);
                  onClose();
                }}
                style={[styles.epCard, isCurrent && styles.epCardCurrent]}
                focusedStyle={styles.epCardFocused}
              >
                <View style={styles.epImageWrapper}>
                  {stillUrl ? (
                    <Image source={{ uri: stillUrl }} style={styles.epImage} contentFit="cover" />
                  ) : (
                    <View style={styles.epPlaceholder}>
                      <Ionicons name="play" size={24} color="#555" />
                    </View>
                  )}
                  {isCurrent && (
                    <View style={styles.playingBadge}>
                      <ThemedText style={styles.playingBadgeText}>Oynatılıyor</ThemedText>
                    </View>
                  )}
                  <View style={styles.epMetaBadge}>
                    <ThemedText style={styles.epMetaBadgeText}>
                      S{sNum}:B{epNum}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText numberOfLines={1} style={styles.epCardTitle}>
                  {epTitle}
                </ThemedText>
              </TVFocusable>
            );
          }}
        />
        <TVFocusable style={{ padding: 12, alignSelf: 'flex-end' }} onPress={onClose}><ThemedText style={styles.pillValue}>Kapat</ThemedText></TVFocusable>
      </View>
      </TVModalSurface>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  topBarContainer: {
    position: 'absolute',
    top: 28,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  topBarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 15, 25, 0.92)',
    borderRadius: 32,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 20,
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1.5,
    borderColor: 'transparent',
    minWidth: 120,
  },
  quickPillFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    transform: [{ scale: 1.08 }],
    shadowColor: '#FFF',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  pillLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#8EA1B4',
    letterSpacing: 0.8,
  },
  pillValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 1,
  },

  // Alt Ray Stilleri
  bottomShelfContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10, 15, 25, 0.94)',
    borderTopWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 14,
    zIndex: 9999,
  },
  shelfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 36,
    marginBottom: 10,
  },
  shelfTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginRight: 8,
  },
  shelfSubtitle: {
    fontSize: 12,
    color: '#8EA1B4',
    fontWeight: '500',
  },
  shelfScrollContent: {
    paddingHorizontal: 36,
    gap: 14,
  },
  epCard: {
    width: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  epCardCurrent: {
    borderColor: '#E50914',
  },
  epCardFocused: {
    borderColor: '#FFFFFF',
    borderWidth: 3,
    transform: [{ scale: 1.06 }],
    shadowColor: '#FFF',
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 12,
  },
  epImageWrapper: {
    width: '100%',
    height: 112,
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  epImage: {
    width: '100%',
    height: '100%',
  },
  epPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playingBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#E50914',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  playingBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  epMetaBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  epMetaBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  epCardTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFF',
    padding: 8,
  },
  emptyShelfCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
});
