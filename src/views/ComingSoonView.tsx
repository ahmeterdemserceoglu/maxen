import { TVTouchable } from '@/components/TVTouchable';
import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Platform,
  StatusBar,
  useWindowDimensions,
  Alert,
  BackHandler,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TMDB_BASE_URL, TMDB_IMAGE_BASE_URL } from '@/config/tmdb';
import { TVFocusable } from '@/components/TVFocusable';
import { TrailerModal } from './detail/TrailerModal';

export interface ComingSoonItem {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
}

export interface ComingSoonViewProps {
  onClose?: () => void;
  onSelectMedia?: (media: any) => void;
}

const STORAGE_KEY_REMINDERS = 'maxen_reminded_releases';

type FilterType = 'all' | 'reminded';

export function ComingSoonView({ onClose, onSelectMedia }: ComingSoonViewProps) {
  const { width } = useWindowDimensions();
  const isTV = Platform.isTV;

  const [items, setItems] = useState<ComingSoonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<number[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const [trailerVisible, setTrailerVisible] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [trailerTitle, setTrailerTitle] = useState<string>('');
  const [loadingTrailerId, setLoadingTrailerId] = useState<number | null>(null);

  useEffect(() => {
    if (!onClose || trailerVisible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [onClose, trailerVisible]);

  const handleWatchTrailer = async (movie: ComingSoonItem) => {
    try {
      setLoadingTrailerId(movie.id);
      let foundKey: string | null = null;
      // 1. Türkçe fragman dene
      const trRes = await fetch(`${TMDB_BASE_URL}/movie/${movie.id}/videos?language=tr-TR`);
      if (trRes.ok) {
        const data = await trRes.json();
        const trTrailer = (data.results || []).find((v: any) => v.site === 'YouTube' && v.type === 'Trailer') ||
          (data.results || []).find((v: any) => v.site === 'YouTube');
        if (trTrailer?.key) foundKey = trTrailer.key;
      }
      // 2. İngilizce fragman fallback
      if (!foundKey) {
        const enRes = await fetch(`${TMDB_BASE_URL}/movie/${movie.id}/videos?language=en-US`);
        if (enRes.ok) {
          const data = await enRes.json();
          const enTrailer = (data.results || []).find((v: any) => v.site === 'YouTube' && v.type === 'Trailer') ||
            (data.results || []).find((v: any) => v.site === 'YouTube');
          if (enTrailer?.key) foundKey = enTrailer.key;
        }
      }

      if (foundKey) {
        setTrailerKey(foundKey);
        setTrailerTitle(movie.title);
        setTrailerVisible(true);
      } else {
        Alert.alert('Fragman Bulunamadı', `"${movie.title}" için henüz resmi bir YouTube fragmanı bulunamadı.`);
      }
    } catch (e) {
      Alert.alert('Hata', 'Fragman bilgisi alınırken bir hata oluştu.');
    } finally {
      setLoadingTrailerId(null);
    }
  };

  useEffect(() => {
    loadData();
    loadReminders();
  }, []);

  const loadReminders = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_REMINDERS);
      if (stored) {
        setReminders(JSON.parse(stored));
      }
    } catch (e) { }
  };

  const toggleReminder = async (movie: ComingSoonItem) => {
    try {
      let updated: number[];
      if (reminders.includes(movie.id)) {
        updated = reminders.filter((item) => item !== movie.id);
        Alert.alert('Hatırlatıcı Kaldırıldı', `"${movie.title}" için vizyon hatırlatıcısı kapatıldı.`);
      } else {
        updated = [...reminders, movie.id];
        Alert.alert(
          '🔔 Hatırlatıcı Kuruldu!',
          `"${movie.title}" vizyona girdiğinde bildirim alacaksınız.\nVizyon Tarihi: ${movie.release_date || 'Yakında'}`
        );
      }
      setReminders(updated);
      await AsyncStorage.setItem(STORAGE_KEY_REMINDERS, JSON.stringify(updated));
    } catch (e) { }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${TMDB_BASE_URL}/movie/upcoming?language=tr-TR&page=1`);
      if (res.ok) {
        const data = await res.json();
        const validList = (data.results || []).filter((m: any) => !!m.poster_path);
        setItems(validList);
      }
    } catch (err) {
      console.warn('Upcoming fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateDaysLeft = (dateStr: string) => {
    if (!dateStr) return null;
    const release = new Date(dateStr).getTime();
    const now = new Date().getTime();
    const diffDays = Math.ceil((release - now) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) return `${diffDays} Gün Kaldı`;
    if (diffDays === 0) return 'Bugün Vizyonda!';
    return 'Vizyonda';
  };

  const filteredItems = useMemo(() => {
    if (activeFilter === 'reminded') {
      return items.filter((item) => reminders.includes(item.id));
    }
    return items;
  }, [items, reminders, activeFilter]);

  const renderCard = ({ item }: { item: ComingSoonItem }) => {
    const daysLeft = calculateDaysLeft(item.release_date);
    const isReminded = reminders.includes(item.id);

    const imagePath = item.backdrop_path || item.poster_path;
    const imageUri = imagePath ? `${TMDB_IMAGE_BASE_URL}/w300${imagePath}` : null;

    return (
      <View style={[styles.cardContainer, isTV && { width: (width - 96) / 2, marginHorizontal: 12 }]}>
        <View style={styles.card}>
          {/* Tıklanabilir Afiş ve Bilgi Alanı */}
          <TVTouchable
            activeOpacity={0.88}
            onPress={() => onSelectMedia?.({ ...item, type: 'movie' })}
            style={{ width: '100%' }}
          >
            {/* Afiş / Görsel */}
            <View style={styles.posterWrapper}>
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
                  style={styles.posterImage}
                  contentFit="cover"
                  transition={isTV ? 0 : 200}
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={[styles.posterImage, styles.posterFallback]}>
                  <Ionicons name="film-outline" size={38} color="#555" />
                </View>
              )}
              <LinearGradient
                colors={['transparent', 'rgba(15, 15, 18, 0.95)']}
                style={styles.posterGradient}
              />

              {/* Tarih & Geri Sayım Rozetleri */}
              <View style={styles.topBadgesRow}>
                <View style={styles.dateBadge}>
                  <Ionicons name="calendar-outline" size={12} color="#fff" />
                  <Text style={styles.dateBadgeText}>{item.release_date || 'Yakında'}</Text>
                </View>
                {item.vote_average > 0 && (
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={11} color="#FFD700" />
                    <Text style={styles.ratingBadgeText}>{item.vote_average.toFixed(1)}</Text>
                  </View>
                )}
              </View>

              {daysLeft && (
                <View style={[styles.daysBadge, daysLeft.includes('Bugün') && styles.daysBadgeToday]}>
                  <Ionicons name="time" size={12} color="#fff" />
                  <Text style={styles.daysBadgeText}>{daysLeft}</Text>
                </View>
              )}
            </View>

            {/* Bilgi Alanı */}
            <View style={[styles.infoArea, { paddingBottom: 6 }]}>
              <Text style={styles.movieTitle} numberOfLines={1}>
                {item.title}
              </Text>

              <Text style={styles.overview} numberOfLines={3}>
                {item.overview || 'Bu yapım hakkında konu ve özet bilgisi yakında eklenecektir.'}
              </Text>
            </View>
          </TVTouchable>

          {/* Butonlar */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <View style={styles.actionsRow}>
              {/* Fragman Butonu */}
              <TVFocusable
                style={styles.trailerBtn}
                focusedStyle={styles.trailerBtnFocused}
                onPress={() => handleWatchTrailer(item)}
              >
                {loadingTrailerId === item.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="play" size={14} color="#fff" />
                    <Text style={styles.trailerBtnText}>Fragman</Text>
                  </>
                )}
              </TVFocusable>

              {/* Hatırlatıcı Butonu */}
              <TVFocusable
                style={[styles.remindBtn, isReminded && styles.remindBtnActive]}
                focusedStyle={styles.remindBtnFocused}
                onPress={() => toggleReminder(item)}
              >
                <Ionicons
                  name={isReminded ? 'notifications' : 'notifications-outline'}
                  size={15}
                  color={isReminded ? '#fff' : '#ccc'}
                />
                <Text style={[styles.remindBtnText, isReminded && styles.remindBtnTextActive]}>
                  {isReminded ? 'Hatırlatılıyor' : 'Bana Hatırlat'}
                </Text>
              </TVFocusable>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Modern Material 3 Header Bar */}
      <View style={styles.headerBar}>
        <LinearGradient
          colors={['rgba(229, 9, 20, 0.15)', 'rgba(15, 15, 20, 0.95)', 'rgba(9, 9, 12, 0.98)']}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            {onClose && (
              <TVFocusable style={styles.backBtn} focusedStyle={styles.backBtnFocused} onPress={onClose}>
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TVFocusable>
            )}
            <View>

              <Text style={styles.headerTitle}>Vizyon Takvimi</Text>
            </View>
          </View>
        </View>

        {/* Filtre Sekmeleri */}
        <View style={styles.filterRow}>
          <TVFocusable
            style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]}
            focusedStyle={styles.filterChipFocused}
            onPress={() => setActiveFilter('all')}
          >
            <Ionicons name="film" size={14} color={activeFilter === 'all' ? '#fff' : '#888'} />
            <Text style={[styles.filterChipText, activeFilter === 'all' && styles.filterChipTextActive]}>
              Tüm Yapımlar ({items.length})
            </Text>
          </TVFocusable>

          <TVFocusable
            style={[styles.filterChip, activeFilter === 'reminded' && styles.filterChipActive]}
            focusedStyle={styles.filterChipFocused}
            onPress={() => setActiveFilter('reminded')}
          >
            <Ionicons
              name={activeFilter === 'reminded' ? 'notifications' : 'notifications-outline'}
              size={14}
              color={activeFilter === 'reminded' ? '#fff' : '#888'}
            />
            <Text style={[styles.filterChipText, activeFilter === 'reminded' && styles.filterChipTextActive]}>
              Hatırlatılanlar ({reminders.length})
            </Text>
          </TVFocusable>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color="#E50914" />
          <Text style={styles.loadingText}>Vizyon Takvimi Yükleniyor...</Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name={activeFilter === 'reminded' ? 'notifications-off-outline' : 'film-outline'}
            size={48}
            color="#555"
          />
          <Text style={styles.emptyTitle}>
            {activeFilter === 'reminded' ? 'Henüz Hatırlatıcı Kurmadınız' : 'İçerik Bulunamadı'}
          </Text>
          <Text style={styles.emptyDesc}>
            {activeFilter === 'reminded'
              ? 'Filmlerin yanındaki "Bana Hatırlat" butonuna basarak vizyon bildirimleri ekleyebilirsiniz.'
              : 'Vizyon listesi şu an güncelleniyor.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          numColumns={isTV ? 2 : 1}
          key={isTV ? 'tv-grid' : 'mobile-list'}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={!isTV && Platform.OS === 'android'}
          initialNumToRender={isTV ? 4 : 5}
          maxToRenderPerBatch={isTV ? 2 : 4}
          windowSize={isTV ? 3 : 5}
        />
      )}

      {/* Fragman Oynatıcı Modalı */}
      <TrailerModal
        visible={trailerVisible}
        youtubeKey={trailerKey}
        title={trailerTitle}
        onClose={() => {
          setTrailerVisible(false);
          setTrailerKey(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#09090C',
    zIndex: 99999,
    elevation: 100,
  },
  headerBar: {
    paddingTop: Platform.OS === 'ios' ? 48 : 28,
    paddingBottom: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  backBtnFocused: {
    backgroundColor: '#E50914',
    borderColor: '#fff',
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  eyebrow: {
    color: '#E50914',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: '#E50914',
    borderColor: '#E50914',
  },
  filterChipFocused: {
    borderColor: '#fff',
  },
  filterChipText: {
    color: '#8E8E93',
    fontSize: Platform.isTV ? 15 : 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  centerLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#888',
    fontSize: Platform.isTV ? 16 : 13,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    gap: 8,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 8,
  },
  emptyDesc: {
    color: '#777',
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 300,
  },
  listContent: {
    padding: 16,
    paddingBottom: 110,
    gap: 18,
  },
  cardContainer: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#141418',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  card: {
    flexDirection: 'column',
  },
  posterWrapper: {
    width: '100%',
    height: 190,
    backgroundColor: '#1A1A20',
    position: 'relative',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  posterFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A20',
  },
  posterGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  topBadgesRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  dateBadgeText: {
    color: '#fff',
    fontSize: 11.5,
    fontWeight: '800',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  ratingBadgeText: {
    color: '#fff',
    fontSize: 11.5,
    fontWeight: '800',
  },
  daysBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E50914',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  daysBadgeToday: {
    backgroundColor: '#10B981',
  },
  daysBadgeText: {
    color: '#fff',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  infoArea: {
    padding: 16,
  },
  movieTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  overview: {
    color: '#9E9EA7',
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trailerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  trailerBtnFocused: {
    backgroundColor: '#E50914',
  },
  trailerBtnText: {
    color: '#FFFFFF',
    fontSize: Platform.isTV ? 16 : 13,
    fontWeight: '800',
  },
  remindBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  remindBtnActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  remindBtnFocused: {
    borderColor: '#fff',
  },
  remindBtnText: {
    color: '#B0B0B8',
    fontSize: Platform.isTV ? 16 : 13,
    fontWeight: '700',
  },
  remindBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
});
