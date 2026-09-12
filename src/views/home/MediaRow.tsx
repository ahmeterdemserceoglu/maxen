import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Animated,
  useWindowDimensions,
  FlatList,
} from 'react-native';
import { getTVNodeHandle } from '@/utils/tvNodeHandle';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';
import { TVFocusGroup } from '@/components/TVFocusGroup';
import { TMDB_BASE_URL } from '@/config/tmdb';
import { useUiStore } from '@/store/uiStore';

import { getWatchProgress } from '@/utils/watchProgress';
import { mediaDocId } from '@/types/profileMedia';

export const TV_ROW_HEIGHT = 236;
const isTV = Platform.isTV;

export interface SectionData {
  type: 'media' | 'cw';
  title: string;
  data: any[];
}

export interface MediaRowProps {
  section: SectionData;
  rowIndex: number;
  onPressMedia: (item: any) => void;
  onPressContinueWatching?: (item: any) => void;
  onFocusRow?: (rowIndex: number) => void;
  onFocusMediaItem?: (item: any) => void;
}

// ──── SKELETON LOADERS ────
export const SkeletonCard = () => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isTV) {
      animatedValue.setValue(0.5);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.cardContainer}>
      <Animated.View style={[styles.skeletonCard, { opacity }]} />
      <Animated.View style={[styles.skeletonTitle, { opacity }]} />
    </View>
  );
};

export const SkeletonRow = () => (
  <View style={styles.rowContainer}>
    <View style={styles.skeletonRowTitle} />
    <View style={styles.skeletonList}>
      {[1, 2, 3, 4, 5].map((key) => (
        <SkeletonCard key={key} />
      ))}
    </View>
  </View>
);

export const SkeletonHome = () => {
  const isTVMode = Platform.isTV;
  return (
    <View style={styles.container}>
      <View style={styles.heroSkeletonContainer}>
        <View style={styles.heroSkeletonImage} />
        <View style={styles.heroContent}>
          <View style={[styles.skeletonRowTitle, { width: 80, height: 16, marginBottom: 8 }]} />
          <View style={[styles.skeletonRowTitle, { width: isTVMode ? 350 : 200, height: isTVMode ? 42 : 28, marginBottom: 12 }]} />
          <View style={[styles.skeletonRowTitle, { width: isTVMode ? 200 : 120, height: 14, marginBottom: 14 }]} />
          <View style={[styles.skeletonRowTitle, { width: isTVMode ? 450 : 260, height: 32, marginBottom: 18 }]} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[styles.skeletonRowTitle, { width: 110, height: 40, borderRadius: 8 }]} />
            <View style={[styles.skeletonRowTitle, { width: 110, height: 40, borderRadius: 8 }]} />
          </View>
        </View>
      </View>
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </View>
  );
};

