import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  findNodeHandle,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';
import { useUiStore } from '@/store/uiStore';
import { NormalizedMediaItem } from './useHomeData';

const isTV = Platform.isTV;

export interface HeroBannerProps {
  heroMedia: NormalizedMediaItem | null;
  heroPool: NormalizedMediaItem[];
  heroIndex?: number;
  onSelectIndex?: (index: number) => void;
  onPressPlay: (media: NormalizedMediaItem) => void;
  onPressInfo: (media: NormalizedMediaItem) => void;
  onFocus?: () => void;
  playBtnRef?: React.RefObject<any>;
}

export const HeroBanner: React.FC<HeroBannerProps> = React.memo(({
  heroMedia,
  heroPool,
  heroIndex: controlledHeroIndex,
  onSelectIndex,
  onPressPlay,
  onPressInfo,
  onFocus,
  playBtnRef,
}) => {
  const { width, height } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 768;
  const [internalIndex, setInternalIndex] = React.useState(0);
  const infoBtnRef = React.useRef<any>(null);

  const sidebarActiveNodeId = useUiStore((state) => state.sidebarActiveNodeId);
  const setHeroPlayBtnNodeId = useUiStore((state) => state.setHeroPlayBtnNodeId);

  // Expose Play Button node handle for deterministic TV navigation from Sidebar
  React.useEffect(() => {
    if (playBtnRef?.current) {
      try {
        const id = findNodeHandle(playBtnRef.current);
        if (id) {
          setHeroPlayBtnNodeId(id);
        }
      } catch (e) {}
    }
  }, [playBtnRef, setHeroPlayBtnNodeId]);

  // Isolate hero auto-rotation timer inside HeroBanner (15s on TV to prevent GPU/RAM stalls)
  React.useEffect(() => {
    if (heroPool.length <= 1) return;
    const intervalMs = isTV ? 15000 : 7500;
    const timer = setInterval(() => {
      setInternalIndex((prev) => (prev + 1) % heroPool.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [heroPool.length]);

  const activeIndex =
    controlledHeroIndex !== undefined
      ? controlledHeroIndex
      : internalIndex < heroPool.length
      ? internalIndex
      : 0;

  const handleSelectIndex = (idx: number) => {
    setInternalIndex(idx);
    onSelectIndex?.(idx);
  };

  const hero = (heroPool.length > 0 ? heroPool[activeIndex] : null) || heroMedia;
  const heroUri = hero?.backdropUrl || hero?.posterUrl || null;


  if (!hero) return null;

  const bannerHeight = isDesktopWeb
    ? Math.min(height * 0.85, 780)
    : isTV
    ? height * 0.72
    : Math.round(height * 0.54);

  return (
    <View
      style={[
        styles.heroContainer,
        {
          width: '100%',
          height: bannerHeight,
          overflow: 'hidden',
          marginBottom: 0,
        },
      ]}
    >
      {heroUri ? (
        <Image
          source={{ uri: heroUri }}
          style={styles.heroImage}
          contentFit="cover"
          transition={isTV ? 200 : 400}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={styles.heroImagePlaceholder}>
          <Ionicons name="film-outline" size={isTV ? 72 : 48} color="#333333" />
        </View>
      )}

      {/* Gradients: Prime Video / Netflix style for TV and Desktop Web */}
      {isDesktopWeb || isTV ? (
        <>
          {/* Top Gradient */}
          <LinearGradient
            colors={['rgba(14,18,24,0.85)', 'rgba(14,18,24,0.3)', 'transparent']}
            locations={[0, 0.5, 1]}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: isTV ? 80 : 140 }}
            pointerEvents="none"
          />

          {/* Left Horizontal Vignette for Title & Meta Readability */}
          <LinearGradient
            colors={[
              'rgba(14,18,24,0.98)',
              'rgba(14,18,24,0.88)',
              'rgba(14,18,24,0.4)',
              'transparent',
            ]}
            locations={[0, 0.38, 0.68, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* Bottom Fade to dark background */}
          <LinearGradient
            colors={[
              'transparent',
              'rgba(14,18,24,0.25)',
              'rgba(14,18,24,0.7)',
              'rgba(14,18,24,0.95)',
              '#0e1218',
            ]}
            locations={[0, 0.45, 0.72, 0.9, 1]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
        </>
      ) : (
        <>
          {/* Mobil Üst Karartma (Header ve Status Bar okunabilirliği) */}
          <LinearGradient
            colors={['rgba(14, 18, 24, 0.8)', 'rgba(14, 18, 24, 0.25)', 'transparent']}
            locations={[0, 0.5, 1]}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 110 }}
            pointerEvents="none"
          />

          {/* Mobil Sinematik Ambiyans Işığı (Atmospheric Ambient Aura & Glow) */}
          <LinearGradient
            colors={[
              'transparent',
              'rgba(229, 9, 20, 0.10)',
              'rgba(255, 255, 255, 0.03)',
              'rgba(20, 20, 20, 0.45)',
              'transparent',
            ]}
            locations={[0, 0.42, 0.65, 0.85, 1]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* Mobil Kademeli Pürüzsüz Alt Eriyip Yok Olma Katmanı (Seamless Fade-out to #141414) */}
          <LinearGradient
            colors={[
              'transparent',
              'rgba(20, 20, 20, 0.0)',
              'rgba(20, 20, 20, 0.22)',
              'rgba(20, 20, 20, 0.60)',
              'rgba(20, 20, 20, 0.88)',
              '#141414',
              '#141414',
            ]}
            locations={[0, 0.18, 0.42, 0.65, 0.82, 0.93, 1.0]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* Alt Kenar Yumuşak Geçiş Kuşağı (Düz Çizgiyi Tamamen Eriten Tüy Geçiş) */}
          <LinearGradient
            colors={['transparent', 'rgba(20, 20, 20, 0.6)', '#141414', '#141414']}
            locations={[0, 0.35, 0.8, 1]}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 85,
            }}
            pointerEvents="none"
          />
        </>
      )}

      {/* Hero Content */}
      <View
        style={[
          styles.heroContent,
          isDesktopWeb && {
            bottom: 70,
            left: 48,
            paddingHorizontal: 0,
            maxWidth: 620,
          },
          isTV && {
            bottom: 34,
            left: 36,
            paddingHorizontal: 0,
            maxWidth: 580,
          },
        ]}
      >
        {/* Brand & Type Badge */}
        {isTV ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <View
              style={{
                backgroundColor: '#E50914',
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 3,
              }}
            >
              <ThemedText style={{ color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>
                MAXEN
              </ThemedText>
            </View>
            <ThemedText style={{ color: '#E50914', fontSize: 12, fontWeight: '800', letterSpacing: 2 }}>
              {hero.type === 'movie' ? 'FİLM' : 'DİZİ'}
            </ThemedText>
          </View>
        ) : isDesktopWeb ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <View
              style={{
                backgroundColor: '#E50914',
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 2,
              }}
            >
              <ThemedText style={{ color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>
                M
              </ThemedText>
            </View>
            <ThemedText style={{ color: '#E50914', fontSize: 13, fontWeight: '800', letterSpacing: 3 }}>
              {hero.type === 'movie' ? 'F İ L M' : 'D İ Z İ'}
            </ThemedText>
          </View>
        ) : (
          <ThemedText style={styles.heroCategoryText}>
            {hero.type === 'movie' ? 'FİLM' : 'DİZİ'}
          </ThemedText>
        )}

        <ThemedText
          numberOfLines={2}
          style={[
            styles.heroTitle,
            isDesktopWeb && {
              fontSize: 48,
              lineHeight: 56,
              fontWeight: '900',
              marginBottom: 14,
              letterSpacing: -0.5,
              textShadowColor: 'rgba(0,0,0,0.85)',
              textShadowOffset: { width: 0, height: 3 },
              textShadowRadius: 12,
            },
            isTV && {
              fontSize: 40,
              lineHeight: 48,
              fontWeight: '900',
              marginBottom: 10,
              letterSpacing: -0.3,
              textShadowColor: 'rgba(0,0,0,0.9)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 10,
            },
          ]}
        >
          {hero.title || hero.name || hero.show_title || hero.SeriesName || 'İçerik'}
        </ThemedText>

        {/* Metadata Badges */}
        <View style={styles.heroMeta}>
          {(isDesktopWeb || isTV) && (
            <ThemedText style={{ color: '#46d369', fontWeight: '800', fontSize: isTV ? 13 : 14 }}>
              %98 Eşleşme
            </ThemedText>
          )}

          {hero.rating && hero.rating !== '—' && (
            <View style={styles.heroRatingBadge}>
              <Ionicons name="star" size={12} color="#F5C518" style={{ marginRight: 4 }} />
              <ThemedText style={styles.heroRatingText}>{hero.rating}</ThemedText>
            </View>
          )}

          {hero.year ? <ThemedText style={styles.heroMetaText}>{hero.year}</ThemedText> : null}
          {hero.seasons ? (
            <ThemedText style={styles.heroMetaText}>{hero.seasons} Sezon</ThemedText>
          ) : null}

          {(isDesktopWeb || isTV) && (
            <>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.35)',
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  borderRadius: 3,
                }}
              >
                <ThemedText style={{ color: '#e5e5e5', fontSize: 11, fontWeight: '700' }}>
                  16+
                </ThemedText>
              </View>

              <View
                style={{
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.35)',
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  borderRadius: 3,
                }}
              >
                <ThemedText style={{ color: '#e5e5e5', fontSize: 11, fontWeight: '700' }}>
                  UHD 4K
                </ThemedText>
              </View>
            </>
          )}

          {hero.genres && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#888' }} />
              <ThemedText style={styles.heroMetaText}>
                {Array.isArray(hero.genres) ? hero.genres.slice(0, 3).join(' • ') : hero.genres}
              </ThemedText>
            </View>
          )}
        </View>

        {hero.overview ? (
          <ThemedText
            numberOfLines={isDesktopWeb ? 3 : isTV ? 3 : 2}
            style={[
              styles.heroOverview,
              isDesktopWeb && {
                fontSize: 15,
                lineHeight: 22,
                color: '#E5E5E5',
                marginBottom: 24,
                maxWidth: 540,
              },
              isTV && {
                fontSize: 14,
                lineHeight: 20,
                color: '#D1D5DB',
                marginBottom: 18,
                maxWidth: 540,
              },
            ]}
          >
            {hero.overview}
          </ThemedText>
        ) : null}

        {/* Hero Action Buttons: Prime Video / Netflix Sleek Style */}
        <View style={[styles.heroButtons, isTV && { gap: 14 }]}>
          <TVFocusable
            ref={playBtnRef}
            onPress={() => onPressPlay(hero)}
            onFocus={onFocus}
            nextFocusLeft={sidebarActiveNodeId || undefined}
            nextFocusUp={playBtnRef?.current ? findNodeHandle(playBtnRef.current) || undefined : undefined}
            nextFocusRight={infoBtnRef.current ? findNodeHandle(infoBtnRef.current) || undefined : undefined}
            style={[
              styles.heroPlayBtn,
              (isDesktopWeb || isTV)
                ? {
                    backgroundColor: '#FFFFFF',
                    paddingHorizontal: isTV ? 26 : 32,
                    paddingVertical: isTV ? 10 : 12,
                    borderRadius: 6,
                    flex: undefined,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }
                : { backgroundColor: '#E50914' },
            ]}
            focusedStyle={
              isTV
                ? {
                    transform: [{ scale: 1.06 }],
                    borderWidth: 2.5,
                    borderColor: '#E50914',
                    backgroundColor: '#FFFFFF',
                  }
                : { transform: [{ scale: 1.08 }] }
            }
          >
            <Ionicons name="play" size={isTV ? 20 : 22} color={isDesktopWeb || isTV ? '#000000' : '#fff'} />
            <ThemedText
              numberOfLines={1}
              style={[
                styles.heroPlayBtnText,
                (isDesktopWeb || isTV) ? { color: '#000000', fontWeight: '800', fontSize: isTV ? 15 : 16 } : {},
              ]}
            >
              Oynat
            </ThemedText>
          </TVFocusable>

          <TVFocusable
            ref={infoBtnRef}
            onPress={() => onPressInfo(hero)}
            onFocus={onFocus}
            nextFocusLeft={playBtnRef?.current ? findNodeHandle(playBtnRef.current) || undefined : undefined}
            nextFocusUp={infoBtnRef.current ? findNodeHandle(infoBtnRef.current) || undefined : undefined}
            style={[
              styles.heroInfoBtn,
              isTV
                ? {
                    backgroundColor: 'rgba(255, 255, 255, 0.16)',
                    paddingHorizontal: 22,
                    paddingVertical: 10,
                    borderRadius: 6,
                    borderWidth: 0,
                    flex: undefined,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }
                : isDesktopWeb
                ? {
                    backgroundColor: 'rgba(109, 109, 110, 0.7)',
                    paddingHorizontal: 28,
                    paddingVertical: 12,
                    borderRadius: 6,
                    borderWidth: 0,
                    flex: undefined,
                  }
                : {},
            ]}
            focusedStyle={
              isTV
                ? {
                    transform: [{ scale: 1.06 }],
                    borderWidth: 2.5,
                    borderColor: '#E50914',
                    backgroundColor: 'rgba(255,255,255,0.25)',
                  }
                : {
                    transform: [{ scale: 1.08 }],
                    backgroundColor: 'rgba(255,255,255,0.35)',
                    borderColor: '#E50914',
                  }
            }
          >
            <Ionicons name="information-circle-outline" size={isTV ? 20 : 22} color="#fff" />
            <ThemedText numberOfLines={1} style={[styles.heroInfoBtnText, isTV && { fontSize: 14, fontWeight: '700' }]}>
              Daha Fazla
            </ThemedText>
          </TVFocusable>
        </View>

        {/* Slayt Noktaları (Pagination Dots) */}
        {heroPool.length > 1 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 }}>
            {heroPool.map((_, idx) => (
              <TouchableOpacity
                key={`dot-${idx}`}
                onPress={() => handleSelectIndex(idx)}
                style={{
                  width: activeIndex === idx ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: activeIndex === idx ? '#E50914' : 'rgba(255,255,255,0.35)',
                }}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  heroContainer: {
    position: 'relative',
    marginBottom: 0,
    overflow: 'hidden',
    backgroundColor: '#141414',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#141414',
  },
  heroImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#161616',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContent: {
    position: 'absolute',
    bottom: isTV ? 50 : 16,
    left: 0,
    right: isTV ? undefined : 0,
    paddingHorizontal: isTV ? 50 : 16,
    maxWidth: isTV ? '50%' : undefined,
  },
  heroCategoryText: {
    fontSize: isTV ? 16 : 12,
    fontWeight: '800',
    color: '#E50914',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  heroTitle: {
    fontSize: isTV ? 52 : 28,
    lineHeight: isTV ? 60 : 34,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 10,
    includeFontPadding: false,
    paddingVertical: 2,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: isTV ? 16 : 10,
    gap: 10,
    flexWrap: 'wrap',
  },
  heroRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  heroRatingText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  heroMetaText: {
    color: '#B0B0B0',
    fontSize: 14,
    fontWeight: '600',
  },
  heroOverview: {
    fontSize: isTV ? 20 : 12.5,
    color: '#D4D4D4',
    marginBottom: 20,
    lineHeight: isTV ? 28 : 17,
    maxWidth: isTV ? '80%' : '100%',
  },
  heroButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTV ? 20 : 12,
    flexWrap: 'nowrap',
    width: '100%',
  },
  heroPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: isTV ? 14 : 10,
    paddingHorizontal: isTV ? 28 : 16,
    minWidth: isTV ? 190 : undefined,
    height: isTV ? 58 : undefined,
    flex: isTV ? undefined : 1,
    borderRadius: 8,
  },
  heroPlayBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: isTV ? 18 : 15,
  },
  heroInfoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: isTV ? 14 : 10,
    paddingHorizontal: isTV ? 28 : 16,
    minWidth: isTV ? 190 : undefined,
    height: isTV ? 58 : undefined,
    flex: isTV ? undefined : 1,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  heroInfoBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: isTV ? 18 : 15,
  },
});
