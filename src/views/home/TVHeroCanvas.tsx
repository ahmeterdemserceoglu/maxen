import React, { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { getTVNodeHandle } from '@/utils/tvNodeHandle';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';
import { useUiStore } from '@/store/uiStore';

export interface TVHeroCanvasProps {
  media: any;
  onPressPlay: (media: any) => void;
  onPressInfo: (media: any) => void;
  onFocus?: () => void;
  playBtnRef?: React.RefObject<any>;
  canvasHeight?: number;
}

export const TVHeroCanvas: React.FC<TVHeroCanvasProps> = React.memo(({
  media,
  onPressPlay,
  onPressInfo,
  onFocus,
  playBtnRef,
  canvasHeight: customCanvasHeight,
}) => {
  const { width, height } = useWindowDimensions();
  const infoBtnRef = useRef<any>(null);

  const sidebarActiveNodeId = useUiStore((state) => state.sidebarActiveNodeId);
  const firstRowFirstCardNodeId = useUiStore((state) => state.firstRowFirstCardNodeId);
  const setHeroPlayBtnNodeId = useUiStore((state) => state.setHeroPlayBtnNodeId);

  useEffect(() => {
    if (playBtnRef?.current) {
      const id = getTVNodeHandle(playBtnRef.current);
      if (id) setHeroPlayBtnNodeId(id);
    }
    return () => setHeroPlayBtnNodeId(null);
  }, [playBtnRef, setHeroPlayBtnNodeId]);

  if (!media) return null;

  // ─── Backdrop URL ──────────────────────────────────────────────────────────
  const rawBackdrop =
    media.backdropUrl ||
    media.backdrop_path ||
    media.backdropUri ||
    media.posterUrl ||
    media.poster_path;

  let backdropUri = rawBackdrop;
  if (backdropUri && typeof backdropUri === 'string' && backdropUri.startsWith('/')) {
    backdropUri = `https://image.tmdb.org/t/p/w1280${backdropUri}`;
  }

  // ─── Metadata ──────────────────────────────────────────────────────────────
  const isEpisode = !!(
    media.season_number != null ||
    media.episode_number != null ||
    media.SeasonNumber != null ||
    media.EpisodeNumber != null
  );

  const title = media.title || media.name || media.show_title || media.SeriesName || '';
  const isMovie = media.type === 'movie' || (!media.seasons && !media.number_of_episodes && !isEpisode);

  const year = media.year ||
    (media.release_date ? media.release_date.slice(0, 4) :
      media.first_air_date ? media.first_air_date.slice(0, 4) : '');

  const rating = media.rating || (media.vote_average ? media.vote_average.toFixed(1) : '');

  const newSeasonLabel = !isMovie && media.seasons && Number(media.seasons) > 1
    ? `${media.seasons}. Sezon`
    : null;

  const s = media.season_number || media.SeasonNumber || 1;
  const e = media.episode_number || media.EpisodeNumber || 1;
  const playLabel = isMovie ? 'Oynat' : `S${s} B${e} İzle`;

  const genresLine = media.genres
    ? (Array.isArray(media.genres) ? media.genres.slice(0, 3).join(' • ') : String(media.genres))
    : '';

  // Compact scaling for standard 1080p Android TV (@320dpi: 540dp height, 960dp width)
  const isCompactTV = height <= 640;
  const canvasHeight = customCanvasHeight ?? (isCompactTV ? 280 : Math.round(height * 0.54));
  const contentMaxWidth = Math.min(Math.round(width * 0.65), 700);

  return (
    <View style={[styles.canvasContainer, { height: canvasHeight }]}>

      {/* Backdrop Image */}
      {backdropUri ? (
        <Image
          source={{ uri: backdropUri }}
          style={styles.backdropImage}
          contentFit="cover"
          contentPosition="center"
          transition={200}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={styles.backdropPlaceholder} />
      )}

      {/* Left gradient — ensures readable text against bright backgrounds */}
      <LinearGradient
        colors={[
          'rgba(11,11,15,0.94)',
          'rgba(11,11,15,0.76)',
          'rgba(11,11,15,0.38)',
          'rgba(11,11,15,0.08)',
          'transparent',
        ]}
        locations={[0, 0.25, 0.52, 0.76, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.leftGradient}
        pointerEvents="none"
      />

      {/* Top fade */}
      <LinearGradient
        colors={['rgba(11,11,15,0.65)', 'transparent']}
        style={[styles.topGradient, { height: isCompactTV ? 50 : 90 }]}
        pointerEvents="none"
      />

      {/* Bottom dissolve into catalog */}
      <LinearGradient
        colors={['transparent', 'rgba(11,11,15,0.35)', 'rgba(11,11,15,0.85)', '#0B0B0F']}
        locations={[0, 0.35, 0.72, 1]}
        style={[styles.bottomGradient, { height: Math.round(canvasHeight * 0.32) }]}
        pointerEvents="none"
      />

      {/* Rating — top right, Prime style */}
      {rating ? (
        <View style={styles.ratingTopRight}>
          <Ionicons name="star" size={10} color="#F5C518" style={{ marginRight: 3 }} />
          <ThemedText style={styles.ratingTopRightText}>{rating}</ThemedText>
        </View>
      ) : null}

      {/* Hero content — bottom left with safe spacing */}
      <View style={[styles.content, { maxWidth: contentMaxWidth, bottom: isCompactTV ? 16 : 28 }]}>

        {/* Brand + type row */}
        <View style={[styles.topLabelRow, isCompactTV && { marginBottom: 4 }]}>
          <View style={styles.maxenBadge}>
            <ThemedText style={styles.maxenBadgeText}>MAXEN</ThemedText>
          </View>
          <ThemedText style={styles.typePill}>
            {isMovie ? 'FİLM' : 'DİZİ'}
          </ThemedText>
        </View>

        {/* "New Season" green label */}
        {newSeasonLabel ? (
          <ThemedText style={styles.newSeasonLabel}>{newSeasonLabel}</ThemedText>
        ) : null}

        {/* Main title — large, 2 lines max with auto-scaling to avoid cut-off */}
        <ThemedText
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[
            styles.title,
            isCompactTV && {
              fontSize: 32,
              lineHeight: 38,
              marginBottom: 6,
            },
          ]}
        >
          {title}
        </ThemedText>

        {/* Metadata */}
        <View style={[styles.metaRow, isCompactTV && { marginBottom: 4 }]}>
          {rating ? (
            <View style={styles.imdbBadge}>
              <ThemedText style={styles.imdbLabel}>IMDb</ThemedText>
              <ThemedText style={styles.imdbRating}> {rating}</ThemedText>
            </View>
          ) : null}
          {year ? <ThemedText style={styles.metaText}>{year}</ThemedText> : null}
          {!isMovie && media.seasons ? (
            <ThemedText style={styles.metaText}>{media.seasons} Sezon</ThemedText>
          ) : null}
          {isMovie && media.runtime ? (
            <ThemedText style={styles.metaText}>{media.runtime}</ThemedText>
          ) : null}
          <View style={styles.hdBadge}>
            <ThemedText style={styles.hdBadgeText}>4K</ThemedText>
          </View>
        </View>

        {/* Genres */}
        {genresLine ? (
          <ThemedText numberOfLines={1} style={[styles.genres, isCompactTV && { marginBottom: 4 }]}>
            {genresLine}
          </ThemedText>
        ) : null}

        {/* Overview — 2 lines cleanly constrained */}
        {media.overview ? (
          <ThemedText
            numberOfLines={2}
            style={[
              styles.overview,
              isCompactTV && {
                fontSize: 12,
                lineHeight: 17,
                marginBottom: 10,
              },
            ]}
          >
            {media.overview}
          </ThemedText>
        ) : null}

        {/* Action buttons */}
        <View style={[styles.buttonRow, isCompactTV && { gap: 10 }]}>
          <TVFocusable
            ref={playBtnRef}
            hasTVPreferredFocus
            onFocus={onFocus}
            onPress={() => onPressPlay(media)}
            nextFocusLeft={sidebarActiveNodeId || undefined}
            nextFocusDown={firstRowFirstCardNodeId || undefined}
            nextFocusRight={getTVNodeHandle(infoBtnRef)}
            style={[
              styles.playBtn,
              isCompactTV && {
                paddingHorizontal: 22,
                paddingVertical: 9,
              },
            ]}
            focusedStyle={styles.playBtnFocused}
          >
            <Ionicons name="play" size={isCompactTV ? 16 : 18} color="#000000" />
            <ThemedText style={[styles.playBtnText, isCompactTV && { fontSize: 14 }]}>
              {playLabel}
            </ThemedText>
          </TVFocusable>

          <TVFocusable
            ref={infoBtnRef}
            onFocus={onFocus}
            onPress={() => onPressInfo(media)}
            nextFocusLeft={getTVNodeHandle(playBtnRef)}
            nextFocusDown={firstRowFirstCardNodeId || undefined}
            style={[
              styles.infoBtn,
              isCompactTV && {
                paddingHorizontal: 18,
                paddingVertical: 9,
              },
            ]}
            focusedStyle={styles.infoBtnFocused}
          >
            <Ionicons name="information-circle-outline" size={isCompactTV ? 16 : 18} color="#FFFFFF" />
            <ThemedText style={[styles.infoBtnText, isCompactTV && { fontSize: 13 }]}>
              Detaylar
            </ThemedText>
          </TVFocusable>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  canvasContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#0B0B0F',
  },
  backdropImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0B0B0F',
  },
  backdropPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#121218',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 90,
  },
  leftGradient: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '68%',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  ratingTopRight: {
    position: 'absolute',
    top: 18,
    right: 22,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  ratingTopRightText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    position: 'absolute',
    bottom: 28,
    left: 44,
    zIndex: 10,
  },
  topLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  maxenBadge: {
    backgroundColor: '#E50914',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  maxenBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  typePill: {
    color: '#CCCCCC',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  newSeasonLabel: {
    color: '#46D369',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  title: {
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
    flexWrap: 'wrap',
  },
  imdbBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5C518',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  imdbLabel: {
    color: '#000',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  imdbRating: {
    color: '#000',
    fontSize: 10,
    fontWeight: '800',
  },
  metaText: {
    color: '#AAAAAA',
    fontSize: 12,
    fontWeight: '600',
  },
  hdBadge: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  hdBadgeText: {
    color: '#DDDDDD',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  genres: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  overview: {
    fontSize: 13,
    lineHeight: 19,
    color: '#B0B0B0',
    marginBottom: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    elevation: 5,
  },
  playBtnFocused: {
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#E50914',
    shadowColor: '#E50914',
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 12,
  },
  playBtnText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 15,
  },
  infoBtn: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  infoBtnFocused: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 3,
    borderColor: '#E50914',
    shadowColor: '#E50914',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
  },
  infoBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
