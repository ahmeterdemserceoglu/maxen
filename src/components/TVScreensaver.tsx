import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  BackHandler,
  Pressable,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { TMDB_BASE_URL, TMDB_IMAGE_BASE_URL } from '@/config/tmdb';

export interface TVScreensaverProps {
  visible: boolean;
  onDismiss: () => void;
}

interface ScreensaverItem {
  id: string | number;
  title: string;
  backdropUrl: string;
  year?: string;
  rating?: string;
  overview?: string;
}

const FALLBACK_BACKDROPS: ScreensaverItem[] = [
  {
    id: 1,
    title: 'Interstellar',
    backdropUrl: 'https://image.tmdb.org/t/p/w1280/rAiYTsqzbmuQ0zMa7gB4aG2i3uC.jpg',
    year: '2014',
    rating: '8.7',
    overview: 'İnsanlığın geleceği için yıldızlararası bir yolculuğa çıkan kaşiflerin hikayesi.',
  },
  {
    id: 2,
    title: 'Dune: Çöl Gezegeni',
    backdropUrl: 'https://image.tmdb.org/t/p/w1280/x2LSRK2Cm7MZhjluni1msVJ3wDF.jpg',
    year: '2024',
    rating: '8.5',
    overview: 'Paul Atreides, ailesini ve halkını korumak için evrenin en tehlikeli gezegenine adım atar.',
  },
  {
    id: 3,
    title: 'Oppenheimer',
    backdropUrl: 'https://image.tmdb.org/t/p/w1280/fm6K9vY90vpuF55q0599Y8TqpqK.jpg',
    year: '2023',
    rating: '8.9',
    overview: 'Dünyayı sonsuza dek değiştirecek nükleer çağın doğuşu.',
  },
];

