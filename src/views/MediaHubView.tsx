import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Platform,
  Animated,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList } from '@shopify/flash-list';
import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TMDB_BASE_URL, TMDB_IMAGE_BASE_URL } from '@/config/tmdb';

const isTV = Platform.isTV;

export type MediaType = 'movie' | 'tv';

export interface GenreConfig {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  movieGenreId: number | null;
  tvGenreId: number | null;
}

export interface MediaHubItem {
  id: string | number;
  tmdbId: string;
  title: string;
  name?: string;
  type: 'movie' | 'tv';
  media_type?: 'movie' | 'tv';
  posterUrl: string | null;
  backdropUrl: string | null;
  rating: string;
  year: string;
  overview: string;
  seasons?: number;
  episodes?: number;
  [key: string]: any;
}

export interface MediaHubSection {
  id: string;
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  data: MediaHubItem[];
}

export interface MediaHubViewProps {
  onSelectMedia: (media: any) => void;
  onClose?: () => void;
}

export const GENRE_CONFIGS: GenreConfig[] = [
  {
    id: 'all',
    name: 'Tümü',
    icon: 'sparkles',
    color: '#E50914',
    movieGenreId: null,
    tvGenreId: null,
  },
  {
    id: 'action',
    name: 'Aksiyon & Macera',
    icon: 'flash',
    color: '#EF4444',
    movieGenreId: 28,
    tvGenreId: 10759,
  },
  {
    id: 'comedy',
    name: 'Komedi',
    icon: 'happy',
    color: '#F59E0B',
    movieGenreId: 35,
    tvGenreId: 35,
  },
  {
    id: 'scifi',
    name: 'Bilim Kurgu & Fantastik',
    icon: 'rocket',
    color: '#10B981',
    movieGenreId: 878,
    tvGenreId: 10765,
  },
  {
    id: 'horror',
    name: 'Korku & Gerilim',
    icon: 'skull',
    color: '#8B5CF6',
    movieGenreId: 27,
    tvGenreId: 9648,
  },
  {
    id: 'drama',
    name: 'Dram',
    icon: 'heart',
    color: '#3B82F6',
    movieGenreId: 18,
    tvGenreId: 18,
  },
  {
    id: 'animation',
    name: 'Animasyon',
    icon: 'star',
    color: '#EC4899',
    movieGenreId: 16,
    tvGenreId: 16,
  },
  {
    id: 'crime',
    name: 'Suç & Polisiye',
    icon: 'shield-checkmark',
    color: '#64748B',
    movieGenreId: 80,
    tvGenreId: 80,
  },
  {
    id: 'documentary',
    name: 'Belgesel',
    icon: 'earth',
    color: '#6366F1',
    movieGenreId: 99,
    tvGenreId: 99,
  },
  {
    id: 'romance',
    name: 'Romantik',
    icon: 'rose',
    color: '#F43F5E',
    movieGenreId: 10749,
    tvGenreId: 10766,
  },
  {
    id: 'family',
    name: 'Aile & Çocuk',
    icon: 'people',
    color: '#14B8A6',
    movieGenreId: 10751,
    tvGenreId: 10762,
  },
  {
    id: 'mystery',
    name: 'Gizem',
    icon: 'help-circle',
    color: '#A855F7',
    movieGenreId: 9648,
    tvGenreId: 9648,
  },
];

function getOptimizedImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('/')) {
    const size = isTV ? 'w300' : 'w185';
    return `${TMDB_IMAGE_BASE_URL}/${size}${url}`;
  }
  if (url.includes('image.tmdb.org/t/p/')) {
    const size = isTV ? 'w300' : 'w185';
    return url.replace(/\/t\/p\/(w\d+|original)\//, `/t/p/${size}/`);
  }
  return url;
}

