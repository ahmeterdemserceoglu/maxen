import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal } from 'react-native';
import { TVFocusable } from '@/components/TVFocusable';
import { SearchResultGrid } from './SearchResultGrid';
import { ALL_GENRES, SORT_OPTIONS, useSearchEngine } from './useSearchEngine';

type Engine = ReturnType<typeof useSearchEngine>;
const KEYS = [...'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ0123456789'];

export function TVSearchView({ engine: e, onSelectDetail, onSelectActor }: {
  engine: Engine; onSelectDetail: (item: any) => void; onSelectActor: (actor: any) => void;
}) {
  const [gridWidth, setGridWidth] = useState(480);
  const columns = Math.max(2, Math.min(4, Math.floor(gridWidth / 180)));
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  return <View style={s.root}>
    <View style={s.left}>
      <Text style={s.heading}>Arama</Text>
      <Text style={s.hint}>Film, dizi veya oyuncu keşfet</Text>
      <TVFocusable hasTVPreferredFocus style={s.search} onPress={() => setKeyboardOpen(true)} accessibilityLabel="Arama metnini yaz">
        <Text numberOfLines={2} style={s.text}>{e.query || 'Aramak için seçin…'}</Text>
      </TVFocusable>
      <View style={s.row}>
        <TVFocusable style={s.button} onPress={e.handleVoiceSearch} disabled={e.isListening}><Text style={s.text}>{e.isListening ? 'Dinleniyor…' : 'Sesli ara'}</Text></TVFocusable>
        {!!e.query && <TVFocusable style={s.button} onPress={() => e.setQuery('')}><Text style={s.text}>Temizle</Text></TVFocusable>}
      </View>
      <View style={s.row}>
        {(['all', 'movie', 'tv'] as const).map(type => <TVFocusable key={type} style={[s.type, e.mediaType === type && s.active]} onPress={() => {
          e.setMediaType(type); e.setAppliedFilters(prev => ({ ...prev, mediaType: type }));
        }}><Text style={s.text}>{type === 'all' ? 'Hepsi' : type === 'movie' ? 'Film' : 'Dizi'}</Text></TVFocusable>)}
      </View>
      <TVFocusable style={s.button} onPress={() => e.setFilterModalVisible(true)}><Text style={s.text}>Tür ve sıralama{e.activeGenreIds.length ? ` (${e.activeGenreIds.length})` : ''}</Text></TVFocusable>
      <ScrollView contentContainerStyle={{ padding: 6, gap: 8 }}>
        {e.searchHistory.slice(0, 4).map(term => <TVFocusable key={term} style={s.history} onPress={() => e.setQuery(term)}><Text numberOfLines={1} style={s.hint}>{term}</Text></TVFocusable>)}
      </ScrollView>
    </View>
    <View style={s.results} onLayout={event => setGridWidth(event.nativeEvent.layout.width)}>
      <Text style={s.resultsHeading}>{e.isSearchActive ? 'Arama sonuçları' : 'Popüler yapımlar'}</Text>
      <SearchResultGrid results={e.isSearchActive ? e.results : e.trendingItems} loading={e.loading} page={e.page}
        isSearchActive={e.isSearchActive} onLoadMore={e.isSearchActive ? e.handleLoadMore : () => {}}
        onSelectDetail={onSelectDetail} onSelectActor={onSelectActor} numColumns={columns}
        cardWidth={Math.max(80, (gridWidth - 32) / columns - 16)} styles={{}} />
    </View>
    <Modal visible={keyboardOpen} transparent animationType="fade" onRequestClose={() => setKeyboardOpen(false)}>
      <View style={s.overlay}><View style={s.keyboard}>
        <Text style={s.heading}>Ne izlemek istersin?</Text>
        <Text numberOfLines={1} style={s.query}>{e.query || 'Film, dizi veya oyuncu'}</Text>
        <ScrollView contentContainerStyle={s.keys}>
          {KEYS.map((key, index) => <TVFocusable key={key} hasTVPreferredFocus={index === 0} style={s.key} onPress={() => e.setQuery(e.query + key.toLocaleLowerCase('tr-TR'))}><Text style={s.text}>{key}</Text></TVFocusable>)}
        </ScrollView>
        <View style={s.row}>
          <TVFocusable style={s.button} onPress={() => e.setQuery(e.query + ' ')}><Text style={s.text}>Boşluk</Text></TVFocusable>
          <TVFocusable style={s.button} onPress={() => e.setQuery(e.query.slice(0, -1))}><Text style={s.text}>Sil</Text></TVFocusable>
          <TVFocusable style={[s.button, s.active]} onPress={() => { e.addToHistory(e.query); setKeyboardOpen(false); }}><Text style={s.text}>Sonuçları göster</Text></TVFocusable>
        </View>
      </View></View>
    </Modal>
    <Modal visible={e.filterModalVisible} transparent animationType="fade" onRequestClose={() => e.setFilterModalVisible(false)}>
      <View style={s.overlay}><View style={s.filters}>
        <Text style={s.heading}>Tür ve sıralama</Text>
        <ScrollView contentContainerStyle={{ padding: 8, gap: 20 }}>
          <View style={s.row}>{SORT_OPTIONS.map((option, index) => <TVFocusable key={option.key} hasTVPreferredFocus={index === 0} style={[s.button, e.sortBy === option.key && s.active]} onPress={() => e.setSortBy(option.key)}><Text style={s.text}>{option.label}</Text></TVFocusable>)}</View>
          <View style={s.row}>{ALL_GENRES.map(genre => <TVFocusable key={genre.id} style={[s.button, e.activeGenreIds.includes(genre.id) && s.active]} onPress={() => e.toggleGenre(genre.id)}><Text style={s.text}>{genre.name}</Text></TVFocusable>)}</View>
        </ScrollView>
        <View style={s.row}>
          <TVFocusable style={[s.button, s.active]} onPress={e.applyFilters}><Text style={s.text}>Uygula</Text></TVFocusable>
          <TVFocusable style={s.button} onPress={() => e.setActiveGenreIds([])}><Text style={s.text}>Türleri temizle</Text></TVFocusable>
          <TVFocusable style={s.button} onPress={() => e.setFilterModalVisible(false)}><Text style={s.text}>Kapat</Text></TVFocusable>
        </View>
      </View></View>
    </Modal>
  </View>;
}
const s = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', padding: 28, gap: 24, backgroundColor: '#141414' },
  left: { width: 260, gap: 12 }, heading: { color: '#fff', fontSize: 28, fontWeight: '800' }, hint: { color: '#aaa', fontSize: 15 },
  text: { color: '#fff', fontSize: 16 }, search: { minHeight: 64, padding: 14, justifyContent: 'center', backgroundColor: '#222' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, button: { minHeight: 48, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#262626' },
  type: { minWidth: 72, minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#262626' }, active: { backgroundColor: '#E50914' },
  results: { flex: 1, minWidth: 0 }, resultsHeading: { fontSize: 22, color: '#fff', fontWeight: '700', marginBottom: 12 }, history: { padding: 10, minHeight: 44 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.88)' },
  keyboard: { width: 600, maxWidth: '92%', maxHeight: '92%', padding: 24, gap: 16, backgroundColor: '#161616', borderRadius: 12 },
  keys: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 8 }, key: { width: 48, height: 42, justifyContent: 'center', alignItems: 'center', backgroundColor: '#262626' },
  query: { color: '#fff', fontSize: 20, padding: 12, backgroundColor: '#222' }, filters: { width: 720, maxWidth: '90%', maxHeight: '90%', padding: 24, gap: 16, backgroundColor: '#161616', borderRadius: 12 },
});
