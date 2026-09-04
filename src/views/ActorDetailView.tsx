
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';
import {
  TMDB_BASE_URL,
  TMDB_IMAGE_BASE_URL,
} from '@/config/tmdb';

const { width, height } = Dimensions.get('window');

const isTV = Platform.isTV;

const numColumns = isTV ? 5 : 3;

const GRID_PADDING = isTV ? 42 : 16;
const CARD_GAP = isTV ? 18 : 10;

const itemWidth =
  (width -
    GRID_PADDING * 2 -
    CARD_GAP * (numColumns - 1)) /
  numColumns;

interface ActorDetailViewProps {
  actor: {
    name: string;
    tmdbId?: string | number | null;
    profileUrl?: string;
  } | null;

  onClose: () => void;

  onSelectMedia: (media: any) => void;
}

function getOptimizedImageUrl(
  url?: string | null,
  type: 'avatar' | 'backdrop' = 'avatar'
): string | null {
  if (!url) return null;

  if (type === 'backdrop') {
    return url
      .replace('/original/', '/w780/')
      .replace('/w1280/', '/w780/');
  }

  return url
    .replace('/original/', '/w185/')
    .replace('/w1280/', '/w185/')
    .replace('/w780/', '/w185/')
    .replace('/w500/', '/w185/')
    .replace('/w342/', '/w185/')
    .replace('/w300/', '/w185/')
    .replace('/w154/', '/w185/')
    .replace('/w92/', '/w185/')
    .replace('/w45/', '/w185/');
}

const getOriginalImageUrl = getOptimizedImageUrl;

function normalizeCredit(item: any) {
  const isTv = item.media_type === 'tv';

  return {
    id: item.id,
    title: item.title || item.name,
    type: isTv ? 'tv' : 'movie',
    isJellyfin: false,
    tmdbId: item.id?.toString(),

    posterUrl: item.poster_path
      ? `${TMDB_IMAGE_BASE_URL}/w500${item.poster_path}`
      : null,

    backdropUrl: item.backdrop_path
      ? `${TMDB_IMAGE_BASE_URL}/w780${item.backdrop_path}`
      : null,

    rating:
      item.vote_average !== undefined &&
        item.vote_average !== null
        ? Number(item.vote_average).toFixed(1)
        : null,

    year: (
      item.release_date ||
      item.first_air_date ||
      ''
    ).split('-')[0] || '',

    overview: item.overview || '',
    character: item.character || '',
    popularity: item.popularity || 0,
  };
}