function normalizeMediaItem(item: any, fallbackType: MediaType = 'movie'): MediaHubItem {
  const isMovie =
    item.media_type === 'movie' ||
    (!item.media_type && fallbackType === 'movie' && item.name === undefined) ||
    (!item.media_type && item.title !== undefined);
  const mediaType: MediaType = item.media_type || (isMovie ? 'movie' : 'tv');

  const posterPath = item.poster_path || item.posterUrl || item.poster;
  const backdropPath = item.backdrop_path || item.backdropUrl || item.backdrop;

  return {
    ...item,
    id: item.id,
    tmdbId: item.id?.toString() || '',
    title: item.title || item.name || 'İsimsiz İçerik',
    name: item.name || item.title,
    type: mediaType,
    media_type: mediaType,
    isJellyfin: false,
    posterUrl: posterPath
      ? posterPath.startsWith('http')
        ? posterPath
        : `${TMDB_IMAGE_BASE_URL}/w400${posterPath}`
      : null,
    backdropUrl: backdropPath
      ? backdropPath.startsWith('http')
        ? backdropPath
        : `${TMDB_IMAGE_BASE_URL}/w1280${backdropPath}`
      : null,
    rating:
      item.vote_average !== undefined && item.vote_average !== null && item.vote_average > 0
        ? Number(item.vote_average).toFixed(1)
        : item.rating || '—',
    year: (item.release_date || item.first_air_date || item.year || '').split('-')[0] || '',
    overview: item.overview || '',
    seasons: item.number_of_seasons || item.seasons || 0,
    episodes: item.number_of_episodes || item.episodes || 0,
  };
}

// ──── SKELETON LOADER ────
const SkeletonMediaHub = () => {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);

  return (
    <Animated.View style={[styles.skeletonContainer, { opacity: anim }]}>
      {Array.from({ length: 4 }).map((_, rIdx) => (
        <View key={rIdx} style={styles.skeletonRow}>
          <View style={styles.skeletonHeader} />
          <View style={styles.skeletonCardsRow}>
            {Array.from({ length: 6 }).map((__, cIdx) => (
              <View key={cIdx} style={styles.skeletonCard} />
            ))}
          </View>
        </View>
      ))}
    </Animated.View>
  );
};

// ──── MEDIA HUB CARD ────
interface MediaHubCardProps {
  item: MediaHubItem;
  rowIndex: number;
  onPress: (item: MediaHubItem) => void;
  onFocus?: (rowIndex: number) => void;
}

