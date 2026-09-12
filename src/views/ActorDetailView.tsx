import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Platform,
  BackHandler,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';
import { TMDB_BASE_URL, TMDB_IMAGE_BASE_URL } from '@/config/tmdb';

const isTV = Platform.isTV;

interface ActorDetailViewProps {
  actor: {
    name: string;
    tmdbId?: string | number | null;
    profileUrl?: string;
  } | null;
  onClose: () => void;
  onSelectMedia: (media: any) => void;
}

interface PersonDetails {
  id?: number;
  name?: string;
  biography?: string;
  birthday?: string;
  deathday?: string | null;
  place_of_birth?: string | null;
  known_for_department?: string;
  profile_path?: string | null;
}

type FilterType = 'all' | 'movie' | 'tv';

function getHighResProfileUrl(url?: string | null): string | null {
  if (!url) return null;
  return url
    .replace('/w185/', '/h632/')
    .replace('/w300/', '/h632/')
    .replace('/w342/', '/h632/')
    .replace('/w500/', '/h632/')
    .replace('/w92/', '/h632/')
    .replace('/w45/', '/h632/');
}

function formatBirthAndAge(birthday?: string | null, deathday?: string | null): string | null {
  if (!birthday) return null;
  const birthDate = new Date(birthday);
  if (isNaN(birthDate.getTime())) return birthday;
  const endDate = deathday ? new Date(deathday) : new Date();
  let age = endDate.getFullYear() - birthDate.getFullYear();
  const m = endDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && endDate.getDate() < birthDate.getDate())) {
    age--;
  }
  const year = birthDate.getFullYear();
  if (deathday) {
    const deathYear = new Date(deathday).getFullYear();
    return `${year} – ${deathYear} (${age} yaşında vefat etti)`;
  }
  return `${year} (${age} yaşında)`;
}

function formatDepartment(dept?: string | null): string {
  if (!dept) return 'Oyuncu';
  const lower = dept.toLowerCase();
  if (lower === 'acting') return 'Oyuncu';
  if (lower === 'directing') return 'Yönetmen';
  if (lower === 'writing') return 'Senarist';
  if (lower === 'production') return 'Yapımcı';
  return dept;
}

function normalizeCredit(item: any) {
  const isTv = item.media_type === 'tv';
  return {
    id: item.id,
    title: item.title || item.name,
    type: isTv ? 'tv' : 'movie',
    isJellyfin: false,
    tmdbId: item.id?.toString(),
    posterUrl: item.poster_path ? `${TMDB_IMAGE_BASE_URL}/w500${item.poster_path}` : null,
    backdropUrl: item.backdrop_path ? `${TMDB_IMAGE_BASE_URL}/w780${item.backdrop_path}` : null,
    rating:
      item.vote_average !== undefined && item.vote_average !== null && item.vote_average > 0
        ? Number(item.vote_average).toFixed(1)
        : null,
    year: (item.release_date || item.first_air_date || '').split('-')[0] || '',
    overview: item.overview || '',
    character: item.character || '',
    popularity: item.popularity || 0,
  };
}

