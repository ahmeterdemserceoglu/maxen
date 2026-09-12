import React, { useRef, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  FlatList,
  Keyboard,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useUiStore } from '@/store/uiStore';
import { useSearchEngine } from './search/useSearchEngine';
import { TVSearchView } from './search/TVSearchView';
import { SearchHeader } from './search/SearchHeader';
import { SearchFilterBar } from './search/SearchFilterBar';
import { SearchResultGrid, SearchHistoryAndTrending } from './search/SearchResultGrid';

export type SearchViewProps = {
  setActiveActor?: (actor: { name: string; tmdbId: string; profileUrl?: string }) => void;
  profileId: string;
};

export function SearchView({ profileId }: SearchViewProps) {
  const setActiveDetail = useUiStore((state) => state.setActiveDetail);
  const setActiveActor = useUiStore((state) => state.setActiveActor);

  const { width, height } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 768;
  const isTablet = width > 600;
  const theme = useTheme();
  const styles = useMemo(() => getStyles(width, height, isTablet), [width, height, isTablet]);

  const flatListRef = useRef<FlatList | null>(null);
  const inputRef = useRef<TextInput | null>(null);

  const engine = useSearchEngine(profileId);
  const {
    query,
    setQuery,
    results,
    loading,
    page,
    isListening,
    suggestions,
    showSuggestions,
    setShowSuggestions,
    searchHistory,
    trendingItems,
    filterModalVisible,
    setFilterModalVisible,
    mediaType,
    setMediaType,
    activeGenreIds,
    setActiveGenreIds,
    toggleGenre,
    sortBy,
    setSortBy,
    yearMin,
    setYearMin,
    yearMax,
    setYearMax,
    isInputFocused,
    setIsInputFocused,
    focusMinYear,
    setFocusMinYear,
    focusMaxYear,
    setFocusMaxYear,
    setAppliedFilters,
    applyFilters,
    handleLoadMore,
    handleVoiceSearch,
    performSearch,
    fetchSuggestions,
    addToHistory,
    clearHistory,
    isSearchActive,
  } = engine;

  const onSelectSuggestion = useCallback(
    (item: any) => {
      setShowSuggestions(false);
      Keyboard.dismiss();
      if (item.type === 'person') {
        setActiveActor?.({
          name: item.title,
          tmdbId: item.tmdbId,
          profileUrl: item.posterUrl,
        });
      } else {
        setActiveDetail(item);
      }
    },
    [setActiveActor, setActiveDetail, setShowSuggestions]
  );

  const handleSelectHistory = useCallback(
    (term: string) => {
      setQuery(term);
      addToHistory(term);
    },
    [setQuery, addToHistory]
  );

  if (Platform.isTV) return <TVSearchView engine={engine} onSelectDetail={setActiveDetail} onSelectActor={setActiveActor} />;

  // Widescreen Layout (TV & Desktop Web)
  if (Platform.isTV || isDesktopWeb) {
    const leftColW = isDesktopWeb ? 340 : 320;
    const cardWidthWidescreen = isDesktopWeb ? 175 : (width - 320 - 120) / 3;
    const numColumnsWidescreen = isDesktopWeb
      ? Math.max(3, Math.floor((width - leftColW - 100) / 190))
      : 3;

    return (
      <View style={[styles.tvContainer, { backgroundColor: '#141414' }]}>
        {/* Left Column for inputs & filters */}
        <View style={[styles.tvLeftColumn, isDesktopWeb && { width: leftColW, marginRight: 32 }]}>
          <ThemedText style={styles.tvSearchTitle}>Arama</ThemedText>
          <ThemedText style={[styles.subtitle, { color: '#888888', marginBottom: 20 }]}>
            Gelişmiş arama ve filtreler
          </ThemedText>

          <SearchHeader
            query={query}
            setQuery={setQuery}
            inputRef={inputRef}
            isInputFocused={isInputFocused}
            setIsInputFocused={setIsInputFocused}
            isListening={isListening}
            handleVoiceSearch={handleVoiceSearch}
            performSearch={performSearch}
            suggestions={suggestions}
            showSuggestions={showSuggestions}
            setShowSuggestions={setShowSuggestions}
            onSelectSuggestion={onSelectSuggestion}
            fetchSuggestions={fetchSuggestions}
            placeholder="Film, dizi veya oyuncu ara..."
            styles={styles}
            theme={theme}
          />

          <SearchFilterBar
            mediaType={mediaType}
            setMediaType={setMediaType}
            setAppliedFilters={setAppliedFilters}
            filterModalVisible={filterModalVisible}
            setFilterModalVisible={setFilterModalVisible}
            sortBy={sortBy}
            setSortBy={setSortBy}
            activeGenreIds={activeGenreIds}
            setActiveGenreIds={setActiveGenreIds}
            toggleGenre={toggleGenre}
            yearMin={yearMin}
            setYearMin={setYearMin}
            yearMax={yearMax}
            setYearMax={setYearMax}
            focusMinYear={focusMinYear}
            setFocusMinYear={setFocusMinYear}
            focusMaxYear={focusMaxYear}
            setFocusMaxYear={setFocusMaxYear}
            applyFilters={applyFilters}
            styles={styles}
            theme={theme}
          />

          <SearchHistoryAndTrending
            isSearchActive={isSearchActive}
            activeGenreIds={activeGenreIds}
            trendingItems={trendingItems}
            searchHistory={searchHistory}
            onSelectTrending={setActiveDetail}
            onSelectHistory={handleSelectHistory}
            onClearHistory={clearHistory}
            isTV={true}
            styles={styles}
          />
        </View>

        {/* Right Column for search results */}
        <View style={styles.tvRightColumn}>
          <SearchResultGrid
            results={results}
            loading={loading}
            page={page}
            isSearchActive={isSearchActive}
            onLoadMore={handleLoadMore}
            onSelectDetail={setActiveDetail}
            onSelectActor={setActiveActor}
            flatListRef={flatListRef}
            numColumns={numColumnsWidescreen}
            cardWidth={cardWidthWidescreen}
            contentContainerStyle={styles.tvResultsGrid}
            emptyHintText="Film veya dizi adı yazarak aramaya başlayın"
            styles={styles}
          />
        </View>
      </View>
    );
  }

  // Mobile View
  const cardWidthMobile = (width - 48 - 16) / 3;

  return (
    <View style={[styles.container, { backgroundColor: '#141414' }]}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={styles.titleBold}>Arama</ThemedText>
        <ThemedText style={[styles.subtitle, { color: '#888888' }]}>
          Gelişmiş arama ve filtreler
        </ThemedText>
      </View>

      {/* Search Header & Bar */}
      <SearchHeader
        query={query}
        setQuery={setQuery}
        inputRef={inputRef}
        isInputFocused={isInputFocused}
        setIsInputFocused={setIsInputFocused}
        isListening={isListening}
        handleVoiceSearch={handleVoiceSearch}
        performSearch={performSearch}
        suggestions={suggestions}
        showSuggestions={showSuggestions}
        setShowSuggestions={setShowSuggestions}
        onSelectSuggestion={onSelectSuggestion}
        fetchSuggestions={fetchSuggestions}
        placeholder="Film, dizi veya tür ara..."
        styles={styles}
        theme={theme}
      />

      {/* Filter Bar */}
      <SearchFilterBar
        mediaType={mediaType}
        setMediaType={setMediaType}
        setAppliedFilters={setAppliedFilters}
        filterModalVisible={filterModalVisible}
        setFilterModalVisible={setFilterModalVisible}
        sortBy={sortBy}
        setSortBy={setSortBy}
        activeGenreIds={activeGenreIds}
        setActiveGenreIds={setActiveGenreIds}
        toggleGenre={toggleGenre}
        yearMin={yearMin}
        setYearMin={setYearMin}
        yearMax={yearMax}
        setYearMax={setYearMax}
        focusMinYear={focusMinYear}
        setFocusMinYear={setFocusMinYear}
        focusMaxYear={focusMaxYear}
        setFocusMaxYear={setFocusMaxYear}
        applyFilters={applyFilters}
        styles={styles}
        theme={theme}
      />

      {/* Trending & Recent Searches */}
      <SearchHistoryAndTrending
        isSearchActive={isSearchActive}
        activeGenreIds={activeGenreIds}
        trendingItems={trendingItems}
        searchHistory={searchHistory}
        onSelectTrending={setActiveDetail}
        onSelectHistory={handleSelectHistory}
        onClearHistory={clearHistory}
        isTV={false}
        styles={styles}
      />

      {/* Results Grid */}
      <SearchResultGrid
        results={results}
        loading={loading}
        page={page}
        isSearchActive={isSearchActive}
        onLoadMore={handleLoadMore}
        onSelectDetail={setActiveDetail}
        onSelectActor={setActiveActor}
        flatListRef={flatListRef}
        numColumns={3}
        cardWidth={cardWidthMobile}
        contentContainerStyle={styles.resultsGrid}
        emptyHintText="Film veya dizi adı yazın ya da tür seçin"
        styles={styles}
      />
    </View>
  );
}