export function ActorDetailView({
  actor,
  onClose,
  onSelectMedia,
}: ActorDetailViewProps) {
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);

  const [profileImage, setProfileImage] = useState<string | null>(
    getOriginalImageUrl(actor?.profileUrl)
  );

  useEffect(() => {
    if (!actor?.name) {
      setLoading(false);
      setItems([]);
      setProfileImage(null);
      return;
    }

    setProfileImage(
      getOriginalImageUrl(actor.profileUrl)
    );

    loadActorCredits();
  }, [
    actor?.tmdbId,
    actor?.name,
    actor?.profileUrl,
  ]);

  if (!actor) {
    return null;
  }

  const loadActorCredits = async () => {
    setLoading(true);

    try {
      let personId = actor.tmdbId;

      if (!personId) {
        const searchUrl =
          `${TMDB_BASE_URL}/search/person` +
          `?query=${encodeURIComponent(actor.name)}` +
          `&language=tr-TR`;

        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();

        const person = searchData.results?.[0];

        personId = person?.id;

        if (!actor.profileUrl && person?.profile_path) {
          setProfileImage(
            `${TMDB_IMAGE_BASE_URL}/w185${person.profile_path}`
          );
        }
      }

      if (!personId) {
        setItems([]);
        setLoading(false);
        return;
      }

      const personUrl =
        `${TMDB_BASE_URL}/person/${personId}` +
        `?language=tr-TR`;

      const personRes = await fetch(personUrl);
      const personData = await personRes.json();

      if (
        !actor.profileUrl &&
        personData?.profile_path
      ) {
        setProfileImage(
          `${TMDB_IMAGE_BASE_URL}/w185${personData.profile_path}`
        );
      }

      const creditsUrl =
        `${TMDB_BASE_URL}/person/${personId}` +
        `/combined_credits?language=tr-TR`;

      const res = await fetch(creditsUrl);
      const data = await res.json();

      const cast = (data.cast || []).filter(
        (item: any) =>
          item.media_type === 'movie' ||
          item.media_type === 'tv'
      );

      const seen = new Set<string>();

      const deduped = cast.filter((item: any) => {
        const key =
          `${item.media_type}-${item.id}`;

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });

      const normalized = deduped
        .map(normalizeCredit)
        .filter(
          (item: any) => item.posterUrl
        )
        .sort(
          (a: any, b: any) => {
            const yearDiff =
              (parseInt(b.year) || 0) -
              (parseInt(a.year) || 0);

            if (yearDiff !== 0) {
              return yearDiff;
            }

            return b.popularity - a.popularity;
          }
        );

      setItems(normalized);
    } catch (error) {
      console.error(
        'Oyuncu filmografisi yüklenirken hata:',
        error
      );

      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({
    item,
  }: {
    item: any;
  }) => (
    <TVFocusable
      onPress={() => onSelectMedia(item)}
      style={styles.cardFocusable}
      focusedStyle={styles.cardFocused}
    >
      <View style={styles.card}>
        <Image
          source={{ uri: item.posterUrl }}
          style={styles.poster}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />

        <LinearGradient
          colors={[
            'transparent',
            'rgba(0,0,0,0.9)',
          ]}
          locations={[0.5, 1]}
          style={styles.posterGradient}
        />

        {item.rating &&
          item.rating !== '0.0' && (
            <View style={styles.ratingBadge}>
              <Ionicons
                name="star"
                size={isTV ? 11 : 9}
                color="#F5C518"
              />

              <ThemedText style={styles.ratingText}>
                {item.rating}
              </ThemedText>
            </View>
          )}

        <View style={styles.posterBottom}>
          {item.year ? (
            <ThemedText style={styles.posterYear}>
              {item.year}
            </ThemedText>
          ) : null}

          {item.character ? (
            <ThemedText
              numberOfLines={1}
              style={styles.character}
            >
              {item.character}
            </ThemedText>
          ) : null}
        </View>
      </View>

      <View style={styles.cardInfo}>
        <ThemedText
          numberOfLines={1}
          style={styles.itemTitle}
        >
          {item.title}
        </ThemedText>

        <View style={styles.metaRow}>
          <View
            style={[
              styles.typeDot,
              {
                backgroundColor:
                  item.type === 'movie'
                    ? '#E50914'
                    : '#3B82F6',
              },
            ]}
          />

          <ThemedText style={styles.typeText}>
            {item.type === 'movie'
              ? 'Film'
              : 'Dizi'}
          </ThemedText>

          {item.year ? (
            <>
              <View style={styles.metaSeparator} />

              <ThemedText style={styles.metaYear}>
                {item.year}
              </ThemedText>
            </>
          ) : null}
        </View>
      </View>
    </TVFocusable>
  );

  const ListHeader = () => (
    <View style={styles.hero}>
      <View style={styles.heroBackground}>
        {profileImage ? (
          <Image
            source={{ uri: profileImage }}
            style={styles.heroImage}
            contentFit="cover"
            transition={450}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.heroFallback}>
            <Ionicons
              name="person"
              size={isTV ? 100 : 70}
              color="#333"
            />
          </View>
        )}

        <LinearGradient
          colors={[
            '#0B0B0B',
            'rgba(11,11,11,0.98)',
            'rgba(11,11,11,0.75)',
            'rgba(11,11,11,0.05)',
          ]}
          locations={[
            0,
            0.28,
            0.58,
            1,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.heroSideGradient}
        />

        <LinearGradient
          colors={[
            'rgba(0,0,0,0.7)',
            'transparent',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.heroTopGradient}
        />

        <LinearGradient
          colors={[
            'transparent',
            'rgba(11,11,11,0.5)',
            '#0B0B0B',
          ]}
          locations={[
            0,
            0.58,
            1,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.heroBottomGradient}
        />
      </View>

      <View
        style={[
          styles.heroContent,
          {
            paddingTop:
              insets.top +
              (isTV ? 45 : 35),
          },
        ]}
      >
        <View style={styles.heroInfo}>
          <View style={styles.actorLabel}>
            <View style={styles.actorLabelLine} />

            <ThemedText style={styles.eyebrow}>
              OYUNCU
            </ThemedText>
          </View>

          <ThemedText
            numberOfLines={2}
            style={styles.profileName}
          >
            {actor.name}
          </ThemedText>

          <View style={styles.heroStats}>
            <View style={styles.statItem}>
              <ThemedText style={styles.statNumber}>
                {items.length}
              </ThemedText>

              <ThemedText style={styles.statLabel}>
                Yapım
              </ThemedText>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <ThemedText style={styles.statNumber}>
                {
                  items.filter(
                    (item) =>
                      item.type === 'movie'
                  ).length
                }
              </ThemedText>

              <ThemedText style={styles.statLabel}>
                Film
              </ThemedText>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <ThemedText style={styles.statNumber}>
                {
                  items.filter(
                    (item) =>
                      item.type === 'tv'
                  ).length
                }
              </ThemedText>

              <ThemedText style={styles.statLabel}>
                Dizi
              </ThemedText>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <ThemedText style={styles.sectionTitle}>
            Filmografi
          </ThemedText>

          <ThemedText style={styles.sectionSubtitle}>
            Yer aldığı yapımlar
          </ThemedText>
        </View>

        <View style={styles.countBadge}>
          <ThemedText style={styles.countText}>
            {items.length}
          </ThemedText>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.backButtonWrap,
          {
            top: insets.top + 14,
          },
        ]}
      >
        <TVFocusable
          onPress={onClose}
          style={styles.backButton}
          focusedStyle={styles.backButtonFocused}
        >
          <Ionicons
            name="arrow-back"
            size={isTV ? 26 : 23}
            color="#fff"
          />
        </TVFocusable>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ListHeader />

          <View style={styles.loadingBox}>
            <ActivityIndicator
              size="large"
              color="#E50914"
            />

            <ThemedText style={styles.loadingText}>
              Filmografi yükleniyor...
            </ThemedText>
          </View>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) =>
            `${item.type}-${item.id}`
          }
          numColumns={numColumns}
          key={`grid-${numColumns}`}
          ListHeaderComponent={ListHeader}
          ListHeaderComponentStyle={
            styles.listHeader
          }
          contentContainerStyle={
            styles.listContent
          }
          columnWrapperStyle={
            numColumns > 1
              ? styles.columnWrapper
              : undefined
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={
            Platform.OS === 'android'
          }
          initialNumToRender={isTV ? 10 : 15}
          maxToRenderPerBatch={isTV ? 5 : 15}
          windowSize={isTV ? 5 : 7}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="film-outline"
                  size={38}
                  color="#555"
                />
              </View>

              <ThemedText style={styles.emptyTitle}>
                Filmografi bulunamadı
              </ThemedText>

              <ThemedText style={styles.emptyText}>
                Bu oyuncuya ait yapım bulunamadı.
              </ThemedText>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },

  listHeader: {
    width,
  },

  backButtonWrap: {
    position: 'absolute',
    left: isTV ? 34 : 16,
    zIndex: 100,
  },

  backButton: {
    width: isTV ? 48 : 42,
    height: isTV ? 48 : 42,
    borderRadius: isTV ? 16 : 14,
    backgroundColor: 'rgba(10,10,10,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  backButtonFocused: {
    backgroundColor: '#E50914',
    borderColor: '#FF3943',
    transform: [{ scale: 1.08 }],
  },

  hero: {
    width,
    height: isTV
      ? Math.min(height * 0.52, 540)
      : Math.min(height * 0.48, 430),
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#0B0B0B',
    marginBottom: 8,
  },

  heroBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width,
    overflow: 'hidden',
    backgroundColor: '#111',
  },

  heroImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: isTV
      ? width * 0.82
      : width * 0.92,
    height: '100%',
  },

  heroFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171717',
  },

  heroSideGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  heroTopGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
  },

  heroBottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '65%',
  },

  heroContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: isTV ? 58 : 24,
    zIndex: 3,
  },

  heroInfo: {
    width: isTV
      ? width * 0.48
      : width * 0.66,
    maxWidth: isTV ? 620 : 430,
  },

  actorLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  actorLabelLine: {
    width: 25,
    height: 2,
    borderRadius: 2,
    backgroundColor: '#E50914',
    marginRight: 9,
  },

  eyebrow: {
    color: '#E50914',
    fontSize: isTV ? 12 : 10,
    fontWeight: '900',
    letterSpacing: 2.5,
  },

  profileName: {
    color: '#fff',
    fontSize: isTV ? 46 : 31,
    lineHeight: isTV ? 54 : 37,
    fontWeight: '900',
    letterSpacing: -1.2,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: {
      width: 0,
      height: 3,
    },
    textShadowRadius: 12,
  },

  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: isTV ? 25 : 20,
  },

  statItem: {
    minWidth: isTV ? 65 : 52,
  },

  statNumber: {
    color: '#fff',
    fontSize: isTV ? 20 : 17,
    fontWeight: '800',
  },

  statLabel: {
    color: '#888',
    fontSize: isTV ? 11 : 9,
    marginTop: 3,
    fontWeight: '600',
  },

  statDivider: {
    width: 1,
    height: 28,
    backgroundColor:
      'rgba(255,255,255,0.16)',
    marginHorizontal: isTV ? 20 : 13,
  },

  sectionHeader: {
    position: 'absolute',
    left: isTV ? 42 : 16,
    right: isTV ? 42 : 16,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    zIndex: 5,
  },

  sectionTitle: {
    color: '#fff',
    fontSize: isTV ? 27 : 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },

  sectionSubtitle: {
    color: '#777',
    fontSize: isTV ? 12 : 11,
    marginTop: 3,
  },

  countBadge: {
    minWidth: 34,
    height: 28,
    paddingHorizontal: 9,
    borderRadius: 8,
    backgroundColor: '#181818',
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  countText: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: '800',
  },

  listContent: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 70,
  },

  columnWrapper: {
    gap: CARD_GAP,
  },

  cardFocusable: {
    width: itemWidth,
    marginBottom: isTV ? 26 : 18,
  },

  cardFocused: {
    transform: [{ scale: isTV ? 1.08 : 1.05 }],
    borderColor: '#E50914',
    borderWidth: isTV ? 3 : 2,
    borderRadius: isTV ? 14 : 10,
    zIndex: 20,
  },

  card: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: isTV ? 13 : 9,
    overflow: 'hidden',
    backgroundColor: '#171717',
    position: 'relative',
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.06)',
  },

  poster: {
    width: '100%',
    height: '100%',
  },

  posterGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '48%',
  },

  ratingBadge: {
    position: 'absolute',
    top: 9,
    right: 9,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor:
      'rgba(0,0,0,0.82)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.08)',
  },

  ratingText: {
    color: '#F5C518',
    fontSize: isTV ? 11 : 9,
    fontWeight: '900',
    marginLeft: 4,
  },

  posterBottom: {
    position: 'absolute',
    left: 11,
    right: 11,
    bottom: 10,
  },

  posterYear: {
    color: '#ddd',
    fontSize: isTV ? 11 : 9,
    fontWeight: '700',
  },

  character: {
    color: '#fff',
    fontSize: isTV ? 12 : 10,
    fontWeight: '700',
    marginTop: 2,
  },

  cardInfo: {
    paddingTop: isTV ? 9 : 7,
    paddingHorizontal: 2,
  },

  itemTitle: {
    color: '#fff',
    fontSize: isTV ? 14 : 11,
    fontWeight: '800',
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },

  typeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginRight: 5,
  },

  typeText: {
    color: '#888',
    fontSize: isTV ? 10 : 9,
    fontWeight: '600',
  },

  metaSeparator: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#555',
    marginHorizontal: 7,
  },

  metaYear: {
    color: '#777',
    fontSize: isTV ? 10 : 9,
    fontWeight: '600',
  },

  loadingContainer: {
    flex: 1,
  },

  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 35,
  },

  loadingText: {
    color: '#777',
    fontSize: 13,
    marginTop: 12,
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 70,
    paddingBottom: 100,
  },

  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyTitle: {
    color: '#ddd',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 18,
  },

  emptyText: {
    color: '#666',
    fontSize: 12,
    marginTop: 6,
  },
});