const getOptimizedImageUrl = (url?: string | null, isBackdrop = false): string | null => {
  if (!url || typeof url !== 'string') return null;

  if (url.startsWith('/')) {
    const size = isBackdrop ? (isTV ? 'w780' : 'w780') : (isTV ? 'w300' : 'w300');
    return `https://image.tmdb.org/t/p/${size}${url}`;
  }

  const targetWidth = isBackdrop ? 'w780' : 'w300';
  if (url.includes('image.tmdb.org/t/p/')) {
    return url.replace(/\/t\/p\/(w\d+|original)\//, `/t/p/${targetWidth}/`);
  }
  return url;
};

// ──── MEDIA CARD ────
export interface MediaCardProps {
  item: any;
  rowIndex: number;
  cardIndex?: number;
  isPreferredFocus?: boolean;
  onPress: (item: any) => void;
  onFocus?: (rowIndex: number, cardIndex: number, item: any) => void;
}

export const MediaCard = React.memo<MediaCardProps>(
  ({ item, rowIndex, cardIndex = 0, isPreferredFocus = false, onPress, onFocus }) => {
    const { width } = useWindowDimensions();
    const isDesktopWeb = Platform.OS === 'web' && width > 768;

    const heroPlayBtnNodeId = useUiStore((state) => state.heroPlayBtnNodeId);
    const sidebarActiveNodeId = useUiStore((state) => state.sidebarActiveNodeId);
    const setFirstRowFirstCardNodeId = useUiStore((state) => state.setFirstRowFirstCardNodeId);
    const cardRef = useRef<any>(null);

    // Register first card of first row for Hero Play Button deterministic D-pad Down navigation
    useEffect(() => {
      if (isTV && rowIndex === 0 && cardIndex === 0 && cardRef.current) {
        const id = getTVNodeHandle(cardRef.current);
        if (id) {
          setFirstRowFirstCardNodeId(id);
          return () => {
            if (useUiStore.getState().firstRowFirstCardNodeId === id) {
              setFirstRowFirstCardNodeId(null);
            }
          };
        }
      }
    }, [rowIndex, cardIndex, setFirstRowFirstCardNodeId]);

    const rawBackdrop =
      item.backdropUrl ||
      item.backdrop_path ||
      item.backdropUri ||
      item.posterUrl ||
      item.poster_path ||
      item.thumbnail;

    const rawPoster =
      item.posterUrl ||
      item.poster_path ||
      item.poster ||
      item.backdropUrl ||
      item.backdrop_path ||
      item.thumbnail;

    // TV Prime Video layout uses 16:9 horizontal backdrop cards
    const posterUri = getOptimizedImageUrl(isTV ? (rawBackdrop || rawPoster) : rawPoster, isTV);

    const getSubtitle = () => {
      if (item.type === 'tv') {
        const seasonText = item.seasons ? `${item.seasons} Sezon` : '';
        const episodeText = item.episodes ? `${item.episodes} Bölüm` : '';
        if (seasonText && episodeText) return `${seasonText} • ${episodeText}`;
        if (seasonText) return seasonText;
        if (episodeText) return episodeText;
        return '';
      }
      return item.runtime ? item.runtime : '';
    };

    const subtitle = getSubtitle();

    const cardW = isDesktopWeb ? 185 : isTV ? 228 : 130;
    const cardH = isDesktopWeb ? 275 : isTV ? 128 : 185;

    return (
      <View
        style={[
          styles.cardContainer,
          {
            width: cardW,
            marginHorizontal: isDesktopWeb ? 6 : isTV ? 6 : 6,
          },
        ]}
      >
        <TVFocusable
          ref={cardRef}
          onPress={() => onPress(item)}
          onFocus={() => {
            onFocus?.(rowIndex, cardIndex, item);
          }}
          hasTVPreferredFocus={false}
          nextFocusLeft={cardIndex === 0 ? (sidebarActiveNodeId || undefined) : undefined}
          nextFocusUp={rowIndex === 0 ? (heroPlayBtnNodeId || undefined) : undefined}
          style={[
            styles.cardFocusable,
            {
              borderWidth: isTV ? 2.5 : 2,
              borderColor: 'transparent',
              borderRadius: isDesktopWeb ? 6 : 8,
              width: cardW,
              height: cardH,
              overflow: 'visible',
              backgroundColor: '#161c24',
            },
          ]}
          focusedStyle={
            isTV
              ? {
                  borderColor: '#E50914',
                  borderWidth: 2.5,
                  transform: [{ scale: 1.06 }],
                  elevation: 0,
                  zIndex: 20,
                }
              : {
                  borderColor: '#E50914',
                  transform: [{ scale: isDesktopWeb ? 1.1 : 1.05 }],
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.85,
                  shadowRadius: 20,
                  elevation: 12,
                }
          }
        >
          {({ focused }) => (
            <View style={[styles.card, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}>
              {posterUri ? (
                <Image
                  source={{ uri: posterUri }}
                  style={styles.cardImage}
                  contentFit="cover"
                  transition={isTV ? 0 : 100}
                  cachePolicy="memory-disk"
                  recyclingKey={String(item.id || item.tmdbId)}
                />
              ) : (
                <View style={styles.cardPlaceholder}>
                  <Ionicons name="film-outline" size={isTV ? 36 : 28} color="#555555" />
                  <ThemedText numberOfLines={2} style={styles.cardPlaceholderText}>
                    {item.title || item.name || ''}
                  </ThemedText>
                </View>
              )}

              {/* Mobile/Web Rating Badge */}
              {!isTV && item.rating && item.rating !== '—' && (
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={10} color="#F5C518" style={{ marginRight: 2 }} />
                  <ThemedText style={styles.ratingText}>{item.rating}</ThemedText>
                </View>
              )}
            </View>
          )}
        </TVFocusable>

        <ThemedText
          numberOfLines={1}
          style={[
            styles.cardTitle,
            isDesktopWeb && {
              fontSize: 13,
              fontWeight: '600',
              marginTop: 6,
              color: '#d4d4d4',
            },
          ]}
        >
          {item.title || item.name}
        </ThemedText>
        {subtitle ? <ThemedText numberOfLines={1} style={styles.cardSubtitle}>{subtitle}</ThemedText> : null}
      </View>
    );
  },
  (prevProps, nextProps) =>
    prevProps.item === nextProps.item &&
    prevProps.rowIndex === nextProps.rowIndex &&
    prevProps.cardIndex === nextProps.cardIndex &&
    prevProps.isPreferredFocus === nextProps.isPreferredFocus &&
    prevProps.onPress === nextProps.onPress &&
    prevProps.onFocus === nextProps.onFocus
);

// ──── CONTINUE WATCHING CARD ────
export interface ContinueWatchingCardProps {
  item: any;
  rowIndex: number;
  cardIndex?: number;
  isPreferredFocus?: boolean;
  onPress: (item: any) => void;
  onFocus?: (rowIndex: number, cardIndex: number, item: any) => void;
}

export const ContinueWatchingCard = React.memo<ContinueWatchingCardProps>(
  ({ item, rowIndex, cardIndex = 0, isPreferredFocus = false, onPress, onFocus }) => {
    const { width } = useWindowDimensions();
    const isDesktopWeb = Platform.OS === 'web' && width > 768;
    const heroPlayBtnNodeId = useUiStore((state) => state.heroPlayBtnNodeId);
    const sidebarActiveNodeId = useUiStore((state) => state.sidebarActiveNodeId);
    const setFirstRowFirstCardNodeId = useUiStore((state) => state.setFirstRowFirstCardNodeId);
    const cardRef = useRef<any>(null);
    useEffect(() => {
      if (!isTV || rowIndex !== 0 || cardIndex !== 0 || !cardRef.current) return;
      const nodeId = getTVNodeHandle(cardRef.current);
      if (nodeId) {
        setFirstRowFirstCardNodeId(nodeId);
        return () => {
          if (useUiStore.getState().firstRowFirstCardNodeId === nodeId) {
            setFirstRowFirstCardNodeId(null);
          }
        };
      }
    }, [rowIndex, cardIndex, setFirstRowFirstCardNodeId]);

    const rawBackdrop =
      item.backdropUrl ||
      item.backdrop_path ||
      item.posterUrl ||
      item.poster_path ||
      item.thumbnail;

    const backdropUri = getOptimizedImageUrl(rawBackdrop, true);

    const progress = getWatchProgress(item) * 100;

    const cardW = isDesktopWeb ? 260 : isTV ? 228 : 180;
    const cardH = isDesktopWeb ? 150 : isTV ? 128 : 105;

    return (
      <View
        style={[
          styles.cwCardContainer,
          {
            width: cardW,
            marginHorizontal: isDesktopWeb ? 6 : isTV ? 6 : 6,
          },
        ]}
      >
        <TVFocusable
          onPress={() => onPress(item)}
          onFocus={() => onFocus?.(rowIndex, cardIndex, item)}
          ref={cardRef}
          nextFocusUp={rowIndex === 0 ? (heroPlayBtnNodeId || undefined) : undefined}
          nextFocusLeft={cardIndex === 0 ? (sidebarActiveNodeId || undefined) : undefined}
          hasTVPreferredFocus={false}
          style={[
            styles.cwFocusable,
            {
              borderWidth: isTV ? 2.5 : 2,
              borderColor: 'transparent',
              borderRadius: isDesktopWeb ? 6 : 8,
              width: cardW,
              height: cardH,
              overflow: 'hidden',
              backgroundColor: '#161c24',
            },
          ]}
          focusedStyle={
            isTV
              ? {
                  borderColor: '#E50914',
                  borderWidth: 2.5,
                  transform: [{ scale: 1.05 }],
                  elevation: 0,
                  zIndex: 20,
                }
              : {
                  borderColor: '#E50914',
                  transform: [{ scale: isDesktopWeb ? 1.08 : 1.05 }],
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.85,
                  shadowRadius: 16,
                }
          }
        >
          <View style={[styles.cwCard, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}>
            {backdropUri ? (
              <Image
                source={{ uri: backdropUri }}
                style={styles.cwImage}
                contentFit="cover"
                transition={isTV ? 0 : 100}
                cachePolicy="memory-disk"
                recyclingKey={String(item.id || item.tmdbId)}
              />
            ) : (
              <View style={styles.cardPlaceholder}>
                <Ionicons name="play-circle-outline" size={32} color="#555555" />
              </View>
            )}

            <View style={styles.cwPlayOverlay}>
              <Ionicons name="play-circle" size={isTV ? 38 : 32} color="rgba(255,255,255,0.9)" />
            </View>

            {/* Netflix Red Progress Bar */}
            <View style={styles.cwProgressBackground}>
              <View style={[styles.cwProgressFill, { width: `${Math.min(100, Math.max(0, progress))}%` }]} />
            </View>
          </View>
        </TVFocusable>

        <ThemedText
          numberOfLines={1}
          style={[
            styles.cwTitle,
            isDesktopWeb && {
              fontSize: 13,
              fontWeight: '600',
              marginTop: 6,
              color: '#d4d4d4',
            },
          ]}
        >
          {item.show_title || item.title || item.name || 'İçerik'}
        </ThemedText>

        {(item.season_number || item.seasonNumber) && (item.episode_number || item.episodeNumber) ? (
          <ThemedText numberOfLines={1} style={styles.cwEpisodeSubtitle}>
            S{item.season_number || item.seasonNumber} B{item.episode_number || item.episodeNumber} {item.title && item.title !== item.show_title ? `• ${item.title}` : ''}
          </ThemedText>
        ) : null}
      </View>
    );
  },
  (prevProps, nextProps) =>
    prevProps.item === nextProps.item &&
    prevProps.rowIndex === nextProps.rowIndex &&
    prevProps.cardIndex === nextProps.cardIndex &&
    prevProps.isPreferredFocus === nextProps.isPreferredFocus &&
    prevProps.onPress === nextProps.onPress &&
    prevProps.onFocus === nextProps.onFocus
);

// ──── MEDIA ROW ────
export const MediaRow = React.memo<MediaRowProps>(
  ({
    section,
    rowIndex,
    onPressMedia,
    onPressContinueWatching,
    onFocusRow,
    onFocusMediaItem,
  }) => {
    const { width } = useWindowDimensions();
    const isDesktopWeb = Platform.OS === 'web' && width > 768;
    const listRef = useRef<any>(null);
    const [scrollOffset, setScrollOffset] = useState(0);
    const [isHovered, setIsHovered] = useState(false);

    const handleScrollLeft = () => {
      const newOffset = Math.max(0, scrollOffset - 750);
      setScrollOffset(newOffset);
      listRef.current?.scrollToOffset?.({ offset: newOffset, animated: true });
    };

    const handleScrollRight = () => {
      const newOffset = scrollOffset + 750;
      setScrollOffset(newOffset);
      listRef.current?.scrollToOffset?.({ offset: newOffset, animated: true });
    };

    const handleCardFocus = useCallback(
      (rIdx: number, cIdx: number, mediaItem: any) => {
        if (isTV) {
          listRef.current?.scrollToIndex({ index: cIdx, viewPosition: 0.25, animated: false });
        }
        onFocusMediaItem?.(mediaItem);
        onFocusRow?.(rIdx);
      },
      [onFocusMediaItem, onFocusRow]
    );

    const renderItem = useCallback(
      ({ item, index }: { item: any; index: number }) =>
        section.type === 'cw' ? (
          <ContinueWatchingCard
            item={item}
            rowIndex={rowIndex}
            cardIndex={index}
            isPreferredFocus={isTV && rowIndex === 0 && index === 0}
            onPress={onPressContinueWatching || onPressMedia}
            onFocus={handleCardFocus}
          />
        ) : (
          <MediaCard
            item={item}
            rowIndex={rowIndex}
            cardIndex={index}
            isPreferredFocus={isTV && rowIndex === 0 && index === 0}
            onPress={onPressMedia}
            onFocus={handleCardFocus}
          />
        ),
      [
        section.type,
        rowIndex,
        onPressContinueWatching,
        onPressMedia,
        handleCardFocus,
      ]
    );

    const keyExtractor = useCallback(
      (item: any) => mediaDocId(item),
      []
    );

    const rowData = useMemo(
      () => (isTV ? section.data.slice(0, 15) : section.data),
      [section.data]
    );

    const getHorizontalItemLayout = useCallback(
      (_: any, index: number) => ({
        length: 240,
        offset: 20 + 240 * index,
        index,
      }),
      []
    );

    return (
      <TVFocusGroup
        style={[
          styles.rowContainer,
          isTV && { height: TV_ROW_HEIGHT - 8 },
          isDesktopWeb && {
            marginTop: rowIndex === 0 ? -40 : 28,
            marginBottom: 8,
            position: 'relative',
            zIndex: 10,
          },
        ]}
        {...(isDesktopWeb
          ? ({
              onMouseEnter: () => setIsHovered(true),
              onMouseLeave: () => setIsHovered(false),
            } as any)
          : {})}
      >
        <ThemedText
          style={[
            styles.rowTitle,
            isDesktopWeb && {
              fontSize: 21,
              fontWeight: '700',
              marginLeft: 48,
              marginBottom: 10,
              letterSpacing: 0.2,
              color: '#E5E5E5',
            },
          ]}
        >
          {section.title}
        </ThemedText>

        <View style={{ position: 'relative' }}>
          {/* Netflix-Style Desktop Left Chevron Button */}
          {isDesktopWeb && isHovered && scrollOffset > 10 && (
            <button
              onClick={handleScrollLeft}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: '50px',
                zIndex: 40,
                backgroundColor: 'rgba(20, 20, 20, 0.75)',
                border: 'none',
                color: '#fff',
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
              <Ionicons name="chevron-back" size={32} color="#FFFFFF" />
            </button>
          )}

          {isTV ? (
            <FlatList
              ref={listRef}
              data={rowData}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              horizontal
              showsHorizontalScrollIndicator={false}
              removeClippedSubviews={false}
              contentContainerStyle={styles.listContent}
              initialNumToRender={Math.ceil(width / 240) + 1}
              maxToRenderPerBatch={4}
              windowSize={3}
              getItemLayout={getHorizontalItemLayout}
              onScrollToIndexFailed={({ index }) => {
                listRef.current?.scrollToOffset({ offset: 240 * index, animated: false });
              }}
            />
          ) : (
            <FlashList
              ref={listRef}
              data={rowData}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              horizontal
              showsHorizontalScrollIndicator={false}
              removeClippedSubviews={Platform.OS !== 'web'}
              contentContainerStyle={[
                styles.listContent,
                isDesktopWeb && { paddingHorizontal: 48 },
              ]}
              onScroll={
                isDesktopWeb
                  ? (e) => {
                      setScrollOffset(e.nativeEvent.contentOffset.x);
                    }
                  : undefined
              }
              scrollEventThrottle={isDesktopWeb ? 16 : undefined}
            />
          )}

          {/* Netflix-Style Desktop Right Chevron Button */}
          {isDesktopWeb && isHovered && (
            <button
              onClick={handleScrollRight}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                right: 0,
                width: '50px',
                zIndex: 40,
                backgroundColor: 'rgba(20, 20, 20, 0.75)',
                border: 'none',
                color: '#fff',
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
              <Ionicons name="chevron-forward" size={32} color="#FFFFFF" />
            </button>
          )}
        </View>
      </TVFocusGroup>
    );
  },
  (prevProps, nextProps) =>
    prevProps.section === nextProps.section &&
    prevProps.rowIndex === nextProps.rowIndex
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414' },
  heroSkeletonContainer: {
    position: 'relative',
    marginBottom: isTV ? 0 : 16,
    overflow: 'hidden',
  },
  heroSkeletonImage: {
    width: '100%',
    height: isTV ? 450 : 280,
    backgroundColor: '#1a1a1a',
  },
  heroContent: {
    position: 'absolute',
    bottom: isTV ? 50 : 16,
    left: 0,
    right: isTV ? undefined : 0,
    paddingHorizontal: isTV ? 50 : 16,
    maxWidth: isTV ? '50%' : undefined,
  },
  rowContainer: {
    marginTop: isTV ? 8 : 20,
    paddingVertical: isTV ? 6 : 8,
    overflow: 'visible',
  },
  rowTitle: {
    marginLeft: isTV ? 20 : 16,
    marginBottom: isTV ? 8 : 14,
    fontWeight: 'bold',
    fontSize: isTV ? 16 : 19,
    color: '#FFFFFF',
    letterSpacing: isTV ? 0.2 : 0,
  },
  listContent: {
    paddingHorizontal: isTV ? 20 : 12,
    paddingVertical: isTV ? 12 : 0,
    overflow: 'visible',
  },
  cardContainer: {
    width: isTV ? 228 : 130,
    marginHorizontal: isTV ? 6 : 6,
    paddingVertical: isTV ? 8 : 0,
    overflow: 'visible',
    alignItems: 'flex-start',
  },
  cardFocusable: {
    borderRadius: 8,
    overflow: 'visible',
  },
  card: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#161c24',
  },
  cardImage: { width: '100%', height: '100%', backgroundColor: '#161616' },
  cardPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  cardPlaceholderText: {
    color: '#777',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
  },
  cardTitle: {
    color: '#E2E8F0',
    fontSize: isTV ? 12 : 12,
    fontWeight: '600',
    marginTop: 4,
    width: '100%',
  },
  cardSubtitle: {
    color: '#94A3B8',
    fontSize: isTV ? 11 : 10.5,
    marginTop: 2,
    width: '100%',
  },
  ratingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

  // CW
  cwCardContainer: {
    width: isTV ? 228 : 180,
    marginHorizontal: isTV ? 6 : 6,
    paddingVertical: isTV ? 8 : 0,
    overflow: 'visible',
    alignItems: 'flex-start',
  },
  cwFocusable: {
    borderRadius: 8,
    overflow: 'visible',
  },
  cwCard: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#161c24',
  },
  cwImage: { width: '100%', height: '100%', backgroundColor: '#161616' },
  cwPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  cwProgressBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  cwProgressFill: {
    height: '100%',
    backgroundColor: '#E50914',
  },
  cwTitle: {
    color: '#E2E8F0',
    fontSize: isTV ? 13 : 12,
    fontWeight: '600',
    marginTop: 5,
    width: '100%',
  },
  cwEpisodeSubtitle: {
    color: '#94A3B8',
    fontSize: isTV ? 11 : 10.5,
    marginTop: 2,
    width: '100%',
  },

  // Skeleton styles
  skeletonCard: {
    width: isTV ? 150 : 130,
    height: isTV ? 225 : 185,
    backgroundColor: '#262626',
    borderRadius: 8,
  },
  skeletonTitle: {
    width: '80%',
    height: 12,
    backgroundColor: '#262626',
    borderRadius: 4,
    marginTop: 6,
  },
  skeletonRowTitle: {
    width: 140,
    height: 20,
    backgroundColor: '#262626',
    borderRadius: 4,
    marginLeft: isTV ? 28 : 16,
    marginBottom: 14,
  },
  skeletonList: {
    flexDirection: 'row',
    paddingHorizontal: isTV ? 20 : 12,
  },
});
