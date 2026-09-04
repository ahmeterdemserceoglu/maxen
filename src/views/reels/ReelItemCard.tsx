import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UniversalYouTubePlayer } from '@/components/UniversalYouTubePlayer';
import IMDbNativePlayer from '@/components/IMDbNativePlayer';
import { TVFocusable } from '@/components/TVFocusable';
import { TMDB_IMAGE_BASE_URL } from '@/config/tmdb';
import { ReelItem } from './useReelsFeed';

const isTV = Platform.isTV;

export interface ReelItemCardProps {
  item: ReelItem;
  index: number;
  activeIndex: number;
  totalCount: number;
  isFav: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  failedVideoKeys: Record<string, boolean>;
  onToggleFav: (item: ReelItem) => void;
  onToggleMute: () => void;
  onSelectMedia: (item: ReelItem) => void;
  onPlayMedia: (item: ReelItem) => void;
  onClose?: () => void;
  onEnterFullscreen: () => void;
  onExitFullscreen: () => void;
  onVideoFail: (key: string) => void;
}

export const ReelItemCard: React.FC<ReelItemCardProps> = ({
  item,
  index,
  activeIndex,
  totalCount,
  isFav,
  isMuted,
  isFullscreen,
  failedVideoKeys,
  onToggleFav,
  onToggleMute,
  onSelectMedia,
  onPlayMedia,
  onClose,
  onEnterFullscreen,
  onExitFullscreen,
  onVideoFail,
}) => {
  const { width, height } = useWindowDimensions();
  const isCurrent = index === activeIndex;

  const displayTitle = item.title || item.name || 'İçerik';
  const year = (item.release_date || item.first_air_date || '').substring(0, 4);

  const hasIMDbFailed = item.imdbId ? !!failedVideoKeys[item.imdbId] : false;
  const hasYouTubeFailed = item.youtubeKey ? !!failedVideoKeys[item.youtubeKey] : false;

  // Priority: IMDb -> YouTube -> Backdrop
  const tryPlayIMDb = !!item.imdbId && !hasIMDbFailed;
  const tryPlayYouTube = !tryPlayIMDb && !!item.youtubeKey && !hasYouTubeFailed;

  // Performance: ONLY mount native player for the currently active item
  // Prevents multiple concurrent native WebViews and 250MB+ RAM bloat
  const shouldMountPlayer = index === activeIndex;

  const mountIMDb = shouldMountPlayer && tryPlayIMDb;
  const mountYouTube = shouldMountPlayer && tryPlayYouTube;

  const isPortrait = height > width;
  const playerHeight = height;
  const playerWidth = item.isVertical && isPortrait ? Math.ceil(height * (16 / 9)) : width;

  const imageUri =
    item.backdrop_path?.startsWith('http')
      ? item.backdrop_path
      : item.poster_path?.startsWith('http')
      ? item.poster_path
      : (item.backdrop_path || item.poster_path)
      ? `${TMDB_IMAGE_BASE_URL}/w1280${item.backdrop_path || item.poster_path}`
      : item.backdropUrl || item.posterUrl || undefined;

  return (
    <View style={[styles.reelContainer, { width, height }]}>
      {/* =====================================================
          BASE BACKDROP IMAGE (Always rendered; acts as placeholder & fallback)
      ====================================================== */}
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000' }]} />
      )}

      {/* =====================================================
          VIDEO PLAYER (Mounted ONLY for the currently active item)
      ====================================================== */}
      {mountIMDb ? (
        <IMDbNativePlayer
          imdbId={item.imdbId!}
          isCurrent={isCurrent}
          isMuted={isMuted}
          width={width}
          height={height}
          isVertical={item.isVertical}
          showControls={isFullscreen && isCurrent}
          onExitFullscreen={onExitFullscreen}
          onFail={() => onVideoFail(item.imdbId!)}
        />
      ) : mountYouTube ? (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden',
              backgroundColor: '#000000',
            },
          ]}
        >
          <UniversalYouTubePlayer
            videoId={item.youtubeKey!}
            width={playerWidth}
            height={playerHeight}
            play={isCurrent}
            mute={isMuted}
            controls={false}
            loop={true}
            preventFullScreen={true}
            onError={(err: any) => {
              console.log('[ReelsFeed] YouTube error:', err);
            }}
          />
          {/* YouTube Fullscreen Close Button */}
          {isFullscreen && isCurrent && (
            <TouchableOpacity
              style={styles.fullscreenCloseBtn}
              onPress={onExitFullscreen}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {/* =====================================================
          UI OVERLAYS
      ====================================================== */}
      {!(isFullscreen && isCurrent) && (
        <>
          <LinearGradient
            pointerEvents="none"
            colors={[
              'rgba(0,0,0,0.40)',
              'transparent',
              'transparent',
              'rgba(0,0,0,0.80)',
            ]}
            locations={[0, 0.12, 0.68, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          {/* TOP BAR */}
          <View style={[styles.topBar, isTV && styles.topBarTV]}>
            {onClose && (
              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.8}
                style={[styles.closeButton, isTV && styles.closeButtonTV]}
              >
                <Ionicons name="chevron-back" size={isTV ? 29 : 23} color="#fff" />
              </TouchableOpacity>
            )}

            <View style={styles.feedBrand}>
              <View style={styles.feedIcon}>
                <Ionicons name="play" size={10} color="#fff" />
              </View>
              <Text style={[styles.feedTitle, isTV && styles.feedTitleTV]}>KEŞİF</Text>
              <View style={styles.feedDivider} />
              <Text style={[styles.feedSubtitle, isTV && styles.feedSubtitleTV]}>
                FRAGMANLAR
              </Text>
            </View>

            {/* COUNTER */}
            <View style={[styles.counter, isTV && styles.counterTV]}>
              <Text style={styles.counterActive}>{String(index + 1).padStart(2, '0')}</Text>
              <Text style={styles.counterSlash}>/</Text>
              <Text style={styles.counterTotal}>
                {String(totalCount).padStart(2, '0')}
              </Text>
            </View>
          </View>

          {/* =====================================================
              RIGHT ACTION RAIL
          ====================================================== */}
          <View style={[styles.actionRail, isTV && styles.actionRailTV]}>
            {/* PLAY */}
            <TVFocusable
              style={styles.focusableAction}
              focusedStyle={styles.focusableActionFocused}
              onPress={onEnterFullscreen}
            >
              <View
                style={[
                  styles.actionCircle,
                  styles.playCircle,
                  isTV && styles.actionCircleTV,
                ]}
              >
                <Ionicons name="play" size={isTV ? 27 : 23} color="#fff" />
              </View>
              <Text style={[styles.actionLabel, isTV && styles.actionLabelTV]}>İZLE</Text>
            </TVFocusable>

            {/* DETAIL */}
            <TVFocusable
              style={styles.focusableAction}
              focusedStyle={styles.focusableActionFocused}
              onPress={() => onSelectMedia(item)}
            >
              <View style={[styles.actionCircle, isTV && styles.actionCircleTV]}>
                <Ionicons
                  name="information-outline"
                  size={isTV ? 27 : 22}
                  color="#fff"
                />
              </View>
              <Text style={[styles.actionLabel, isTV && styles.actionLabelTV]}>DETAY</Text>
            </TVFocusable>

            {/* FAVORITE */}
            <TVFocusable
              style={styles.focusableAction}
              focusedStyle={styles.focusableActionFocused}
              onPress={() => onToggleFav(item)}
            >
              <View
                style={[
                  styles.actionCircle,
                  isFav && styles.favoriteCircle,
                  isTV && styles.actionCircleTV,
                ]}
              >
                <Ionicons
                  name={isFav ? 'heart' : 'heart-outline'}
                  size={isTV ? 26 : 22}
                  color="#fff"
                />
              </View>
              <Text style={[styles.actionLabel, isTV && styles.actionLabelTV]}>
                {isFav ? 'LİSTEDE' : 'LİSTEM'}
              </Text>
            </TVFocusable>

            {/* SOUND */}
            <TVFocusable
              style={styles.focusableAction}
              focusedStyle={styles.focusableActionFocused}
              onPress={onToggleMute}
            >
              <View style={[styles.actionCircle, isTV && styles.actionCircleTV]}>
                <Ionicons
                  name={isMuted ? 'volume-mute-outline' : 'volume-high-outline'}
                  size={isTV ? 26 : 21}
                  color="#fff"
                />
              </View>
              <Text style={[styles.actionLabel, isTV && styles.actionLabelTV]}>
                {isMuted ? 'SESSİZ' : 'SES'}
              </Text>
            </TVFocusable>
          </View>

          {/* =====================================================
              BOTTOM CONTENT INFO
          ====================================================== */}
          <View style={[styles.bottomInfo, isTV && styles.bottomInfoTV]}>
            {/* TREND */}
            <View style={styles.trendingRow}>
              <View style={styles.liveDot} />
              <Text style={styles.trendingText}>GÜNÜN TRENDİ</Text>
              <View style={styles.trendingLine} />
            </View>

            {/* META */}
            <View style={styles.metaRow}>
              {item.vote_average > 0 && (
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={12} color="#FFD43B" />
                  <Text style={styles.ratingText}>{item.vote_average.toFixed(1)}</Text>
                </View>
              )}
              {year ? <Text style={styles.yearText}>{year}</Text> : null}
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>
                  {item.media_type === 'tv' ? 'DİZİ' : 'FİLM'}
                </Text>
              </View>
            </View>

            {/* TITLE */}
            <Text
              style={[styles.reelTitle, isTV && styles.reelTitleTV]}
              numberOfLines={2}
            >
              {displayTitle}
            </Text>

            {/* OVERVIEW */}
            {!!item.overview && (
              <Text
                style={[styles.reelOverview, isTV && styles.reelOverviewTV]}
                numberOfLines={3}
              >
                {item.overview}
              </Text>
            )}

            {/* NEXT INDICATOR */}
            <View style={styles.nextHint}>
              <View style={styles.nextArrow}>
                <Ionicons name="chevron-down" size={13} color="#fff" />
              </View>
              <Text style={styles.nextText}>SONRAKİ FRAGMAN</Text>
            </View>
          </View>

          {/* PROGRESS */}
          <View style={[styles.progressTrack, isTV && styles.progressTrackTV]}>
            <View
              style={[
                styles.progressActive,
                {
                  width: `${((index + 1) / Math.max(totalCount, 1)) * 100}%`,
                },
              ]}
            />
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  reelContainer: {
    position: 'relative',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  fullscreenCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 40,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 42 : 22,
    left: 18,
    right: 18,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 30,
  },
  topBarTV: {
    top: 34,
    left: 32,
    right: 32,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonTV: {
    width: 52,
    height: 52,
    borderRadius: 17,
  },
  feedBrand: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  feedIcon: {
    width: 23,
    height: 23,
    borderRadius: 7,
    backgroundColor: '#E50914',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 7,
  },
  feedTitle: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  feedTitleTV: {
    fontSize: 14,
  },
  feedDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginHorizontal: 9,
  },
  feedSubtitle: {
    color: '#9A9A9F',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  feedSubtitleTV: {
    fontSize: 11,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.46)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  counterTV: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  counterActive: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  counterSlash: {
    color: '#55555B',
    marginHorizontal: 4,
    fontSize: 11,
  },
  counterTotal: {
    color: '#77777D',
    fontSize: 11,
    fontWeight: '700',
  },
  actionRail: {
    position: 'absolute',
    right: 13,
    bottom: 122,
    alignItems: 'center',
    gap: 14,
    zIndex: 30,
  },
  actionRailTV: {
    right: 34,
    bottom: 155,
    gap: 19,
  },
  focusableAction: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    padding: 4,
  },
  focusableActionFocused: {
    transform: [{ scale: 1.1 }],
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 2,
    borderColor: '#fff',
  },
  actionCircle: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: 'rgba(10,10,13,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCircleTV: {
    width: 62,
    height: 62,
    borderRadius: 20,
  },
  playCircle: {
    backgroundColor: '#E50914',
    borderColor: '#E50914',
  },
  favoriteCircle: {
    backgroundColor: '#E50914',
    borderColor: '#E50914',
  },
  actionLabel: {
    color: '#fff',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.4,
    marginTop: 5,
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  actionLabelTV: {
    fontSize: 10,
  },
  bottomInfo: {
    position: 'absolute',
    left: 20,
    right: 88,
    bottom: 32,
    zIndex: 25,
  },
  bottomInfoTV: {
    left: 42,
    right: 210,
    bottom: 55,
    maxWidth: 900,
  },
  trendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E50914',
    marginRight: 7,
  },
  trendingText: {
    color: '#E50914',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  trendingLine: {
    width: 38,
    height: 1,
    backgroundColor: 'rgba(229,9,20,0.55)',
    marginLeft: 9,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  ratingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  yearText: {
    color: '#D3D3D7',
    fontSize: 12,
    fontWeight: '700',
  },
  typeBadge: {
    backgroundColor: '#E50914',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  reelTitle: {
    color: '#fff',
    fontSize: 27,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  reelTitleTV: {
    fontSize: 40,
    lineHeight: 45,
    marginBottom: 12,
  },
  reelOverview: {
    color: '#D1D1D4',
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
    maxWidth: 650,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  reelOverviewTV: {
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 800,
  },
  nextHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    opacity: 0.6,
  },
  nextArrow: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },
  nextText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    zIndex: 40,
  },
  progressTrackTV: {
    height: 4,
  },
  progressActive: {
    height: '100%',
    backgroundColor: '#E50914',
  },
});
