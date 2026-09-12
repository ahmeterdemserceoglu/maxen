import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useUiStore } from '@/store/uiStore';
import { TMDB_BASE_URL } from '@/config/tmdb';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHomeData, NormalizedMediaItem } from './home/useHomeData';
import { HeroBanner } from './home/HeroBanner';
import { TVHeroCanvas } from './home/TVHeroCanvas';
import { MediaRow, SkeletonHome, SectionData, TV_ROW_HEIGHT } from './home/MediaRow';
import { extractCleanTmdbId } from '@/types/profileMedia';

const isTV = Platform.isTV;

export type HomeViewProps = {
  activeTab: string;
  profileId: string;
};

export function HomeView({ activeTab, profileId }: HomeViewProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 768;
  // TV'de içerik alt çubuğun arkasına girmesin; 10-foot UI için geniş güvenli alan.
  const bottomPadding = isTV ? 160 : isDesktopWeb ? 100 : Math.max(insets.bottom + 96, 136);
  const setActiveDetail = useUiStore((state) => state.setActiveDetail);
  const setActiveVideo = useUiStore((state) => state.setActiveVideo);

  const { loading, data, heroPool } = useHomeData(activeTab, profileId);
  const {
    heroMedia,
    continueWatching,
    watchLater,
    recommendedItems,
    popularMovies,
    popularTV,
    trendingMovies,
    trendingTV,
    topRatedMovies,
    topRatedTV,
    actionMovies,
    comedyMovies,
    scifiMovies,
    actionTV,
    comedyTV,
    scifiTV,
  } = data;

  const [activeTvItem, setActiveTvItem] = React.useState<any>(null);
  const heroPlayBtnRef = useRef<any>(null);
  const mainVerticalListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (heroMedia && !activeTvItem) {
      setActiveTvItem(heroMedia);
    }
  }, [heroMedia, activeTvItem]);

  // Initial focus is owned by the hero's preferred-focus prop. Do not steal it
  // from the sidebar/cards when catalog data refreshes.

  const focusDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFocusMediaItem = useCallback((item: any) => {
    if (!isTV || !item) return;
    if (focusDebounceRef.current) {
      clearTimeout(focusDebounceRef.current);
    }
    focusDebounceRef.current = setTimeout(() => {
      setActiveTvItem((prev: any) => {
        // Remap ContinueWatching episode items to show-level for the hero
        const isCWEpisode =
          item.show_title &&
          (item.season_number != null || item.episode_number != null ||
           item.SeasonNumber != null || item.EpisodeNumber != null);

        const heroItem = isCWEpisode
          ? {
              ...item,
              // Prefer show-level title
              title: item.show_title,
              name: item.show_title,
              // Prefer show-level backdrop over episode still
              backdrop_path: item.show_backdrop_path || item.backdrop_path,
              backdropUrl: item.show_backdrop_path
                ? undefined
                : item.backdropUrl,
              // Show this is a series
              type: 'tv',
            }
          : item;

        if (prev?.id === heroItem.id && prev?.title === heroItem.title) return prev;
        return heroItem;
      });
    }, 280);
  }, []);

  useEffect(() => {
    return () => {
      if (focusDebounceRef.current) {
        clearTimeout(focusDebounceRef.current);
      }
    };
  }, []);

  const handlePlayMedia = useCallback(
    (item: any) => {
      if (!item) return;
      if (item.type === 'movie') {
        const cleanTmdbId = extractCleanTmdbId(item);
        setActiveVideo({
          ...item,
          id: cleanTmdbId || item.id,
          tmdbId: cleanTmdbId,
          type: 'movie',
        });
      } else {
        setActiveDetail(item);
      }
    },
    [setActiveVideo, setActiveDetail]
  );

  const handlePressMedia = useCallback(
    (item: any) => {
      setActiveDetail(item);
    },
    [setActiveDetail]
  );

  const handlePressContinueWatching = useCallback(
    async (item: any) => {
      if (!setActiveVideo) {
        setActiveDetail(item);
        return;
      }

      const isTv =
        item.type === 'tv' ||
        item.Type === 'Series' ||
        item.Type === 'Tv' ||
        Boolean(item.season_number || item.episode_number || item.SeasonNumber || item.EpisodeNumber || item.show_title);

      let cleanTmdbId = extractCleanTmdbId(item);

      if (!isTv) {
        setActiveVideo({
          ...item,
          id: cleanTmdbId || item.id,
          tmdbId: cleanTmdbId,
          type: 'movie',
        });
        return;
      }

      try {
        let season = Number(
          item.season_number ?? item.SeasonNumber ?? item.ParentIndexNumber ?? item.seasonNumber ?? 1
        );
        let episode = Number(
          item.episode_number ?? item.EpisodeNumber ?? item.IndexNumber ?? item.episodeNumber ?? 1
        );

        let res = await fetch(`${TMDB_BASE_URL}/tv/${cleanTmdbId}/season/${season}?language=tr-TR`);

        // Eğer ID bozulmuşsa veya 404 döndüyse ve dizi başlığı varsa, TMDB'de gerçek diziyi ara ve ID'yi onar!
        if (!res.ok && (item.show_title || item.title)) {
          try {
            const queryTitle = encodeURIComponent(item.show_title || item.title);
            const searchRes = await fetch(`${TMDB_BASE_URL}/search/tv?query=${queryTitle}&language=tr-TR`);
            if (searchRes.ok) {
              const searchData = await searchRes.json();
              if (searchData.results && searchData.results.length > 0) {
                cleanTmdbId = String(searchData.results[0].id);
                res = await fetch(`${TMDB_BASE_URL}/tv/${cleanTmdbId}/season/${season}?language=tr-TR`);
              }
            }
          } catch (e) {}
        }

        if (res.ok) {
          const resData = await res.json();
          const episodes = (resData.episodes || []).map((ep: any) => ({
            id: ep.id,
            tmdbId: String(cleanTmdbId),
            show_id: String(cleanTmdbId),
            name: ep.name,
            season_number: ep.season_number,
            episode_number: ep.episode_number,
            overview: ep.overview,
            still_path: ep.still_path,
            type: 'tv',
            show_title: item.show_title || item.title,
          }));

          const epIndex = episodes.findIndex((ep: any) => Number(ep.episode_number) === episode);
          setActiveVideo({
            ...item,
            id: cleanTmdbId,
            tmdbId: cleanTmdbId,
            show_id: cleanTmdbId,
            type: 'tv',
            playlist: episodes,
            playlistIndex: epIndex >= 0 ? epIndex : 0,
            season_number: season,
            episode_number: episode,
          });
        } else {
          setActiveVideo({
            ...item,
            id: cleanTmdbId,
            tmdbId: cleanTmdbId,
            show_id: cleanTmdbId,
            type: 'tv',
            season_number: season,
            episode_number: episode,
          });
        }
      } catch {
        setActiveVideo({
          ...item,
          id: cleanTmdbId,
          tmdbId: cleanTmdbId,
          show_id: cleanTmdbId,
          type: 'tv',
        });
      }
    },
    [setActiveVideo, setActiveDetail]
  );

  const lastFocusedRowRef = useRef<number>(-1);
  const handleFocusRow = useCallback((rowIndex: number) => {
    if (lastFocusedRowRef.current === rowIndex) return;
    lastFocusedRowRef.current = rowIndex;

    const list = mainVerticalListRef.current;
    if (!list) return;

    try {
      list.scrollToIndex({
        index: rowIndex,
        animated: true,
        viewPosition: isTV ? 0.5 : 0.25,
        viewOffset: 0,
      });
    } catch (e) {
      // Ignored if measurement not ready
    }
  }, []);

  const handleHeroFocus = useCallback(() => {
    lastFocusedRowRef.current = -1;
    mainVerticalListRef.current?.scrollToOffset({ offset: 0, animated: !isTV });
  }, []);

  const sectionsData = useMemo<SectionData[]>(() => {
    const sections: SectionData[] = [];
    if (activeTab === 'home') {
      if (continueWatching.length > 0)
        sections.push({ type: 'cw', title: 'İzlemeye Devam Et', data: continueWatching });
      if (watchLater.length > 0)
        sections.push({ type: 'media', title: 'Daha Sonra İzle', data: watchLater });
      if (recommendedItems.length > 0)
        sections.push({ type: 'media', title: 'Senin İçin Seçtiklerimiz', data: recommendedItems });
      if (popularMovies.length > 0)
        sections.push({ type: 'media', title: 'Popüler Filmler', data: popularMovies });
      if (popularTV.length > 0)
        sections.push({ type: 'media', title: 'Popüler Diziler', data: popularTV });
      if (actionMovies.length > 0)
        sections.push({ type: 'media', title: 'Aksiyon & Macera', data: actionMovies });
      if (comedyMovies.length > 0)
        sections.push({ type: 'media', title: 'Komedi', data: comedyMovies });
      if (scifiMovies.length > 0)
        sections.push({ type: 'media', title: 'Bilim Kurgu & Fantastik', data: scifiMovies });
    } else if (activeTab === 'movies') {
      if (popularMovies.length > 0)
        sections.push({ type: 'media', title: 'Popüler Filmler', data: popularMovies });
      if (topRatedMovies.length > 0)
        sections.push({ type: 'media', title: 'En Çok Oy Alan Filmler', data: topRatedMovies });
      if (actionMovies.length > 0)
        sections.push({ type: 'media', title: 'Aksiyon Filmleri', data: actionMovies });
      if (comedyMovies.length > 0)
        sections.push({ type: 'media', title: 'Komedi Filmleri', data: comedyMovies });
      if (scifiMovies.length > 0)
        sections.push({ type: 'media', title: 'Bilim Kurgu Filmleri', data: scifiMovies });
    } else if (activeTab === 'tv') {
      if (popularTV.length > 0)
        sections.push({ type: 'media', title: 'Popüler Diziler', data: popularTV });
      if (topRatedTV.length > 0)
        sections.push({ type: 'media', title: 'En Çok Oy Alan Diziler', data: topRatedTV });
      if (actionTV.length > 0)
        sections.push({ type: 'media', title: 'Aksiyon & Macera Dizileri', data: actionTV });
      if (comedyTV.length > 0)
        sections.push({ type: 'media', title: 'Komedi Dizileri', data: comedyTV });
      if (scifiTV.length > 0)
        sections.push({ type: 'media', title: 'Bilim Kurgu & Fantastik Diziler', data: scifiTV });
    }
    return sections;
  }, [
    activeTab,
    continueWatching,
    watchLater,
    recommendedItems,
    popularMovies,
    popularTV,
    topRatedMovies,
    topRatedTV,
    actionMovies,
    comedyMovies,
    scifiMovies,
    actionTV,
    comedyTV,
    scifiTV,
  ]);

  const renderRow = useCallback(
    ({ item: section, index: rowIndex }: { item: SectionData; index: number }) => (
      <MediaRow
        section={section}
        rowIndex={rowIndex}
        onPressMedia={handlePressMedia}
        onPressContinueWatching={handlePressContinueWatching}
        onFocusRow={handleFocusRow}
        onFocusMediaItem={handleFocusMediaItem}
      />
    ),
    [handlePressMedia, handlePressContinueWatching, handleFocusRow, handleFocusMediaItem]
  );

  const listHeader = useMemo(
    () => (
      <HeroBanner
        heroMedia={heroMedia}
        heroPool={heroPool}
        onPressPlay={handlePressMedia}
        onPressInfo={handlePressMedia}
        onFocus={handleHeroFocus}
        playBtnRef={heroPlayBtnRef}
      />
    ),
    [heroMedia, heroPool, handlePressMedia, handleHeroFocus]
  );

  const getTVItemLayout = useCallback(
    (_: any, index: number) => ({
      length: TV_ROW_HEIGHT,
      offset: TV_ROW_HEIGHT * index,
      index,
    }),
    []
  );

  if (loading) {
    return <SkeletonHome />;
  }

  if (popularMovies.length === 0 && popularTV.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <Ionicons name="cloud-offline-outline" size={48} color="#666" />
        <ThemedText style={styles.emptyText}>İçerik yüklenemedi.</ThemedText>
        <ThemedText style={styles.emptySubText}>İnternet bağlantınızı kontrol edin.</ThemedText>
      </View>
    );
  }

  if (isTV) {
    return (
      <View style={[styles.container, styles.tvContainer]}>
        <TVHeroCanvas
          media={activeTvItem || heroMedia}
          onPressPlay={handlePlayMedia}
          onPressInfo={handlePressMedia}
          onFocus={handleHeroFocus}
          playBtnRef={heroPlayBtnRef}
        />
        <FlatList
          ref={mainVerticalListRef}
          data={sectionsData}
          renderItem={renderRow}
          keyExtractor={(item) => item.title}
          style={styles.container}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={3}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews={false}
          decelerationRate={0.985}
          overScrollMode="never"
          getItemLayout={getTVItemLayout}
          onScrollToIndexFailed={(info) => {
            mainVerticalListRef.current?.scrollToOffset({
              offset: TV_ROW_HEIGHT * info.index,
              animated: true,
            });
          }}
        />
      </View>
    );
  }

  return (
    <FlatList
      ref={mainVerticalListRef}
      data={sectionsData}
      renderItem={renderRow}
      keyExtractor={(item) => item.title}
      ListHeaderComponent={listHeader}
      style={[styles.container, { backgroundColor: '#141414' }]}
      contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomPadding }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={4}
      maxToRenderPerBatch={3}
      windowSize={7}
      removeClippedSubviews={Platform.OS === 'android'}
      onScrollToIndexFailed={(info) => {
        mainVerticalListRef.current?.scrollToOffset({
          offset: info.averageItemLength * info.index,
          animated: false,
        });
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tvContainer: { backgroundColor: '#0B0B0F' },
  contentContainer: { paddingBottom: isTV ? 150 : 80 },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubText: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
  },
});