export function TVScreensaver({ visible, onDismiss }: TVScreensaverProps) {
  const { width, height } = useWindowDimensions();
  const [items, setItems] = useState<ScreensaverItem[]>(FALLBACK_BACKDROPS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const hintPulse = useRef(new Animated.Value(0.4)).current;

  // Saat ve Tarih formatlama
  const updateClock = useCallback(() => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setCurrentTimeStr(`${hours}:${minutes}`);

    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const months = [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];
    const dayName = days[now.getDay()];
    const monthName = months[now.getMonth()];
    setCurrentDateStr(`${now.getDate()} ${monthName}, ${dayName}`);
  }, []);

  // TMDB Popüler / Trend arka planları çek
  useEffect(() => {
    if (!visible) return;
    let isMounted = true;

    fetch(`${TMDB_BASE_URL}/trending/all/week?language=tr-TR`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted || !Array.isArray(data?.results)) return;
        const mapped: ScreensaverItem[] = data.results
          .filter((item: any) => Boolean(item.backdrop_path))
          .slice(0, 15)
          .map((item: any) => ({
            id: item.id,
            title: item.title || item.name || 'Maxen',
            backdropUrl: `${TMDB_IMAGE_BASE_URL}/w1280${item.backdrop_path}`,
            year: (item.release_date || item.first_air_date || '').split('-')[0] || '',
            rating: item.vote_average ? item.vote_average.toFixed(1) : undefined,
            overview: item.overview || '',
          }));

        if (mapped.length > 0) {
          setItems(mapped);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [visible]);

  // Saat güncelleyici (her 10 sn)
  useEffect(() => {
    if (!visible) return;
    updateClock();
    const timer = setInterval(updateClock, 10000);
    return () => clearInterval(timer);
  }, [visible, updateClock]);

  // İpucu yanıp sönme animasyonu (Pulse)
  useEffect(() => {
    if (!visible) return;
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(hintPulse, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(hintPulse, {
          toValue: 0.35,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [visible, hintPulse]);

  // Ken-Burns Zoom animasyonu & Slayt geçişi (her 12 sn)
  useEffect(() => {
    if (!visible || items.length === 0) return;

    // Zoom animasyonu (1.0 -> 1.10)
    scaleAnim.setValue(1);
    const zoomAnim = Animated.timing(scaleAnim, {
      toValue: 1.1,
      duration: 12000,
      useNativeDriver: true,
    });
    zoomAnim.start();

    // 11.2 saniyede fade out, sonra yeni resim ve fade in
    const slideTimer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex((prev) => (prev + 1) % items.length);
        scaleAnim.setValue(1);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }).start();
      });
    }, 11200);

    return () => {
      clearTimeout(slideTimer);
      zoomAnim.stop();
    };
  }, [visible, currentIndex, items.length, fadeAnim, scaleAnim]);

  // Back tuşuna basıldığında ekran koruyucuyu kapat
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss();
      return true;
    });
    return () => sub.remove();
  }, [visible, onDismiss]);

  if (!visible) return null;

  const currentItem = items[currentIndex] || items[0];

  return (
    <Pressable
      style={styles.fullScreenOverlay}
      onPress={onDismiss}
      focusable={true}
      hasTVPreferredFocus={true}
    >
      {/* 1. Ken-Burns Zooming 4K Backdrop */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={{ uri: currentItem.backdropUrl }}
          style={{ width, height }}
          contentFit="cover"
          transition={500}
          cachePolicy="memory-disk"
        />
      </Animated.View>

      {/* 2. Sinematik Karartma Gradyanları (OLED koruması & okunabilirlik) */}
      <LinearGradient
        colors={['rgba(0,0,0,0.75)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* 3. Üst Sağ: Büyük Saat & Tarih */}
      <View style={styles.topRightClock}>
        <ThemedText style={styles.clockText}>{currentTimeStr}</ThemedText>
        <ThemedText style={styles.dateText}>{currentDateStr}</ThemedText>
      </View>

      {/* 4. Alt Sol: Film Bilgisi & Meta Bilgiler */}
      <View style={styles.bottomLeftInfo}>
        <ThemedText numberOfLines={1} style={styles.movieTitle}>
          {currentItem.title}
        </ThemedText>

        <View style={styles.metaRow}>
          {currentItem.rating && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={13} color="#F5C518" style={{ marginRight: 4 }} />
              <ThemedText style={styles.ratingText}>{currentItem.rating}</ThemedText>
            </View>
          )}
          {currentItem.year ? (
            <ThemedText style={styles.metaYear}>{currentItem.year}</ThemedText>
          ) : null}
          <ThemedText style={styles.metaCategory}>Sinema & Dizi</ThemedText>
        </View>

        {currentItem.overview ? (
          <ThemedText numberOfLines={2} style={styles.overviewText}>
            {currentItem.overview}
          </ThemedText>
        ) : null}
      </View>

      {/* 6. Alt Sağ: Uyanma İpucu (Pulse Animasyonu) */}
      <Animated.View style={[styles.bottomRightHint, { opacity: hintPulse }]}>
        <Ionicons name="radio-button-on" size={12} color="#E50914" style={{ marginRight: 6 }} />
        <ThemedText style={styles.hintText}>Uyanmak için kumandaya basın</ThemedText>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullScreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999999,
    elevation: 999999,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
    paddingHorizontal: 54,
    paddingTop: 36,
    paddingBottom: 44,
  },
  topRightClock: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    paddingTop: 12,
  },
  clockText: {
    fontSize: 68,
    lineHeight: 78,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    includeFontPadding: false,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 16,
  },
  dateText: {
    fontSize: 18,
    lineHeight: 26,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
    marginTop: 4,
    includeFontPadding: false,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  bottomLeftInfo: {
    maxWidth: '65%',
    marginBottom: 8,
  },
  movieTitle: {
    fontSize: 40,
    lineHeight: 52,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: 0.5,
    includeFontPadding: false,
    paddingVertical: 4,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 197, 24, 0.3)',
  },
  ratingText: {
    color: '#F5C518',
    fontSize: 13,
    fontWeight: '800',
  },
  metaYear: {
    color: '#E5E5E5',
    fontSize: 14,
    fontWeight: '600',
  },
  metaCategory: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '500',
  },
  overviewText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  bottomRightHint: {
    position: 'absolute',
    bottom: 48,
    right: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  hintText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
  },
});