const getStyles = (width: number, height: number, isTablet: boolean) =>
  StyleSheet.create({
    tvContainer: {
      flex: 1,
      flexDirection: 'row',
      paddingTop: 32,
      paddingHorizontal: 40,
      backgroundColor: '#141414',
    },
    tvLeftColumn: {
      width: 320,
      marginRight: 40,
      height: '100%',
      paddingBottom: 20,
    },
    tvRightColumn: {
      flex: 1,
      height: '100%',
    },
    tvSearchTitle: {
      fontSize: 32,
      fontWeight: '900',
      color: '#FFFFFF',
      marginBottom: 6,
    },
    tvMediaTypeRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    },
    tvFilterChip: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: '#262626',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tvFilterBtn: {
      width: '100%',
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tvHistoryItem: {
      backgroundColor: '#1C1C1E',
      borderRadius: 8,
      marginBottom: 6,
    },
    tvResultsGrid: {
      paddingBottom: 40,
    },
    container: { flex: 1, paddingTop: 48, paddingHorizontal: 0, backgroundColor: '#141414' },
    header: { paddingHorizontal: 20, marginBottom: 12 },
    titleBold: { fontSize: 28, fontWeight: '900', color: '#FFFFFF' },
    subtitle: { fontSize: 13, marginTop: 3 },

    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      backgroundColor: '#222222',
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginHorizontal: 20,
      marginBottom: 10,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 15, paddingVertical: 0, color: '#FFFFFF' },
    clearBtn: { marginRight: 8 },
    micBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },

    suggestionsContainer: {
      backgroundColor: '#1A1A1A',
      marginHorizontal: 20,
      borderRadius: 12,
      marginBottom: 12,
      overflow: 'hidden',
    },
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#222',
    },
    suggestionPoster: { width: 40, height: 60, borderRadius: 6, backgroundColor: '#333' },
    suggestionTitle: { color: '#fff', fontWeight: '600', fontSize: 14 },
    suggestionMeta: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },

    filterRow: { marginBottom: 10, paddingLeft: 20 },
    filterChip: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 20,
      backgroundColor: '#262626',
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    filterChipActive: { backgroundColor: '#E50914', borderColor: '#E50914' },
    filterChipText: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },
    filterChipTextActive: { color: '#FFFFFF' },

    genreChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
    },
    historyChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: '#262626',
      borderRadius: 20,
      maxWidth: 150,
    },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 },

    resultsGrid: { paddingHorizontal: 20, paddingBottom: 130 },
    resultFocusable: { margin: 4, borderRadius: 10 },
    resultCard: {
      width: '100%',
      aspectRatio: 2 / 3,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: '#1a1a1a',
      position: 'relative',
    },
    resultImage: { width: '100%', height: '100%' },
    noImage: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#202024',
    },
    ratingBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.75)',
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 5,
    },
    ratingText: { color: '#F5C518', fontSize: 9, fontWeight: '800' },
    resultInfoBelow: {
      marginTop: 6,
      paddingHorizontal: 2,
    },
    resultTitle: { fontSize: 11, fontWeight: '700', color: '#fff' },
    resultYear: { fontSize: 10, color: '#aaa', fontWeight: '500' },
    typeBadge: {
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
    },
    typeBadgeText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  });
