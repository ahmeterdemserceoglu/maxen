import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TMDB_BASE_URL, TMDB_IMAGE_BASE_URL } from '@/config/tmdb';
import { startSpeechRecognition } from '@/modules/VoiceRecognition';
import { searchHistoryKey } from '@/utils/storageKeys';

export const ALL_GENRES = [
  { id: 28, name: 'Aksiyon', icon: 'flash', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  { id: 12, name: 'Macera', icon: 'compass', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  { id: 16, name: 'Animasyon', icon: 'star', color: '#EC4899', bg: 'rgba(236,72,153,0.15)' },
  { id: 35, name: 'Komedi', icon: 'happy', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  { id: 80, name: 'Suç', icon: 'shield-checkmark', color: '#64748B', bg: 'rgba(100,116,139,0.15)' },
  { id: 99, name: 'Belgesel', icon: 'earth', color: '#6366F1', bg: 'rgba(99,102,241,0.15)' },
  { id: 18, name: 'Dram', icon: 'heart', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  { id: 10751, name: 'Aile', icon: 'people', color: '#14B8A6', bg: 'rgba(20,184,166,0.15)' },
  { id: 14, name: 'Fantastik', icon: 'flame', color: '#F97316', bg: 'rgba(249,115,22,0.15)' },
  { id: 36, name: 'Tarih', icon: 'time', color: '#78716C', bg: 'rgba(120,113,108,0.15)' },
  { id: 27, name: 'Korku', icon: 'skull', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  { id: 10402, name: 'Müzik', icon: 'musical-notes', color: '#EC4899', bg: 'rgba(236,72,153,0.15)' },
  { id: 9648, name: 'Gizem', icon: 'help-circle', color: '#6366F1', bg: 'rgba(99,102,241,0.15)' },
  { id: 10749, name: 'Romantik', icon: 'rose', color: '#F43F5E', bg: 'rgba(244,63,94,0.15)' },
  { id: 878, name: 'Bilim Kurgu', icon: 'rocket', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  { id: 53, name: 'Gerilim', icon: 'eye', color: '#06B6D4', bg: 'rgba(6,182,212,0.15)' },
  { id: 10752, name: 'Savaş', icon: 'flag', color: '#B45309', bg: 'rgba(180,83,9,0.15)' },
  { id: 37, name: 'Western', icon: 'bonfire', color: '#D97706', bg: 'rgba(217,119,6,0.15)' },
];

export const SORT_OPTIONS = [
  { key: 'popularity.desc', label: 'Popülerlik' },
  { key: 'vote_average.desc', label: 'Puan' },
  { key: 'release_date.desc', label: 'Yeni' },
  { key: 'release_date.asc', label: 'Eski' },
];

export const MAX_HISTORY = 20;

export function normalizePerson(item: any) {
  return {
    id: item.id,
    title: item.name,
    type: 'person' as const,
    isJellyfin: false,
    tmdbId: item.id?.toString(),
    posterUrl: item.profile_path ? `${TMDB_IMAGE_BASE_URL}/w300${item.profile_path}` : null,
    knownFor: (item.known_for || [])
      .map((k: any) => k.title || k.name)
      .filter(Boolean)
      .slice(0, 2)
      .join(', '),
    popularity: item.popularity || 0,
  };
}

export function normalizeItem(item: any) {
  return {
    id: item.id,
    title: item.title || item.name,
    type: item.media_type === 'tv' || item.name ? 'tv' : 'movie',
    isJellyfin: false,
    tmdbId: item.id?.toString(),
    posterUrl: item.poster_path ? `${TMDB_IMAGE_BASE_URL}/w300${item.poster_path}` : null,
    backdropUrl: item.backdrop_path ? `${TMDB_IMAGE_BASE_URL}/w1280${item.backdrop_path}` : null,
    rating: item.vote_average ? item.vote_average.toFixed(1) : null,
    year: item.release_date?.split('-')[0] || item.first_air_date?.split('-')[0] || '',
    overview: item.overview || '',
  };
}

export interface AppliedFilters {
  mediaType: 'all' | 'movie' | 'tv';
  genreIds: number[];
  sortBy: string;
  yearMin: string;
  yearMax: string;
}

export function useSearchEngine(profileId: string) {
  const historyKey = searchHistoryKey(profileId);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [trendingItems, setTrendingItems] = useState<any[]>([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const [mediaType, setMediaType] = useState<'all' | 'movie' | 'tv'>('all');
  const [activeGenreIds, setActiveGenreIds] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState('popularity.desc');
  const [yearMin, setYearMin] = useState('');
  const [yearMax, setYearMax] = useState('');

  const [isInputFocused, setIsInputFocused] = useState(false);
  const [focusMinYear, setFocusMinYear] = useState(false);
  const [focusMaxYear, setFocusMaxYear] = useState(false);

  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({
    mediaType: 'all',
    genreIds: [],
    sortBy: 'popularity.desc',
    yearMin: '',
    yearMax: '',
  });

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(historyKey);
      if (stored) setSearchHistory(JSON.parse(stored));
      else setSearchHistory([]);
    })();
  }, [historyKey]);

  const addToHistory = async (term: string) => {
    if (!term.trim()) return;
    const updated = [term, ...searchHistory.filter((h) => h !== term)].slice(0, MAX_HISTORY);
    setSearchHistory(updated);
    await AsyncStorage.setItem(historyKey, JSON.stringify(updated));
  };

  const clearHistory = async () => {
    setSearchHistory([]);
    await AsyncStorage.removeItem(historyKey);
  };

  const fetchSuggestions = useCallback(async (text: string) => {
    if (text.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const res = await fetch(
        `${TMDB_BASE_URL}/search/multi?query=${encodeURIComponent(text)}&language=tr-TR&page=1`
      );
      const data = await res.json();
      const sug = (data.results || [])
        .filter((i: any) => i.media_type !== 'person' || Boolean(i.profile_path))
        .slice(0, 6)
        .map((i: any) => (i.media_type === 'person' ? normalizePerson(i) : normalizeItem(i)));
      setSuggestions(sug);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchSuggestions(query), 300);
    return () => clearTimeout(timer);
  }, [query, fetchSuggestions]);

  const performSearch = useCallback(
    async (searchText: string, pageNum: number, append: boolean) => {
      const { mediaType: currentMediaType, genreIds, sortBy: currentSortBy, yearMin: currentYearMin, yearMax: currentYearMax } = appliedFilters;
      setLoading(true);
      try {
        let tmdbResults: any[] = [];
        const genreParam = genreIds.join(',');

        if (searchText.trim()) {
          const url = `${TMDB_BASE_URL}/search/multi?query=${encodeURIComponent(
            searchText
          )}&language=tr-TR&page=${pageNum}`;
          const res = await fetch(url);
          const data = await res.json();
          tmdbResults = (data.results || [])
            .filter((i: any) => i.media_type !== 'person' || Boolean(i.profile_path))
            .map((i: any) =>
              i.media_type === 'person' ? normalizePerson(i) : normalizeItem(i)
            );
        } else if (genreParam) {
          if (currentMediaType === 'all') {
            const [movies, tvs] = await Promise.all([
              fetch(
                `${TMDB_BASE_URL}/discover/movie?with_genres=${genreParam}&language=tr-TR&sort_by=${currentSortBy}&page=${pageNum}${
                  currentYearMin ? `&primary_release_date.gte=${currentYearMin}-01-01` : ''
                }${currentYearMax ? `&primary_release_date.lte=${currentYearMax}-12-31` : ''}`
              )
                .then((r) => r.json())
                .then((d) => (d.results || []).map((i: any) => normalizeItem(i))),
              fetch(
                `${TMDB_BASE_URL}/discover/tv?with_genres=${genreParam}&language=tr-TR&sort_by=${currentSortBy}&page=${pageNum}${
                  currentYearMin ? `&first_air_date.gte=${currentYearMin}-01-01` : ''
                }${currentYearMax ? `&first_air_date.lte=${currentYearMax}-12-31` : ''}`
              )
                .then((r) => r.json())
                .then((d) => (d.results || []).map((i: any) => normalizeItem(i))),
            ]);
            tmdbResults = [...movies, ...tvs].sort((a, b) => (b.rating || 0) - (a.rating || 0));
          } else {
            const endpoint = currentMediaType === 'tv' ? 'discover/tv' : 'discover/movie';
            let url = `${TMDB_BASE_URL}/${endpoint}?with_genres=${genreParam}&language=tr-TR&sort_by=${currentSortBy}&page=${pageNum}`;
            if (currentYearMin)
              url +=
                currentMediaType === 'tv'
                  ? `&first_air_date.gte=${currentYearMin}-01-01`
                  : `&primary_release_date.gte=${currentYearMin}-01-01`;
            if (currentYearMax)
              url +=
                currentMediaType === 'tv'
                  ? `&first_air_date.lte=${currentYearMax}-12-31`
                  : `&primary_release_date.lte=${currentYearMax}-12-31`;
            const res = await fetch(url);
            const data = await res.json();
            tmdbResults = (data.results || []).map((i: any) => normalizeItem(i));
          }
        } else {
          const endpoint = currentMediaType === 'tv' ? 'tv/popular' : 'movie/popular';
          const url = `${TMDB_BASE_URL}/${endpoint}?language=tr-TR&page=${pageNum}`;
          const res = await fetch(url);
          const data = await res.json();
          tmdbResults = (data.results || []).map((i: any) => normalizeItem(i));
        }

        const finalResults = [...tmdbResults];

        if (append) {
          setResults((prev) => [...prev, ...finalResults]);
        } else {
          setResults(finalResults);
        }
        setHasMore(tmdbResults.length >= 20);
      } catch (error) {
        console.error('Arama hatası:', error);
        if (!append) setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [appliedFilters]
  );

  useEffect(() => {
    setPage(1);
    performSearch(queryRef.current, 1, false);
  }, [appliedFilters, performSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      performSearch(query, 1, false);
    }, 400);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const applyFilters = () => {
    setAppliedFilters({
      mediaType,
      genreIds: activeGenreIds,
      sortBy,
      yearMin,
      yearMax,
    });
    setFilterModalVisible(false);
  };

  const handleLoadMore = () => {
    if (!hasMore || loading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    performSearch(queryRef.current, nextPage, true);
  };

  const handleVoiceSearch = async () => {
    setIsListening(true);
    try {
      const text = await startSpeechRecognition();
      if (text) {
        setQuery(text);
        addToHistory(text);
      }
    } catch (e: any) {
      Alert.alert('Hata', e.message || 'Ses tanınamadı.');
    } finally {
      setIsListening(false);
    }
  };

  const toggleGenre = (genreId: number) => {
    setActiveGenreIds((prev) =>
      prev.includes(genreId) ? prev.filter((id) => id !== genreId) : [...prev, genreId]
    );
  };

  const isSearchActive = query.trim().length > 0 || appliedFilters.genreIds.length > 0;

  return {
    query,
    setQuery,
    results,
    loading,
    page,
    hasMore,
    isListening,
    suggestions,
    showSuggestions,
    setShowSuggestions,
    searchHistory,
    trendingItems,
    setTrendingItems,
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
    appliedFilters,
    setAppliedFilters,
    applyFilters,
    handleLoadMore,
    handleVoiceSearch,
    performSearch,
    fetchSuggestions,
    addToHistory,
    clearHistory,
    isSearchActive,
  };
}