const MediaHubCard = React.memo<MediaHubCardProps>(
  ({ item, rowIndex, onPress, onFocus }) => {
    const { width } = useWindowDimensions();
    const isDesktopWeb = Platform.OS === 'web' && width > 768;
    const cardW = isDesktopWeb ? 185 : isTV ? 150 : 130;
    const cardH = isDesktopWeb ? 275 : isTV ? 225 : 185;

    const posterUri = getOptimizedImageUrl(item.posterUrl);

    const getSubtitle = () => {
      if (item.type === 'tv') {
        const s = item.seasons ? `${item.seasons} Sezon` : '';
        const y = item.year ? item.year : '';
        if (s && y) return `${y} • ${s}`;
        return s || y || '';
      }
      return item.year || '';
    };

    const subtitle = getSubtitle();

    return (
      <View style={[styles.cardContainer, { width: cardW, marginHorizontal: isDesktopWeb ? 6 : isTV ? 6 : 4 }]}>
        <TVFocusable
          onPress={() => onPress(item)}
          onFocus={() => onFocus?.(rowIndex)}
          style={[
            styles.cardFocusable,
            {
              borderWidth: isTV ? 3 : 2,
              borderColor: 'transparent',
              borderRadius: isDesktopWeb ? 8 : 10,
              width: cardW,
              height: cardH,
              overflow: 'hidden',
            },
          ]}
          focusedStyle={
            isTV
              ? {
                  borderColor: '#E50914',
                  borderWidth: 3,
                  transform: [{ scale: 1.08 }],
                  zIndex: 10,
                }
              : {
                  borderColor: '#E50914',
                  transform: [{ scale: isDesktopWeb ? 1.08 : 1.05 }],
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.85,
                  shadowRadius: 18,
                }
          }
        >
          <View style={styles.cardInner}>
            {posterUri ? (
              <Image
                source={{ uri: posterUri }}
                style={styles.cardImage}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={styles.cardPlaceholder}>
                <Ionicons name="film-outline" size={isTV ? 34 : 26} color="#555" />
                <ThemedText numberOfLines={2} style={styles.cardPlaceholderText}>
                  {item.title}
                </ThemedText>
              </View>
            )}

            {/* Rating Badge */}
            {item.rating && item.rating !== '—' && item.rating !== '0.0' && (
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={10} color="#F5C518" style={{ marginRight: 2 }} />
                <Text style={styles.ratingText}>{item.rating}</Text>
              </View>
            )}
          </View>
        </TVFocusable>

        <Text
          numberOfLines={1}
          style={[
            styles.cardTitle,
            isDesktopWeb && {
              fontSize: 13,
              fontWeight: '600',
              marginTop: 6,
              color: '#d4d4d4',
              textAlign: 'left',
              width: '100%',
            },
          ]}
        >
          {item.title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={[
              styles.cardSubtitle,
              isDesktopWeb && {
                fontSize: 11,
                color: '#888888',
                marginTop: 2,
                textAlign: 'left',
                width: '100%',
              },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    );
  },
  (prev, next) => prev.item === next.item && prev.rowIndex === next.rowIndex
);

// ──── MEDIA HUB ROW ────
interface MediaHubRowProps {
  section: MediaHubSection;
  rowIndex: number;
  onPressMedia: (item: MediaHubItem) => void;
  onFocusRow: (rowIndex: number) => void;
}

const MediaHubRow = React.memo<MediaHubRowProps>(
  ({ section, rowIndex, onPressMedia, onFocusRow }) => {
    const listRef = useRef<any>(null);
    const [scrollOffset, setScrollOffset] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const { width } = useWindowDimensions();
    const isDesktopWeb = Platform.OS === 'web' && width > 768;

    const handleScrollLeft = () => {
      const targetOffset = Math.max(0, scrollOffset - width * 0.75);
      listRef.current?.scrollToOffset?.({ offset: targetOffset, animated: true });
    };

    const handleScrollRight = () => {
      const targetOffset = scrollOffset + width * 0.75;
      listRef.current?.scrollToOffset?.({ offset: targetOffset, animated: true });
    };

    const renderItem = useCallback(
      ({ item }: { item: MediaHubItem }) => (
        <MediaHubCard
          item={item}
          rowIndex={rowIndex}
          onPress={onPressMedia}
          onFocus={onFocusRow}
        />
      ),
      [rowIndex, onPressMedia, onFocusRow]
    );

    const keyExtractor = useCallback(
      (item: MediaHubItem) => `${section.id}-${item.id || item.tmdbId}`,
      [section.id]
    );

    if (!section.data || section.data.length === 0) {
      return null;
    }

    const rowData = useMemo(
      () => (isTV ? section.data.slice(0, 15) : section.data),
      [section.data]
    );

    return (
      <View
        style={styles.sectionRowContainer}
        {...(isDesktopWeb
          ? {
              onMouseEnter: () => setIsHovered(true),
              onMouseLeave: () => setIsHovered(false),
            }
          : {})}
      >
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWrap}>
            <ThemedText style={[styles.sectionTitle, isDesktopWeb && { fontSize: 20, fontWeight: '800' }]}>
              {section.title}
            </ThemedText>
          </View>
        </View>

        <View style={{ position: 'relative' }}>
          {/* Netflix-Style Desktop Left Chevron Button */}
          {isDesktopWeb && isHovered && scrollOffset > 20 && (
            <button
              onClick={handleScrollLeft}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 24,
                width: '44px',
                zIndex: 30,
                backgroundColor: 'rgba(20, 20, 20, 0.75)',
                border: 'none',
                color: '#FFFFFF',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderTopRightRadius: '6px',
                borderBottomRightRadius: '6px',
                backdropFilter: 'blur(4px)',
                transition: 'background-color 0.2s ease, transform 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(20, 20, 20, 0.95)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(20, 20, 20, 0.75)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title="Önceki"
            >
              <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
            </button>
          )}

          <FlashList
            ref={listRef}
            data={rowData}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            horizontal
            showsHorizontalScrollIndicator={false}
            removeClippedSubviews={Platform.OS !== 'web'}
            contentContainerStyle={[
              styles.rowListContent,
              isDesktopWeb && { paddingHorizontal: 36 },
            ]}
            onScroll={(e) => {
              setScrollOffset(e.nativeEvent.contentOffset.x);
            }}
            scrollEventThrottle={16}
          />

          {/* Netflix-Style Desktop Right Chevron Button */}
          {isDesktopWeb && isHovered && (
            <button
              onClick={handleScrollRight}
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 24,
                width: '44px',
                zIndex: 30,
                backgroundColor: 'rgba(20, 20, 20, 0.75)',
                border: 'none',
                color: '#FFFFFF',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderTopLeftRadius: '6px',
                borderBottomLeftRadius: '6px',
                backdropFilter: 'blur(4px)',
                transition: 'background-color 0.2s ease, transform 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(20, 20, 20, 0.95)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(20, 20, 20, 0.75)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title="Sonraki"
            >
              <Ionicons name="chevron-forward" size={28} color="#FFFFFF" />
            </button>
          )}
        </View>
      </View>
    );
  },
  (prev, next) => prev.section === next.section && prev.rowIndex === next.rowIndex
);

// ──── MAIN MEDIA HUB VIEW ────
export function MediaHubView({ onSelectMedia, onClose }: MediaHubViewProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 768;
  const bottomPadding = isTV ? 120 : isDesktopWeb ? 100 : Math.max(insets.bottom + 96, 136);

  const [mediaType, setMediaType] = useState<MediaType>('movie');
  const [selectedGenreId, setSelectedGenreId] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [sections, setSections] = useState<MediaHubSection[]>([]);

  const mainVerticalListRef = useRef<FlatList>(null);
  const genreScrollViewRef = useRef<ScrollView>(null);

  const fetchMediaHubData = useCallback(
    async (type: MediaType, genreId: string) => {
      setLoading(true);
      try {
        const isMovie = type === 'movie';
        const typeLabel = isMovie ? 'Filmler' : 'Diziler';
        const activeGenre = GENRE_CONFIGS.find((g) => g.id === genreId);
        const tmdbGenreId = isMovie ? activeGenre?.movieGenreId : activeGenre?.tvGenreId;

        const newSections: MediaHubSection[] = [];

        if (genreId === 'all') {
          // Default multi-category mode: Popular, Trending, Top Rated + Curated Genres
          const [popularRes, trendingRes, topRatedRes, actionRes, comedyRes, scifiRes, horrorRes, dramaRes] =
            await Promise.allSettled([
              fetch(`${TMDB_BASE_URL}/${type}/popular?language=tr-TR&page=1`).then((r) => r.json()),
              fetch(`${TMDB_BASE_URL}/trending/${type}/week?language=tr-TR`).then((r) => r.json()),
              fetch(`${TMDB_BASE_URL}/${type}/top_rated?language=tr-TR&page=1`).then((r) => r.json()),
              fetch(
                `${TMDB_BASE_URL}/discover/${type}?with_genres=${isMovie ? 28 : 10759}&language=tr-TR&sort_by=popularity.desc&page=1`
              ).then((r) => r.json()),
              fetch(
                `${TMDB_BASE_URL}/discover/${type}?with_genres=35&language=tr-TR&sort_by=popularity.desc&page=1`
              ).then((r) => r.json()),
              fetch(
                `${TMDB_BASE_URL}/discover/${type}?with_genres=${isMovie ? 878 : 10765}&language=tr-TR&sort_by=popularity.desc&page=1`
              ).then((r) => r.json()),
              fetch(
                `${TMDB_BASE_URL}/discover/${type}?with_genres=${isMovie ? 27 : 9648}&language=tr-TR&sort_by=popularity.desc&page=1`
              ).then((r) => r.json()),
              fetch(
                `${TMDB_BASE_URL}/discover/${type}?with_genres=18&language=tr-TR&sort_by=popularity.desc&page=1`
              ).then((r) => r.json()),
            ]);

          if (popularRes.status === 'fulfilled' && popularRes.value?.results?.length) {
            newSections.push({
              id: 'popular',
              title: `Popüler ${typeLabel}`,
              subtitle: 'En çok izlenen ve konuşulan yapımlar',
              icon: 'flame',
              iconColor: '#E50914',
              data: popularRes.value.results.map((i: any) => normalizeMediaItem(i, type)),
            });
          }

          if (trendingRes.status === 'fulfilled' && trendingRes.value?.results?.length) {
            newSections.push({
              id: 'trending',
              title: `Haftanın Trend ${typeLabel}`,
              subtitle: 'Bu hafta izlenme rekoru kıranlar',
              icon: 'trending-up',
              iconColor: '#F59E0B',
              data: trendingRes.value.results.map((i: any) => normalizeMediaItem(i, type)),
            });
          }

          if (topRatedRes.status === 'fulfilled' && topRatedRes.value?.results?.length) {
            newSections.push({
              id: 'top_rated',
              title: `En Çok Oy Alan ${typeLabel}`,
              subtitle: 'Eleştirmenler ve izleyicilerden tam not alanlar',
              icon: 'trophy',
              iconColor: '#F5C518',
              data: topRatedRes.value.results.map((i: any) => normalizeMediaItem(i, type)),
            });
          }

          if (actionRes.status === 'fulfilled' && actionRes.value?.results?.length) {
            newSections.push({
              id: 'action',
              title: 'Aksiyon & Macera Dünyası',
              subtitle: 'Nefes kesen sahneler ve soluksuz serüvenler',
              icon: 'flash',
              iconColor: '#EF4444',
              data: actionRes.value.results.map((i: any) => normalizeMediaItem(i, type)),
            });
          }

          if (scifiRes.status === 'fulfilled' && scifiRes.value?.results?.length) {
            newSections.push({
              id: 'scifi',
              title: 'Bilim Kurgu & Fantastik Evrenler',
              subtitle: 'Geleceğe yolculuk ve sıra dışı dünyalar',
              icon: 'rocket',
              iconColor: '#10B981',
              data: scifiRes.value.results.map((i: any) => normalizeMediaItem(i, type)),
            });
          }

          if (comedyRes.status === 'fulfilled' && comedyRes.value?.results?.length) {
            newSections.push({
              id: 'comedy',
              title: 'Kahkaha Dolu Komediler',
              subtitle: 'Günün yorgunluğunu unutturan neşeli yapımlar',
              icon: 'happy',
              iconColor: '#F59E0B',
              data: comedyRes.value.results.map((i: any) => normalizeMediaItem(i, type)),
            });
          }

          if (horrorRes.status === 'fulfilled' && horrorRes.value?.results?.length) {
            newSections.push({
              id: 'horror',
              title: 'Korku, Gerilim & Gizem',
              subtitle: 'Gizemli sırlar ve kalp atışını hızlandıran anlar',
              icon: 'skull',
              iconColor: '#8B5CF6',
              data: horrorRes.value.results.map((i: any) => normalizeMediaItem(i, type)),
            });
          }

          if (dramaRes.status === 'fulfilled' && dramaRes.value?.results?.length) {
            newSections.push({
              id: 'drama',
              title: 'Dram & Duygusal Hikayeler',
              subtitle: 'Derin karakterler ve etkileyici senaryolar',
              icon: 'heart',
              iconColor: '#3B82F6',
              data: dramaRes.value.results.map((i: any) => normalizeMediaItem(i, type)),
            });
          }
        } else if (tmdbGenreId) {
          // Specific Genre selected mode
          const genreName = activeGenre?.name || 'Tür';
          const genreColor = activeGenre?.color || '#E50914';
          const genreIcon = activeGenre?.icon || 'film';

          const [genrePopRes, genreTopRes, genreNewRes, globalTrendingRes] = await Promise.allSettled([
            fetch(
              `${TMDB_BASE_URL}/discover/${type}?with_genres=${tmdbGenreId}&language=tr-TR&sort_by=popularity.desc&page=1`
            ).then((r) => r.json()),
            fetch(
              `${TMDB_BASE_URL}/discover/${type}?with_genres=${tmdbGenreId}&language=tr-TR&sort_by=vote_average.desc&vote_count.gte=60&page=1`
            ).then((r) => r.json()),
            fetch(
              `${TMDB_BASE_URL}/discover/${type}?with_genres=${tmdbGenreId}&language=tr-TR&sort_by=${
                isMovie ? 'primary_release_date.desc' : 'first_air_date.desc'
              }&vote_count.gte=10&page=1`
            ).then((r) => r.json()),
            fetch(`${TMDB_BASE_URL}/trending/${type}/week?language=tr-TR`).then((r) => r.json()),
          ]);

          if (genrePopRes.status === 'fulfilled' && genrePopRes.value?.results?.length) {
            newSections.push({
              id: 'genre_popular',
              title: `${genreName} - Popüler İçerikler`,
              subtitle: `En çok izlenen ${genreName.toLowerCase()} ${typeLabel.toLowerCase()}`,
              icon: genreIcon,
              iconColor: genreColor,
              data: genrePopRes.value.results.map((i: any) => normalizeMediaItem(i, type)),
            });
          }

          if (genreTopRes.status === 'fulfilled' && genreTopRes.value?.results?.length) {
            newSections.push({
              id: 'genre_top_rated',
              title: `${genreName} - En Yüksek Puanlılar`,
              subtitle: 'İzleyicilerden en yüksek puanı alan başyapıtlar',
              icon: 'trophy',
              iconColor: '#F5C518',
              data: genreTopRes.value.results.map((i: any) => normalizeMediaItem(i, type)),
            });
          }

          if (genreNewRes.status === 'fulfilled' && genreNewRes.value?.results?.length) {
            newSections.push({
              id: 'genre_new',
              title: `${genreName} - Yeni Çıkanlar`,
              subtitle: 'Son dönemde yayınlanan taze yapımlar',
              icon: 'sparkles',
              iconColor: '#10B981',
              data: genreNewRes.value.results.map((i: any) => normalizeMediaItem(i, type)),
            });
          }

          if (globalTrendingRes.status === 'fulfilled' && globalTrendingRes.value?.results?.length) {
            newSections.push({
              id: 'global_trending',
              title: `Genel Trend ${typeLabel}`,
              subtitle: 'Tüm kategorilerde bu haftanın en popülerleri',
              icon: 'trending-up',
              iconColor: '#F59E0B',
              data: globalTrendingRes.value.results.map((i: any) => normalizeMediaItem(i, type)),
            });
          }
        }

        setSections(newSections);
      } catch (err) {
        console.warn('[MediaHubView] Veri yüklenirken hata oluştu:', err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchMediaHubData(mediaType, selectedGenreId);
  }, [mediaType, selectedGenreId, fetchMediaHubData]);

  const lastFocusedRowRef = useRef<number>(-1);
  const handleFocusRow = useCallback((rowIndex: number) => {
    if (lastFocusedRowRef.current === rowIndex) return;
    lastFocusedRowRef.current = rowIndex;
    mainVerticalListRef.current?.scrollToIndex({
      index: rowIndex,
      animated: !isTV,
      viewPosition: 0.35,
    });
  }, []);

  const handleSelectMediaType = (type: MediaType) => {
    if (type !== mediaType) {
      setMediaType(type);
      mainVerticalListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  };

  const handleSelectGenre = (genreId: string) => {
    setSelectedGenreId(genreId);
    mainVerticalListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const renderSectionItem = useCallback(
    ({ item: section, index: rowIndex }: { item: MediaHubSection; index: number }) => (
      <MediaHubRow
        section={section}
        rowIndex={rowIndex}
        onPressMedia={onSelectMedia}
        onFocusRow={handleFocusRow}
      />
    ),
    [onSelectMedia, handleFocusRow]
  );

  // ──── HEADER COMPONENT ────
  const listHeader = useMemo(
    () => (
      <View style={styles.headerContainer}>
        {/* Glow backdrop behind header */}
        <LinearGradient
          colors={['rgba(229, 9, 20, 0.22)', 'rgba(18, 18, 22, 0.6)', 'transparent']}
          style={styles.headerGlow}
          pointerEvents="none"
        />

        {/* Top Bar with Title & Close if available */}
        <View style={styles.topBar}>
          <View style={styles.titleRow}>
            {onClose && (
              <TVFocusable
                onPress={onClose}
                style={styles.backBtn}
                focusedStyle={styles.backBtnFocused}
              >
                <Ionicons name="arrow-back" size={isTV ? 24 : 20} color="#fff" />
              </TVFocusable>
            )}
            <ThemedText style={styles.headerMainTitle}>MAXEN</ThemedText>
          </View>
        </View>

        {/* Segmented Control Switcher (Filmler / Diziler) */}
        <View style={styles.segmentedControlWrap}>
          <View style={styles.segmentedControl}>
            <TVFocusable
              onPress={() => handleSelectMediaType('movie')}
              style={[
                styles.segmentBtn,
                mediaType === 'movie' && styles.segmentBtnActive,
              ]}
              focusedStyle={styles.segmentBtnFocused}
            >
              <View style={styles.segmentInner}>
                <Ionicons
                  name="film"
                  size={isTV ? 18 : 16}
                  color={mediaType === 'movie' ? '#FFFFFF' : '#8E8E93'}
                  style={{ marginRight: 6 }}
                />
                <ThemedText
                  style={[
                    styles.segmentText,
                    mediaType === 'movie' && styles.segmentTextActive,
                  ]}
                >
                  Filmler
                </ThemedText>
              </View>
            </TVFocusable>

            <TVFocusable
              onPress={() => handleSelectMediaType('tv')}
              style={[
                styles.segmentBtn,
                mediaType === 'tv' && styles.segmentBtnActive,
              ]}
              focusedStyle={styles.segmentBtnFocused}
            >
              <View style={styles.segmentInner}>
                <Ionicons
                  name="tv"
                  size={isTV ? 18 : 16}
                  color={mediaType === 'tv' ? '#FFFFFF' : '#8E8E93'}
                  style={{ marginRight: 6 }}
                />
                <ThemedText
                  style={[
                    styles.segmentText,
                    mediaType === 'tv' && styles.segmentTextActive,
                  ]}
                >
                  Diziler
                </ThemedText>
              </View>
            </TVFocusable>
          </View>
        </View>

        {/* Horizontal Genre Pills */}
        <View style={styles.genrePillsSection}>
          <ScrollView
            ref={genreScrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.genrePillsContent}
          >
            {GENRE_CONFIGS.map((genre) => {
              const isSelected = selectedGenreId === genre.id;
              return (
                <TVFocusable
                  key={genre.id}
                  onPress={() => handleSelectGenre(genre.id)}
                  style={[
                    styles.genrePill,
                    isSelected
                      ? styles.genrePillSelected
                      : styles.genrePillUnselected,
                  ]}
                  focusedStyle={{
                    borderColor: '#FFFFFF',
                    borderWidth: 2,
                    transform: [{ scale: 1.08 }],
                    shadowColor: '#E50914',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.8,
                    shadowRadius: 8,
                    elevation: 10,
                  }}
                >
                  <View style={styles.genrePillInner}>
                    <Ionicons
                      name={genre.icon}
                      size={isTV ? 16 : 14}
                      color={isSelected ? '#FFFFFF' : genre.color}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.genrePillText,
                        isSelected && styles.genrePillTextActive,
                      ]}
                    >
                      {genre.name}
                    </Text>
                  </View>
                </TVFocusable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    ),
    [mediaType, selectedGenreId, onClose]
  );

  return (
    <View style={[styles.container, { backgroundColor: '#141414' }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {loading ? (
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={
            <>
              {listHeader}
              <SkeletonMediaHub />
            </>
          }
          style={styles.mainList}
          contentContainerStyle={[styles.mainListContent, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
        />
      ) : sections.length === 0 ? (
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={
            <>
              {listHeader}
              <View style={styles.emptyState}>
                <Ionicons name="film-outline" size={48} color="#555" />
                <ThemedText style={styles.emptyTitle}>İçerik Bulunamadı</ThemedText>
                <ThemedText style={styles.emptySubtitle}>
                  Seçtiğiniz türe ait yapımlar yüklenemedi. Başka bir kategori seçmeyi deneyin.
                </ThemedText>
              </View>
            </>
          }
          style={styles.mainList}
          contentContainerStyle={[styles.mainListContent, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          ref={mainVerticalListRef}
          data={sections}
          renderItem={renderSectionItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          style={styles.mainList}
          contentContainerStyle={[styles.mainListContent, { paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={3}
          maxToRenderPerBatch={2}
          windowSize={5}
          onScrollToIndexFailed={(info) => {
            mainVerticalListRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: false,
            });
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainList: {
    flex: 1,
  },
  mainListContent: {
    paddingBottom: isTV ? 120 : 80,
  },

  /* ──── HEADER ──── */
  headerContainer: {
    paddingTop: Platform.OS === 'ios' ? 52 : isTV ? 28 : 40,
    paddingHorizontal: isTV ? 38 : 16,
    paddingBottom: 10,
    position: 'relative',
  },
  headerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: isTV ? 260 : 200,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: isTV ? 44 : 36,
    height: isTV ? 44 : 36,
    borderRadius: isTV ? 14 : 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  backBtnFocused: {
    backgroundColor: '#E50914',
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.08 }],
  },
  brandIconBox: {
    width: isTV ? 42 : 36,
    height: isTV ? 42 : 36,
    borderRadius: isTV ? 12 : 10,
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerEyebrow: {
    color: '#E50914',
    fontSize: isTV ? 11 : 9.5,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
  headerMainTitle: {
    color: '#E50914',
    fontSize: isTV ? 32 : 26,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 12,
  },

  /* ──── SEGMENTED CONTROL ──── */
  segmentedControlWrap: {
    marginBottom: 16,
    alignItems: isTV ? 'flex-start' : 'stretch',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(20, 20, 25, 0.9)',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    width: isTV ? 340 : '100%',
    maxWidth: 400,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: isTV ? 10 : 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#E50914',
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  segmentBtnFocused: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
    transform: [{ scale: 1.03 }],
  },
  segmentInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: isTV ? 14 : 13,
    fontWeight: '700',
    color: '#8E8E93',
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  /* ──── GENRE PILLS ──── */
  genrePillsSection: {
    marginBottom: 12,
  },
  genrePillsContent: {
    gap: 8,
    paddingRight: isTV ? 40 : 20,
  },
  genrePill: {
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: isTV ? 8 : 7,
    paddingHorizontal: isTV ? 16 : 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genrePillUnselected: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  genrePillSelected: {
    backgroundColor: '#E50914',
    borderColor: '#E50914',
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  genrePillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genrePillText: {
    fontSize: isTV ? 13 : 12,
    fontWeight: '700',
    color: '#E4E4E7',
    includeFontPadding: false,
  },
  genrePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  /* ──── SECTION ROWS ──── */
  sectionRowContainer: {
    marginTop: isTV ? 26 : 18,
    paddingVertical: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: isTV ? 38 : 16,
    marginBottom: isTV ? 14 : 10,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sectionIconBox: {
    width: isTV ? 36 : 28,
    height: isTV ? 36 : 28,
    borderRadius: isTV ? 10 : 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: isTV ? 22 : 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: isTV ? 12 : 10.5,
    color: '#8E8E93',
    marginTop: 1,
  },
  sectionCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  sectionCountText: {
    color: '#A1A1AA',
    fontSize: isTV ? 12 : 10,
    fontWeight: '800',
  },
  rowListContent: {
    paddingHorizontal: isTV ? 32 : 12,
  },

  /* ──── CARD STYLING ──── */
  cardContainer: {
    width: isTV ? 150 : 130,
    marginHorizontal: isTV ? 6 : 4,
    alignItems: 'center',
  },
  cardFocusable: {
    borderRadius: 10,
  },
  cardInner: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1C1C22',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1C1C22',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  cardPlaceholderText: {
    fontSize: 10,
    color: '#777',
    textAlign: 'center',
    marginTop: 6,
  },
  ratingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  ratingText: {
    fontSize: 9.5,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  cardTitle: {
    marginTop: isTV ? 8 : 6,
    fontSize: isTV ? 14 : 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  cardSubtitle: {
    marginTop: 2,
    fontSize: isTV ? 12 : 9.5,
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 2,
  },

  /* ──── SKELETON ──── */
  skeletonContainer: {
    paddingHorizontal: isTV ? 38 : 16,
    paddingTop: 10,
    gap: 24,
  },
  skeletonRow: {
    gap: 12,
  },
  skeletonHeader: {
    width: isTV ? 200 : 140,
    height: isTV ? 24 : 18,
    borderRadius: 6,
    backgroundColor: '#1E1E26',
  },
  skeletonCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  skeletonCard: {
    width: isTV ? 150 : 130,
    height: isTV ? 225 : 185,
    borderRadius: 10,
    backgroundColor: '#1E1E26',
  },

  /* ──── EMPTY STATE ──── */
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
  },
  emptySubtitle: {
    color: '#8E8E93',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 18,
  },
});
