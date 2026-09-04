import React from 'react';
import {
  View,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';


export interface SearchResultGridProps {
  results: any[];
  loading: boolean;
  page: number;
  isSearchActive: boolean;
  onLoadMore: () => void;
  onSelectDetail: (item: any) => void;
  onSelectActor?: (actor: { name: string; tmdbId: string; profileUrl?: string }) => void;
  flatListRef?: any;
  numColumns: number;

  contentContainerStyle?: any;
  cardWidth: number;
  emptyHintText?: string;
  styles: any;
}

export const SearchResultGrid: React.FC<SearchResultGridProps> = ({
  results,
  loading,
  page,
  isSearchActive,
  onLoadMore,
  onSelectDetail,
  onSelectActor,
  flatListRef,
  numColumns,
  contentContainerStyle,
  cardWidth,
  emptyHintText = 'Film veya dizi adı yazın ya da tür seçin',
  styles,
}) => {
  const renderResultItem = ({ item }: { item: any }) => {
    if (item.type === 'person') {
      if (!item.posterUrl) return null;
      return (
        <TVFocusable
          key={`person-${item.id}`}
          onPress={() =>
            onSelectActor?.({
              name: item.title,
              tmdbId: item.tmdbId,
              profileUrl: item.posterUrl,
            })
          }
          style={[styles.resultFocusable, { width: cardWidth }]}
          focusedStyle={{
            borderColor: '#8B5CF6',
            borderWidth: 2,
            borderRadius: 10,
            transform: [{ scale: 1.05 }],
          }}
        >
          <View style={styles.resultCard}>
            <Image
              source={{ uri: item.posterUrl }}
              style={styles.resultImage}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          </View>
          <View style={styles.resultInfoBelow}>
            <ThemedText numberOfLines={1} style={styles.resultTitle}>
              {item.title}
            </ThemedText>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 3,
              }}
            >
              <ThemedText numberOfLines={1} style={[styles.resultYear, { flex: 1, marginRight: 4 }]}>
                {item.knownFor || 'Oyuncu'}
              </ThemedText>
              <View
                style={[
                  styles.typeBadge,
                  { backgroundColor: '#8B5CF6' },
                ]}
              >
                <ThemedText style={styles.typeBadgeText}>
                  Oyuncu
                </ThemedText>
              </View>
            </View>
          </View>
        </TVFocusable>
      );
    }

    return (
      <TVFocusable
        key={`media-${item.id}-${item.isJellyfin ? 'j' : 't'}`}
        onPress={() => onSelectDetail(item)}
        style={[styles.resultFocusable, { width: cardWidth }]}
        focusedStyle={{
          borderColor: '#E50914',
          borderWidth: 2,
          borderRadius: 10,
          transform: [{ scale: 1.05 }],
        }}
      >
        <View style={styles.resultCard}>
          {item.posterUrl ? (
            <Image
              source={{ uri: item.posterUrl }}
              style={styles.resultImage}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <View
              style={[
                styles.resultImage,
                {
                  backgroundColor: '#1c1c21',
                  justifyContent: 'center',
                  alignItems: 'center',
                },
              ]}
            >
              <Ionicons
                name={item.type === 'tv' ? 'tv-outline' : 'film-outline'}
                size={28}
                color="#555"
              />
            </View>
          )}
          {item.rating && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={9} color="#F5C518" />
              <ThemedText style={styles.ratingText}> {item.rating}</ThemedText>
            </View>
          )}
        </View>
        <View style={styles.resultInfoBelow}>
          <ThemedText numberOfLines={1} style={styles.resultTitle}>
            {item.title}
          </ThemedText>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 3,
            }}
          >
            {item.year ? (
              <ThemedText style={styles.resultYear}>{item.year}</ThemedText>
            ) : (
              <View />
            )}
            <View
              style={[
                styles.typeBadge,
                { backgroundColor: item.type === 'movie' ? '#E50914' : '#3B82F6' },
              ]}
            >
              <ThemedText style={styles.typeBadgeText}>
                {item.type === 'movie' ? 'Film' : 'Dizi'}
              </ThemedText>
            </View>
          </View>
        </View>
      </TVFocusable>
    );
  };

  if (loading && page === 1) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#E50914" />
      </View>
    );
  }

  if (results.length > 0) {
    return (
      <FlashList
        ref={flatListRef as any}
        data={results}
        renderItem={renderResultItem}
        keyExtractor={(item: any) => `res-${item.id}-${item.isJellyfin ? 'j' : 't'}`}
        numColumns={numColumns}
        key={`results-grid-col-${numColumns}`}
        contentContainerStyle={contentContainerStyle || styles.resultsGrid}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loading && page > 1 ? (
            <ActivityIndicator style={{ margin: 20 }} color="#E50914" />
          ) : null
        }
      />

    );

  }

  if (isSearchActive) {
    return (
      <View style={styles.center}>
        <Ionicons name="search-outline" size={48} color="#444" />
        <ThemedText style={{ color: '#666', marginTop: 12 }}>Sonuç bulunamadı</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <Ionicons name="film-outline" size={48} color="#444" />
      <ThemedText style={{ color: '#666', marginTop: 12 }}>{emptyHintText}</ThemedText>
    </View>
  );
};

