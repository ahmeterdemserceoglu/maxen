import React, { useCallback, useRef, useState } from 'react';
import { View, FlatList, ScrollView, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';
import { getEpisodeProgress } from '@/utils/watchProgress';
import type { SeasonEpisodeListProps } from './SeasonEpisodeList';
import { getTVNodeHandle } from '@/utils/tvNodeHandle';

const ROW_HEIGHT = 122;
export function TVEpisodePanel(p: SeasonEpisodeListProps) {
  const [seasonPicker, setSeasonPicker] = useState(false);
  const [seasonNodeId, setSeasonNodeId] = useState<number>();
  const [episodeNodeIds, setEpisodeNodeIds] = useState<Record<number, number>>({});
  const list = useRef<FlatList>(null);
  const season = Number(p.activeSeason?.season_number ?? p.activeSeason?.IndexNumber ?? 1);
  const playNodeId = getTVNodeHandle(p.playButtonRef);
  const registerSeasonRef = useCallback((el: any) => {
    if (p.seasonRefs?.current) p.seasonRefs.current[0] = el;
    const id = getTVNodeHandle(el);
    if (id) setSeasonNodeId((current) => current === id ? current : id);
  }, [p.seasonRefs]);
  const registerEpisodeRef = useCallback((index: number, el: any) => {
    if (p.episodeRefs?.current) p.episodeRefs.current[index] = el;
    if (index === 0 && p.firstEpisodeRef) p.firstEpisodeRef.current = el;
    const id = getTVNodeHandle(el);
    if (!id) return;
    if (index === 0) p.onFirstFocusableResolved?.(id);
    setEpisodeNodeIds((current) => current[index] === id ? current : { ...current, [index]: id });
  }, [p.episodeRefs, p.firstEpisodeRef, p.onFirstFocusableResolved]);
  return <View style={s.root}>
    <View style={s.header}>
      <ThemedText style={s.heading}>Bölümler</ThemedText>
      <TVFocusable
        ref={registerSeasonRef}
        style={s.season}
        focusedStyle={s.focused}
        onPress={() => setSeasonPicker(true)}
        nextFocusLeft={playNodeId}
        nextFocusDown={episodeNodeIds[0]}
        accessibilityLabel="Sezon seç"
      >
        <ThemedText style={s.text}>{season}. Sezon ▾</ThemedText>
      </TVFocusable>
    </View>
    {p.loadingEpisodes ? <ActivityIndicator color="#E50914" style={{ marginTop: 30 }} /> : <FlatList
      ref={list} key={season} data={p.episodes} keyExtractor={(ep, i) => String(ep.id ?? ep.Id ?? i)}
      initialNumToRender={4} maxToRenderPerBatch={2} windowSize={3} removeClippedSubviews={false}
      contentContainerStyle={s.list} getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
      ListEmptyComponent={<ThemedText style={s.text}>Bu sezonda bölüm bulunamadı.</ThemedText>}
      renderItem={({ item: ep, index }) => {
        const progress = getEpisodeProgress(p.localProgresses, p.tmdbId, ep, season);
        const number = ep.episode_number ?? ep.IndexNumber ?? index + 1;
        return <View style={s.row}>
          <TVFocusable ref={(el: any) => registerEpisodeRef(index, el)} style={s.card} focusedStyle={s.episodeFocused} onPress={() => p.onPlayEpisode(ep)}
            onFocus={() => list.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true })}
            nextFocusLeft={playNodeId}
            nextFocusUp={index === 0 ? seasonNodeId : episodeNodeIds[index - 1]}
            nextFocusDown={episodeNodeIds[index + 1]}
            accessibilityLabel={`${season}. sezon ${number}. bölüm, ${ep.name || ep.Name || ''}${progress ? `, yüzde ${Math.round(progress * 100)} izlendi` : ''}`}>
            <View style={s.imageBox}>
              {!!ep.still_path && <Image source={{ uri: `https://image.tmdb.org/t/p/w300${ep.still_path}` }} style={s.image} contentFit="cover" cachePolicy="memory-disk" />}
              <View style={s.track}><View style={[s.fill, { width: `${progress * 100}%` }]} /></View>
            </View>
            <View style={s.info}>
              <ThemedText numberOfLines={1} style={s.name}>{number}. {ep.name || ep.Name || 'Bölüm'}</ThemedText>
              <ThemedText numberOfLines={2} style={s.description}>{ep.overview || ep.Overview || (ep.runtime ? `${ep.runtime} dk` : 'Bölümü oynat')}</ThemedText>
              {progress > 0 && <ThemedText style={s.progress}>%{Math.round(progress * 100)} izlendi</ThemedText>}
            </View>
          </TVFocusable>
        </View>;
      }}
    />}
    <Modal visible={seasonPicker} transparent animationType="fade" onRequestClose={() => setSeasonPicker(false)}>
      <View style={s.overlay}><View style={s.dialog}>
        <ThemedText style={s.heading}>Sezon seç</ThemedText>
        <ScrollView contentContainerStyle={{ padding: 8, gap: 8 }}>
          {p.seasons.map((item, index) => {
            const n = item.season_number ?? item.IndexNumber ?? index + 1;
            return <TVFocusable key={n} hasTVPreferredFocus={Number(n) === season} style={s.season} onPress={() => { p.onSeasonChange(item); setSeasonPicker(false); }}>
              <ThemedText style={s.text}>{n}. Sezon {Number(n) === season ? '✓' : ''}</ThemedText>
            </TVFocusable>;
          })}
        </ScrollView>
        <TVFocusable style={s.season} onPress={() => setSeasonPicker(false)}><ThemedText style={s.text}>Kapat</ThemedText></TVFocusable>
      </View></View>
    </Modal>
  </View>;
}
const s = StyleSheet.create({
  root: { flex: 1, minWidth: 0 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 8 },
  heading: { fontSize: 22, fontWeight: '700', color: '#fff' }, text: { fontSize: 17, color: '#fff' },
  season: { minHeight: 48, paddingHorizontal: 18, justifyContent: 'center', backgroundColor: '#262626' },
  focused: { borderColor: '#fff', borderWidth: 3, backgroundColor: '#252b35' },
  episodeFocused: { borderColor: '#fff', borderWidth: 3, backgroundColor: '#252b35', transform: [{ scale: 1 }] },
  list: { paddingHorizontal: 8, paddingBottom: 24 }, row: { height: ROW_HEIGHT, paddingVertical: 6 },
  card: { height: ROW_HEIGHT - 12, flexDirection: 'row', alignItems: 'center', padding: 8, gap: 12, backgroundColor: '#161c24' },
  imageBox: { width: 128, height: 80, backgroundColor: '#10141a', borderRadius: 6, overflow: 'hidden' }, image: { width: '100%', height: '100%' },
  info: { flex: 1, minWidth: 0 }, name: { fontSize: 16, color: '#fff', fontWeight: '700' }, description: { fontSize: 14, lineHeight: 19, color: '#aaa', marginTop: 4 },
  progress: { fontSize: 13, color: '#ccc', marginTop: 3 }, track: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: '#333' }, fill: { height: 4, backgroundColor: '#E50914' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.85)' }, dialog: { width: 400, maxHeight: '85%', padding: 24, gap: 16, backgroundColor: '#161616', borderRadius: 12 },
});