export function ActorDetailView({ actor, onClose, onSelectMedia }: ActorDetailViewProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Grid columns & card width calculation
  const numColumns = isTV ? 5 : width >= 768 ? 4 : 3;
  const gridPadding = isTV ? 40 : 16;
  const cardGap = isTV ? 16 : 10;
  const cardWidth = Math.floor(
    (width - gridPadding * 2 - cardGap * (numColumns - 1)) / numColumns
  );

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [personInfo, setPersonInfo] = useState<PersonDetails | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(
    getHighResProfileUrl(actor?.profileUrl)
  );
  const [filter, setFilter] = useState<FilterType>('all');
  const [bioExpanded, setBioExpanded] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const backBtnRef = useRef<any>(null);

  // Hardware back handler
  useEffect(() => {
    if (!actor) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [actor, onClose]);

  // Load Actor Details & Credits
  useEffect(() => {
    if (!actor?.name) {
      setLoading(false);
      setItems([]);
      setProfileImage(null);
      return;
    }

    setProfileImage(getHighResProfileUrl(actor.profileUrl));
    loadActorData();
  }, [actor?.tmdbId, actor?.name, actor?.profileUrl]);

  const loadActorData = async () => {
    if (!actor?.name) return;
    setLoading(true);

    try {
      let personId = actor.tmdbId;

      // 1. If personId is missing, search person by name
      if (!personId) {
        const searchUrl = `${TMDB_BASE_URL}/search/person?query=${encodeURIComponent(
          actor.name
        )}&language=tr-TR`;
        const searchRes = await fetch(searchUrl);
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const found = searchData.results?.[0];
          if (found?.id) {
            personId = found.id;
            if (found.profile_path) {
              setProfileImage(`${TMDB_IMAGE_BASE_URL}/h632${found.profile_path}`);
            }
          }
        }
      }

      if (!personId) {
        setItems([]);
        setLoading(false);
        return;
      }

      // 2. Fetch Person Details (TR with EN bio fallback)
      let details: PersonDetails = {};
      try {
        const personRes = await fetch(`${TMDB_BASE_URL}/person/${personId}?language=tr-TR`);
        if (personRes.ok) {
          details = await personRes.json();
        }

        // Fallback for biography if Turkish is empty
        if (!details.biography) {
          const personEnRes = await fetch(`${TMDB_BASE_URL}/person/${personId}?language=en-US`);
          if (personEnRes.ok) {
            const enData = await personEnRes.json();
            if (enData.biography) {
              details.biography = enData.biography;
            }
          }
        }

        if (details.profile_path) {
          setProfileImage(`${TMDB_IMAGE_BASE_URL}/h632${details.profile_path}`);
        }
        setPersonInfo(details);
      } catch (err) {
        console.warn('[ActorDetailView] Person details fetch error:', err);
      }

      // 3. Fetch Person Combined Credits
      const creditsRes = await fetch(
        `${TMDB_BASE_URL}/person/${personId}/combined_credits?language=tr-TR`
      );
      if (creditsRes.ok) {
        const creditsData = await creditsRes.json();
        const cast = (creditsData.cast || []).filter(
          (item: any) => item.media_type === 'movie' || item.media_type === 'tv'
        );

        const seen = new Set<string>();
        const deduped = cast.filter((item: any) => {
          const key = `${item.media_type}-${item.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        const normalized = deduped
          .map(normalizeCredit)
          .filter((item: any) => item.posterUrl)
          .sort((a: any, b: any) => {
            const yearDiff = (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0);
            if (yearDiff !== 0) return yearDiff;
            return (b.popularity || 0) - (a.popularity || 0);
          });

        setItems(normalized);
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error('[ActorDetailView] Error loading actor data:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter items based on active tab
  const movieCount = useMemo(() => items.filter((i) => i.type === 'movie').length, [items]);
  const tvCount = useMemo(() => items.filter((i) => i.type === 'tv').length, [items]);

  const filteredItems = useMemo(() => {
    if (filter === 'movie') return items.filter((i) => i.type === 'movie');
    if (filter === 'tv') return items.filter((i) => i.type === 'tv');
    return items;
  }, [items, filter]);

  if (!actor) return null;

  const birthAndAge = formatBirthAndAge(personInfo?.birthday, personInfo?.deathday);
  const department = formatDepartment(personInfo?.known_for_department);

  // Render Grid Item
  const renderItem = ({ item }: { item: any }) => (
    <TVFocusable
      onPress={() => onSelectMedia(item)}
      containerStyle={{ width: cardWidth, marginBottom: isTV ? 20 : 14 }}
      style={[styles.cardContainer, { width: cardWidth }]}
      focusedStyle={styles.cardFocused}
      accessibilityLabel={item.title}
    >
      <View style={styles.cardPosterWrap}>
        <Image
          source={{ uri: item.posterUrl }}
          style={styles.cardPoster}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />

        {/* Soft bottom vignette on poster */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          locations={[0.6, 1]}
          style={styles.cardGradient}
        />

        {/* Rating Badge */}
        {item.rating ? (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={10} color="#F5C518" />
            <ThemedText style={styles.ratingText}>{item.rating}</ThemedText>
          </View>
        ) : null}

        {/* Type Badge */}
        <View
          style={[
            styles.typeBadge,
            { backgroundColor: item.type === 'movie' ? '#E50914' : '#2563EB' },
          ]}
        >
          <ThemedText style={styles.typeBadgeText}>
            {item.type === 'movie' ? 'Film' : 'Dizi'}
          </ThemedText>
        </View>
      </View>

      {/* Info below poster */}
      <View style={styles.cardInfo}>
        <ThemedText numberOfLines={1} style={styles.cardTitle}>
          {item.title}
        </ThemedText>
        <ThemedText numberOfLines={1} style={styles.cardMeta}>
          {item.year ? item.year : ''}
          {item.year && item.character ? ' • ' : ''}
          {item.character ? item.character : ''}
        </ThemedText>
      </View>
    </TVFocusable>
  );

  // List Header Component
  const ListHeader = () => (
    <View style={styles.headerContainer}>
      {/* Ambient background blur glow */}
      {profileImage ? (
        <View style={styles.ambientGlowWrap} pointerEvents="none">
          <Image
            source={{ uri: profileImage }}
            style={styles.ambientGlowImage}
            contentFit="cover"
            blurRadius={isTV ? 40 : 35}
          />
          <LinearGradient
            colors={['rgba(9,9,11,0.4)', 'rgba(9,9,11,0.88)', '#09090b']}
            locations={[0, 0.65, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}

      {/* Hero Profile Block */}
      {isTV ? (
        // TV Hero: Split Layout
        <View style={styles.tvHero}>
          <View style={styles.tvHeroLeft}>
            <View style={styles.badgeRow}>
              <View style={styles.eyebrowBadge}>
                <ThemedText style={styles.eyebrowText}>OYUNCU</ThemedText>
              </View>
              {department ? (
                <View style={styles.metaChip}>
                  <ThemedText style={styles.metaChipText}>{department}</ThemedText>
                </View>
              ) : null}
            </View>

            <ThemedText numberOfLines={2} style={styles.tvName}>
              {actor.name}
            </ThemedText>

            {/* TV Meta details */}
            <View style={styles.tvMetaRow}>
              {birthAndAge ? (
                <View style={styles.tvMetaItem}>
                  <Ionicons name="calendar-outline" size={14} color="#999" />
                  <ThemedText style={styles.tvMetaText}>{birthAndAge}</ThemedText>
                </View>
              ) : null}
              {personInfo?.place_of_birth ? (
                <View style={styles.tvMetaItem}>
                  <Ionicons name="location-outline" size={14} color="#999" />
                  <ThemedText style={styles.tvMetaText}>
                    {personInfo.place_of_birth}
                  </ThemedText>
                </View>
              ) : null}
            </View>

            {/* Stats Row */}
            <View style={styles.statsContainer}>
              <View style={styles.statBox}>
                <ThemedText style={styles.statValue}>{items.length}</ThemedText>
                <ThemedText style={styles.statLabel}>Toplam Yapım</ThemedText>
              </View>
              <View style={styles.statSeparator} />
              <View style={styles.statBox}>
                <ThemedText style={styles.statValue}>{movieCount}</ThemedText>
                <ThemedText style={styles.statLabel}>Film</ThemedText>
              </View>
              <View style={styles.statSeparator} />
              <View style={styles.statBox}>
                <ThemedText style={styles.statValue}>{tvCount}</ThemedText>
                <ThemedText style={styles.statLabel}>Dizi</ThemedText>
              </View>
            </View>

            {/* Biography */}
            {personInfo?.biography ? (
              <ThemedText numberOfLines={4} style={styles.tvBiography}>
                {personInfo.biography}
              </ThemedText>
            ) : null}
          </View>

          {/* TV Hero Right: High-Res Portrait Frame */}
          <View style={styles.tvHeroRight}>
            <View style={styles.tvPortraitWrap}>
              {profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  style={styles.tvPortraitImage}
                  contentFit="cover"
                  transition={250}
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={styles.portraitPlaceholder}>
                  <Ionicons name="person" size={80} color="#444" />
                </View>
              )}
            </View>
          </View>
        </View>
      ) : (
        // Mobile / Tablet Hero: Modern Glass Card
        <View style={styles.mobileHero}>
          <View style={styles.mobileProfileRow}>
            {/* Portrait Frame */}
            <View style={styles.mobilePortraitWrap}>
              {profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  style={styles.mobilePortraitImage}
                  contentFit="cover"
                  transition={250}
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={styles.portraitPlaceholder}>
                  <Ionicons name="person" size={44} color="#555" />
                </View>
              )}
            </View>

            {/* Identity Info */}
            <View style={styles.mobileIdentity}>
              <View style={styles.badgeRow}>
                <View style={styles.eyebrowBadge}>
                  <ThemedText style={styles.eyebrowText}>OYUNCU</ThemedText>
                </View>
                {department ? (
                  <View style={styles.metaChip}>
                    <ThemedText style={styles.metaChipText}>{department}</ThemedText>
                  </View>
                ) : null}
              </View>

              <ThemedText numberOfLines={2} style={styles.mobileName}>
                {actor.name}
              </ThemedText>

              {birthAndAge ? (
                <View style={styles.mobileMetaRow}>
                  <Ionicons name="calendar-outline" size={12} color="#888" />
                  <ThemedText numberOfLines={1} style={styles.mobileMetaText}>
                    {birthAndAge}
                  </ThemedText>
                </View>
              ) : null}

              {personInfo?.place_of_birth ? (
                <View style={styles.mobileMetaRow}>
                  <Ionicons name="location-outline" size={12} color="#888" />
                  <ThemedText numberOfLines={1} style={styles.mobileMetaText}>
                    {personInfo.place_of_birth}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>

          {/* Stats Bar */}
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <ThemedText style={styles.statValue}>{items.length}</ThemedText>
              <ThemedText style={styles.statLabel}>Yapım</ThemedText>
            </View>
            <View style={styles.statSeparator} />
            <View style={styles.statBox}>
              <ThemedText style={styles.statValue}>{movieCount}</ThemedText>
              <ThemedText style={styles.statLabel}>Film</ThemedText>
            </View>
            <View style={styles.statSeparator} />
            <View style={styles.statBox}>
              <ThemedText style={styles.statValue}>{tvCount}</ThemedText>
              <ThemedText style={styles.statLabel}>Dizi</ThemedText>
            </View>
          </View>

          {/* Mobile Biography Accordion */}
          {personInfo?.biography ? (
            <View style={styles.bioContainer}>
              <ThemedText style={styles.bioTitle}>Hakkında</ThemedText>
              <ThemedText
                numberOfLines={bioExpanded ? undefined : 3}
                style={styles.bioText}
              >
                {personInfo.biography}
              </ThemedText>
              <TouchableOpacity
                onPress={() => setBioExpanded(!bioExpanded)}
                activeOpacity={0.7}
                style={styles.bioToggleBtn}
              >
                <ThemedText style={styles.bioToggleText}>
                  {bioExpanded ? 'Daha Az Göster' : 'Devamını Oku'}
                </ThemedText>
                <Ionicons
                  name={bioExpanded ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color="#E50914"
                />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      )}

      {/* Filter Tabs Bar (Tümü / Filmler / Diziler) */}
      <View style={styles.filterSection}>
        <View style={styles.sectionHeaderRow}>
          <ThemedText style={styles.sectionTitle}>Filmografi</ThemedText>
          <ThemedText style={styles.sectionCount}>
            {filteredItems.length} Yapım
          </ThemedText>
        </View>

        <View style={styles.tabsRow}>
          <TVFocusable
            onPress={() => setFilter('all')}
            style={[styles.tabButton, filter === 'all' && styles.tabButtonActive]}
            focusedStyle={styles.tabFocused}
          >
            <ThemedText
              style={[styles.tabText, filter === 'all' && styles.tabTextActive]}
            >
              Tümü ({items.length})
            </ThemedText>
          </TVFocusable>

          <TVFocusable
            onPress={() => setFilter('movie')}
            style={[styles.tabButton, filter === 'movie' && styles.tabButtonActive]}
            focusedStyle={styles.tabFocused}
          >
            <ThemedText
              style={[styles.tabText, filter === 'movie' && styles.tabTextActive]}
            >
              Filmler ({movieCount})
            </ThemedText>
          </TVFocusable>

          <TVFocusable
            onPress={() => setFilter('tv')}
            style={[styles.tabButton, filter === 'tv' && styles.tabButtonActive]}
            focusedStyle={styles.tabFocused}
          >
            <ThemedText
              style={[styles.tabText, filter === 'tv' && styles.tabTextActive]}
            >
              Diziler ({tvCount})
            </ThemedText>
          </TVFocusable>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Floating Back Button */}
      <View style={[styles.backButtonWrap, { top: insets.top + (isTV ? 20 : 12) }]}>
        <TVFocusable
          ref={backBtnRef}
          onPress={onClose}
          hasTVPreferredFocus={isTV}
          accessibilityLabel="Geri Dön"
          style={styles.backButton}
          focusedStyle={styles.backButtonFocused}
        >
          <Ionicons name="arrow-back" size={isTV ? 24 : 20} color="#FFFFFF" />
        </TVFocusable>
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ListHeader />
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#E50914" />
            <ThemedText style={styles.loadingText}>Filmografi yükleniyor...</ThemedText>
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          numColumns={numColumns}
          key={`actor-grid-${numColumns}`}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={[
            styles.listContent,
            { paddingHorizontal: gridPadding },
          ]}
          columnWrapperStyle={numColumns > 1 ? { gap: cardGap } : undefined}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={!isTV && Platform.OS === 'android'}
          initialNumToRender={isTV ? 10 : 12}
          maxToRenderPerBatch={isTV ? 5 : 10}
          windowSize={5}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="film-outline" size={36} color="#666" />
              </View>
              <ThemedText style={styles.emptyTitle}>Yapım Bulunamadı</ThemedText>
              <ThemedText style={styles.emptyText}>
                Seçili filtreye uygun yapım kaydı bulunamadı.
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
    backgroundColor: '#09090b',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },

  // Floating Back Button
  backButtonWrap: {
    position: 'absolute',
    left: isTV ? 40 : 16,
    zIndex: 100,
  },
  backButton: {
    width: isTV ? 46 : 38,
    height: isTV ? 46 : 38,
    borderRadius: isTV ? 14 : 12,
    backgroundColor: 'rgba(20,20,24,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonFocused: {
    backgroundColor: '#E50914',
    borderColor: '#FF3B30',
    transform: [{ scale: 1.08 }],
  },

  // Ambient Glow
  ambientGlowWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: isTV ? 420 : 320,
    overflow: 'hidden',
  },
  ambientGlowImage: {
    width: '100%',
    height: '100%',
    opacity: 0.28,
  },

  // Header Root
  headerContainer: {
    paddingTop: isTV ? 75 : 60,
    marginBottom: 12,
  },

  // TV Hero (Split)
  tvHero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingTop: 10,
    paddingBottom: 20,
  },
  tvHeroLeft: {
    flex: 1,
    paddingRight: 32,
    justifyContent: 'center',
  },
  tvHeroRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tvPortraitWrap: {
    width: 200,
    height: 300,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#18181b',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 10,
  },
  tvPortraitImage: {
    width: '100%',
    height: '100%',
  },
  tvName: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 46,
    marginTop: 6,
    marginBottom: 8,
  },
  tvMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  tvMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tvMetaText: {
    color: '#999',
    fontSize: 13,
    fontWeight: '500',
  },
  tvBiography: {
    color: '#A1A1AA',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 16,
    maxWidth: 680,
  },

  // Mobile Hero
  mobileHero: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  mobileProfileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  mobilePortraitWrap: {
    width: 105,
    height: 155,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#18181b',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  mobilePortraitImage: {
    width: '100%',
    height: '100%',
  },
  portraitPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileIdentity: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  eyebrowBadge: {
    backgroundColor: 'rgba(229,9,20,0.18)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.3)',
  },
  eyebrowText: {
    color: '#E50914',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  metaChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  metaChipText: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '600',
  },
  mobileName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 27,
    marginBottom: 6,
  },
  mobileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  mobileMetaText: {
    color: '#888',
    fontSize: 11,
    fontWeight: '500',
  },

  // Stats Box
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24,24,27,0.7)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 14,
    maxWidth: isTV ? 480 : '100%',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  statSeparator: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Biography (Mobile)
  bioContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  bioTitle: {
    color: '#D4D4D8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  bioText: {
    color: '#A1A1AA',
    fontSize: 12,
    lineHeight: 18,
  },
  bioToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  bioToggleText: {
    color: '#E50914',
    fontSize: 11,
    fontWeight: '700',
  },

  // Filter Section
  filterSection: {
    paddingHorizontal: isTV ? 40 : 16,
    marginTop: 18,
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: isTV ? 22 : 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sectionCount: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tabButtonActive: {
    backgroundColor: '#E50914',
    borderColor: '#E50914',
  },
  tabFocused: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
    transform: [{ scale: 1.05 }],
  },
  tabText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Grid & Cards
  listContent: {
    paddingBottom: 60,
  },
  cardContainer: {
    borderRadius: isTV ? 12 : 9,
  },
  cardFocused: {
    transform: [{ scale: 1.06 }],
    borderColor: '#E50914',
    borderWidth: 2,
    zIndex: 10,
  },
  cardPosterWrap: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: isTV ? 12 : 9,
    overflow: 'hidden',
    backgroundColor: '#18181b',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardPoster: {
    width: '100%',
    height: '100%',
  },
  cardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  ratingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 5,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  ratingText: {
    color: '#F5C518',
    fontSize: 9,
    fontWeight: '900',
  },
  typeBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  cardInfo: {
    paddingTop: 6,
    paddingHorizontal: 1,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: isTV ? 13 : 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  cardMeta: {
    color: '#71717A',
    fontSize: isTV ? 11 : 9.5,
    fontWeight: '500',
    marginTop: 2,
  },

  // Loading & Empty
  loadingContainer: {
    flex: 1,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    color: '#71717A',
    fontSize: 13,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14,
  },
  emptyText: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 4,
  },
});