// ──── RECENT HISTORY & TRENDING (Mobile & TV) ────
export interface SearchHistoryAndTrendingProps {
  isSearchActive: boolean;
  activeGenreIds: number[];
  trendingItems: any[];
  searchHistory: string[];
  onSelectTrending: (item: any) => void;
  onSelectHistory: (term: string) => void;
  onClearHistory: () => void;
  isTV?: boolean;
  styles: any;
}

export const SearchHistoryAndTrending: React.FC<SearchHistoryAndTrendingProps> = ({
  isSearchActive,
  activeGenreIds,
  trendingItems,
  searchHistory,
  onSelectTrending,
  onSelectHistory,
  onClearHistory,
  isTV,
  styles,
}) => {
  if (isSearchActive || activeGenreIds.length > 0) return null;

  if (isTV) {
    return (
      <>
        {/* Trending - TV */}
        {trendingItems.length > 0 && (
          <View style={{ marginTop: 24, flex: 1 }}>
            <ThemedText
              style={{ color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 10 }}
            >
              Trend Olanlar
            </ThemedText>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {trendingItems.slice(0, 5).map((item, idx) => (
                <TVFocusable
                  key={idx}
                  onPress={() => onSelectTrending(item)}
                  style={styles.tvHistoryItem}
                  focusedStyle={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}>
                    <Ionicons
                      name="trending-up"
                      size={16}
                      color="#E50914"
                      style={{ marginRight: 8 }}
                    />
                    <ThemedText style={{ color: '#fff', fontSize: 13 }} numberOfLines={1}>
                      {item.title || item.name}
                    </ThemedText>
                  </View>
                </TVFocusable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Search History - TV */}
        {searchHistory.length > 0 && (
          <View style={{ marginTop: 24, flex: 1 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <ThemedText style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                Son Aramalar
              </ThemedText>
              <TVFocusable
                onPress={onClearHistory}
                focusedStyle={{ backgroundColor: 'rgba(229,9,20,0.15)', borderRadius: 4 }}
              >
                <ThemedText style={{ color: '#E50914', fontSize: 13 }}>Temizle</ThemedText>
              </TVFocusable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {searchHistory.map((term, idx) => (
                <TVFocusable
                  key={idx}
                  onPress={() => onSelectHistory(term)}
                  style={styles.tvHistoryItem}
                  focusedStyle={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}>
                    <Ionicons
                      name="time-outline"
                      size={16}
                      color="#9CA3AF"
                      style={{ marginRight: 8 }}
                    />
                    <ThemedText style={{ color: '#9CA3AF', fontSize: 13 }} numberOfLines={1}>
                      {term}
                    </ThemedText>
                  </View>
                </TVFocusable>
              ))}
            </ScrollView>
          </View>
        )}
      </>
    );
  }

  // Mobile
  return (
    <>
      {/* Trending - Mobile */}
      {trendingItems.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <ThemedText
            style={{
              color: '#fff',
              fontWeight: '700',
              fontSize: 15,
              paddingHorizontal: 16,
              marginBottom: 8,
            }}
          >
            Trend Olanlar
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            {trendingItems.map((item, idx) => (
              <TVFocusable
                key={idx}
                onPress={() => onSelectTrending(item)}
                style={styles.historyChip}
                focusedStyle={{
                  borderColor: '#FFFFFF',
                  borderWidth: 1.5,
                  transform: [{ scale: 1.05 }],
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons
                    name="trending-up"
                    size={14}
                    color="#E50914"
                    style={{ marginRight: 4 }}
                  />
                  <ThemedText style={{ color: '#fff', fontSize: 13 }} numberOfLines={1}>
                    {item.title || item.name}
                  </ThemedText>
                </View>
              </TVFocusable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Search History - Mobile */}
      {searchHistory.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 16,
            }}
          >
            <ThemedText style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
              Son Aramalar
            </ThemedText>
            <TVFocusable
              onPress={onClearHistory}
              focusedStyle={{
                backgroundColor: 'rgba(229,9,20,0.15)',
                borderRadius: 4,
                paddingHorizontal: 4,
              }}
            >
              <ThemedText style={{ color: '#E50914', fontSize: 13 }}>Temizle</ThemedText>
            </TVFocusable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginTop: 8 }}
          >
            {searchHistory.map((term, idx) => (
              <TVFocusable
                key={idx}
                onPress={() => onSelectHistory(term)}
                style={styles.historyChip}
                focusedStyle={{
                  borderColor: '#FFFFFF',
                  borderWidth: 1.5,
                  transform: [{ scale: 1.05 }],
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color="#9CA3AF"
                    style={{ marginRight: 4 }}
                  />
                  <ThemedText style={{ color: '#9CA3AF', fontSize: 13 }} numberOfLines={1}>
                    {term}
                  </ThemedText>
                </View>
              </TVFocusable>
            ))}
          </ScrollView>
        </View>
      )}
    </>
  );
};
