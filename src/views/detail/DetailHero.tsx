import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  findNodeHandle,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';
import { useTheme } from '@/hooks/use-theme';

export interface DetailHeroProps {
  media: any;
  isMovie: boolean;
  isTV: boolean;
  styles: any;
  movieRuntime: string;
  seasonsCount: number;
  genres: string;
  genreList: string[];
  movieProgress: number;
  isFav: boolean;
  isWatchLater: boolean;
  userRating: number | null;
  trailerKey: string | null;
  playButtonRef: any;
  trailerButtonRef?: any;
  favoriteButtonRef: any;
  watchLaterButtonRef?: any;
  ratingButtonRef?: any;
  closeButtonRef?: any;
  actorRefs?: any;
  onPlay: () => void;
  onToggleFavorite: () => void;
  onToggleWatchLater?: () => void;
  onOpenRatingModal: () => void;
  onOpenTrailer: () => void;
  onStartWatchParty?: () => void;
  onPlayOnTv?: () => void;
  onDownload?: () => void;
  downloadStatus?: 'idle' | 'queued' | 'downloading' | 'completed' | 'paused' | 'error';
  downloadProgress?: number;
}

export function DetailHero({
  media,
  isMovie,
  isTV,
  styles,
  movieRuntime,
  seasonsCount,
  genres,
  genreList,
  movieProgress,
  isFav,
  isWatchLater,
  userRating,
  trailerKey,
  playButtonRef,
  trailerButtonRef,
  favoriteButtonRef,
  watchLaterButtonRef,
  ratingButtonRef,
  closeButtonRef,
  actorRefs,
  onPlay,
  onToggleFavorite,
  onToggleWatchLater,
  onOpenRatingModal,
  onOpenTrailer,
  onStartWatchParty,
  onPlayOnTv,
  onDownload,
  downloadStatus,
  downloadProgress,
}: DetailHeroProps) {
  const theme = useTheme();

  /*
   * ============================================================
   * TV MOVIE HERO
   * ============================================================
   */
  if (isTV && isMovie) {
    return (
      <View style={styles.tvMovieInfo}>
        <ThemedText style={[styles.tvCategory, { fontSize: 16, marginBottom: 8 }]}>FİLM</ThemedText>

        <ThemedText style={[styles.tvMovieTitle, { fontSize: 48, lineHeight: 56, fontWeight: 'bold' }]} numberOfLines={2}>
          {media.title}
        </ThemedText>

        <View style={[styles.tvMeta, { gap: 16, marginVertical: 16, alignItems: 'center' }]}>
          {media.rating && (
            <View style={[styles.tvRatingBadge, { paddingHorizontal: 12, paddingVertical: 6, gap: 6 }]}>
              <Ionicons name="star" size={28} color="#F5C518" />
              <ThemedText style={[styles.tvRatingText, { fontSize: 20 }]}>{media.rating}</ThemedText>
            </View>
          )}

          {media.year && (
            <ThemedText style={[styles.tvMetaText, { fontSize: 20 }]}>{media.year}</ThemedText>
          )}

          {movieRuntime ? (
            <>
              <ThemedText style={[styles.tvMetaDot, { fontSize: 20 }]}>•</ThemedText>
              <ThemedText style={[styles.tvMetaText, { fontSize: 20 }]}>{movieRuntime}</ThemedText>
            </>
          ) : null}
        </View>

        {/* GENRES */}
        {genreList.length > 0 && (
          <View style={[styles.tvGenreRow, { gap: 12, marginBottom: 24 }]}>
            {genreList.map((genre, index) => (
              <View key={`${genre}-${index}`} style={[styles.tvGenrePill, { paddingHorizontal: 16, paddingVertical: 8 }]}>
                <ThemedText style={[styles.tvGenreText, { fontSize: 16 }]}>{genre}</ThemedText>
              </View>
            ))}
          </View>
        )}

        {/* ACTIONS */}
        <View style={[styles.tvActionRow, { gap: 16 }]}>
          <TVFocusable
            ref={playButtonRef}
            onPress={onPlay}
            style={[styles.tvPlayButton, { height: 62, paddingHorizontal: 32, gap: 12 }]}
            focusedStyle={styles.tvPlayButtonFocused}
            nextFocusUp={
              closeButtonRef?.current
                ? findNodeHandle(closeButtonRef.current) || undefined
                : undefined
            }
            nextFocusDown={
              actorRefs?.current?.[0]
                ? findNodeHandle(actorRefs.current[0]) || undefined
                : undefined
            }
            nextFocusRight={
              trailerButtonRef?.current
                ? findNodeHandle(trailerButtonRef.current) || undefined
                : favoriteButtonRef?.current
                ? findNodeHandle(favoriteButtonRef.current) || undefined
                : undefined
            }
          >
            {({ focused }) => (
              <>
                <Ionicons
                  name="play"
                  size={28}
                  color={focused ? '#fff' : '#000'}
                />
                <ThemedText
                  style={[
                    styles.tvPlayText,
                    { color: focused ? '#fff' : '#000', fontSize: 18, fontWeight: 'bold' },
                  ]}
                >
                  {movieProgress > 0 && movieProgress < 0.95
                    ? 'Devam Et'
                    : 'Oynat'}
                </ThemedText>
              </>
            )}
          </TVFocusable>

          {trailerKey && (
            <TVFocusable
              ref={trailerButtonRef}
              onPress={onOpenTrailer}
              style={[styles.tvTrailerButton, { height: 62, paddingHorizontal: 32, gap: 12 }]}
              focusedStyle={styles.tvTrailerButtonFocused}
              nextFocusLeft={
                findNodeHandle(playButtonRef.current) || undefined
              }
              nextFocusRight={
                favoriteButtonRef?.current
                  ? findNodeHandle(favoriteButtonRef.current) || undefined
                  : undefined
              }
            >
              <Ionicons name="film-outline" size={26} color="#fff" />
              <ThemedText style={[styles.tvTrailerText, { fontSize: 18, fontWeight: 'bold' }]}>Fragman</ThemedText>
            </TVFocusable>
          )}

          <TVFocusable
            ref={favoriteButtonRef}
            onPress={onToggleFavorite}
            style={[
              styles.tvFavoriteButton,
              isFav && styles.tvFavoriteActive,
              { width: 56, height: 56, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 0 }
            ]}
            focusedStyle={styles.tvFavoriteFocused}
            nextFocusLeft={
              trailerButtonRef?.current
                ? findNodeHandle(trailerButtonRef.current) || undefined
                : findNodeHandle(playButtonRef.current) || undefined
            }
            nextFocusRight={
              watchLaterButtonRef?.current
                ? findNodeHandle(watchLaterButtonRef.current) || undefined
                : ratingButtonRef?.current
                ? findNodeHandle(ratingButtonRef.current) || undefined
                : undefined
            }
            nextFocusDown={
              actorRefs?.current?.[0]
                ? findNodeHandle(actorRefs.current[0]) || undefined
                : undefined
            }
          >
            <Ionicons
              name={isFav ? 'heart' : 'heart-outline'}
              size={28}
              color="#fff"
            />
          </TVFocusable>

          {onToggleWatchLater && (
            <TVFocusable
              ref={watchLaterButtonRef}
              onPress={onToggleWatchLater}
              style={[
                styles.tvFavoriteButton,
                isWatchLater && styles.tvFavoriteActive,
                { width: 56, height: 56, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 0 }
              ]}
              focusedStyle={styles.tvFavoriteFocused}
              nextFocusLeft={
                favoriteButtonRef?.current
                  ? findNodeHandle(favoriteButtonRef.current) || undefined
                  : undefined
              }
              nextFocusRight={
                ratingButtonRef?.current
                  ? findNodeHandle(ratingButtonRef.current) || undefined
                  : undefined
              }
              nextFocusDown={
                actorRefs?.current?.[0]
                  ? findNodeHandle(actorRefs.current[0]) || undefined
                  : undefined
              }
            >
              <Ionicons
                name={isWatchLater ? 'bookmark' : 'bookmark-outline'}
                size={28}
                color="#fff"
              />
            </TVFocusable>
          )}

          <TVFocusable
            ref={ratingButtonRef}
            onPress={onOpenRatingModal}
            style={[styles.tvFavoriteButton, { width: 56, height: 56, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 0 }]}
            focusedStyle={styles.tvFavoriteFocused}
            nextFocusLeft={
              watchLaterButtonRef?.current
                ? findNodeHandle(watchLaterButtonRef.current) || undefined
                : favoriteButtonRef?.current
                ? findNodeHandle(favoriteButtonRef.current) || undefined
                : undefined
            }
            nextFocusDown={
              actorRefs?.current?.[0]
                ? findNodeHandle(actorRefs.current[0]) || undefined
                : undefined
            }
          >
            <Ionicons
              name={userRating ? 'star' : 'star-outline'}
              size={28}
              color="#F5C518"
            />
          </TVFocusable>
        </View>

        {/* PROGRESS */}
        {movieProgress > 0 && movieProgress < 0.95 && (
          <View style={styles.tvMovieProgressContainer}>
            <View
              style={[
                styles.tvMovieProgress,
                { width: `${movieProgress * 100}%` },
              ]}
            />
          </View>
        )}

        {/* OVERVIEW */}
        {media.overview && (
          <ThemedText style={styles.tvOverview} numberOfLines={5}>
            {media.overview}
          </ThemedText>
        )}
      </View>
    );
  }

  /*
   * ============================================================
   * TV SERIES HERO
   * ============================================================
   */
  if (isTV && !isMovie) {
    return (
      <View>
        <ThemedText style={[styles.tvCategory, { fontSize: 16, marginBottom: 8 }]}>DİZİ</ThemedText>

        <ThemedText style={[styles.tvSeriesTitle, { fontSize: 48, lineHeight: 56, fontWeight: 'bold' }]} numberOfLines={3}>
          {media.title}
        </ThemedText>

        <View style={[styles.tvMeta, { gap: 16, marginVertical: 16, alignItems: 'center' }]}>
          {media.rating && (
            <View style={[styles.tvRatingBadge, { paddingHorizontal: 12, paddingVertical: 6, gap: 6 }]}>
              <Ionicons name="star" size={28} color="#F5C518" />
              <ThemedText style={[styles.tvRatingText, { fontSize: 20 }]}>{media.rating}</ThemedText>
            </View>
          )}

          {media.year && (
            <ThemedText style={[styles.tvMetaText, { fontSize: 20 }]}>{media.year}</ThemedText>
          )}

          <ThemedText style={[styles.tvMetaDot, { fontSize: 20 }]}>•</ThemedText>

          <ThemedText style={[styles.tvMetaText, { fontSize: 20 }]}>
            {seasonsCount} Sezon
          </ThemedText>
        </View>

        {/* ACTION */}
        <View style={[styles.tvSeriesActionRow, { gap: 16 }]}>
          <TVFocusable
            ref={playButtonRef}
            onPress={onPlay}
            style={[styles.tvPlayButton, { height: 62, paddingHorizontal: 32, gap: 12 }]}
            focusedStyle={styles.tvPlayButtonFocused}
            nextFocusUp={
              closeButtonRef?.current
                ? findNodeHandle(closeButtonRef.current) || undefined
                : undefined
            }
            nextFocusRight={
              trailerButtonRef?.current
                ? findNodeHandle(trailerButtonRef.current) || undefined
                : favoriteButtonRef?.current
                ? findNodeHandle(favoriteButtonRef.current) || undefined
                : undefined
            }
          >
            {({ focused }) => (
              <>
                <Ionicons
                  name="play"
                  size={28}
                  color={focused ? '#fff' : '#000'}
                />
                <ThemedText
                  style={[
                    styles.tvPlayText,
                    { color: focused ? '#fff' : '#000', fontSize: 18, fontWeight: 'bold' },
                  ]}
                >
                  {movieProgress > 0 && movieProgress < 0.95
                    ? 'Devam Et'
                    : 'Oynat'}
                </ThemedText>
              </>
            )}
          </TVFocusable>

          {trailerKey && (
            <TVFocusable
              ref={trailerButtonRef}
              onPress={onOpenTrailer}
              style={[styles.tvTrailerButton, { height: 62, paddingHorizontal: 32, gap: 12 }]}
              focusedStyle={styles.tvTrailerButtonFocused}
              nextFocusLeft={
                findNodeHandle(playButtonRef.current) || undefined
              }
              nextFocusRight={
                favoriteButtonRef?.current
                  ? findNodeHandle(favoriteButtonRef.current) || undefined
                  : undefined
              }
            >
              <Ionicons name="film-outline" size={26} color="#fff" />
              <ThemedText style={[styles.tvTrailerText, { fontSize: 18, fontWeight: 'bold' }]}>Fragman</ThemedText>
            </TVFocusable>
          )}

          <TVFocusable
            ref={favoriteButtonRef}
            onPress={onToggleFavorite}
            style={[
              styles.tvFavoriteButton,
              isFav && styles.tvFavoriteActive,
              { width: 56, height: 56, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 0 }
            ]}
            focusedStyle={styles.tvFavoriteFocused}
            nextFocusLeft={
              trailerButtonRef?.current
                ? findNodeHandle(trailerButtonRef.current) || undefined
                : findNodeHandle(playButtonRef.current) || undefined
            }
            nextFocusRight={
              watchLaterButtonRef?.current
                ? findNodeHandle(watchLaterButtonRef.current) || undefined
                : ratingButtonRef?.current
                ? findNodeHandle(ratingButtonRef.current) || undefined
                : undefined
            }
          >
            <Ionicons
              name={isFav ? 'heart' : 'heart-outline'}
              size={28}
              color="#fff"
            />
          </TVFocusable>

          {onToggleWatchLater && (
            <TVFocusable
              ref={watchLaterButtonRef}
              onPress={onToggleWatchLater}
              style={[
                styles.tvFavoriteButton,
                isWatchLater && styles.tvFavoriteActive,
                { width: 56, height: 56, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 0 }
              ]}
              focusedStyle={styles.tvFavoriteFocused}
              nextFocusLeft={
                favoriteButtonRef?.current
                  ? findNodeHandle(favoriteButtonRef.current) || undefined
                  : undefined
              }
              nextFocusRight={
                ratingButtonRef?.current
                  ? findNodeHandle(ratingButtonRef.current) || undefined
                  : undefined
              }
            >
              <Ionicons
                name={isWatchLater ? 'bookmark' : 'bookmark-outline'}
                size={28}
                color="#fff"
              />
            </TVFocusable>
          )}

          <TVFocusable
            ref={ratingButtonRef}
            onPress={onOpenRatingModal}
            style={[styles.tvFavoriteButton, { width: 56, height: 56, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 0 }]}
            focusedStyle={styles.tvFavoriteFocused}
            nextFocusLeft={
              watchLaterButtonRef?.current
                ? findNodeHandle(watchLaterButtonRef.current) || undefined
                : favoriteButtonRef?.current
                ? findNodeHandle(favoriteButtonRef.current) || undefined
                : undefined
            }
          >
            <Ionicons
              name={userRating ? 'star' : 'star-outline'}
              size={28}
              color="#F5C518"
            />
          </TVFocusable>

          {onStartWatchParty && (
            <TVFocusable
              onPress={onStartWatchParty}
              style={[styles.tvFavoriteButton, { width: 56, height: 56, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 0 }]}
              focusedStyle={styles.tvFavoriteFocused}
              nextFocusLeft={
                ratingButtonRef?.current
                  ? findNodeHandle(ratingButtonRef.current) || undefined
                  : undefined
              }
            >
              <Ionicons
                name="people"
                size={28}
                color="#3B82F6"
              />
            </TVFocusable>
          )}
        </View>

        {/* GENRES */}
        {genres ? (
          <View style={styles.tvGenreRow}>
            {genreList.map((genre, index) => (
              <View key={`${genre}-${index}`} style={styles.tvGenrePill}>
                <ThemedText style={styles.tvGenreText}>{genre}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        {/* OVERVIEW */}
        {media.overview && (
          <ThemedText style={styles.tvOverview} numberOfLines={7}>
            {media.overview}
          </ThemedText>
        )}
      </View>
    );
  }

  /*
   * ============================================================
   * MOBILE / TABLET HERO
   * ============================================================
   */
  return (
    <View>
      <ThemedText style={styles.categoryBadge}>
        {isMovie ? 'FİLM' : 'DİZİ'}
      </ThemedText>

      <ThemedText style={styles.title}>{media.title}</ThemedText>

      <View style={styles.metaRow}>
        {media.rating && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={12} color="#F5C518" />
            <ThemedText style={styles.ratingText}>{media.rating}</ThemedText>
          </View>
        )}

        {media.year && (
          <ThemedText style={styles.metaText}>{media.year}</ThemedText>
        )}

        <ThemedText style={styles.metaDivider}>•</ThemedText>

        {isMovie ? (
          movieRuntime ? (
            <ThemedText style={styles.metaText}>{movieRuntime}</ThemedText>
          ) : null
        ) : (
          <ThemedText style={styles.metaText}>
            {seasonsCount} Sezon
          </ThemedText>
        )}

        {genres ? (
          <>
            <ThemedText style={styles.metaDivider}>•</ThemedText>
            <ThemedText style={styles.metaText} numberOfLines={1}>
              {genres.split(',')[0]}
            </ThemedText>
          </>
        ) : null}
      </View>

      {/* 1. Katman: Ana Oynatma Butonu (Tam Genişlik) */}
      <View style={heroStyles.primaryPlayWrapper}>
        <TVFocusable
          ref={playButtonRef}
          onPress={onPlay}
          style={heroStyles.largePlayButton}
          focusedStyle={styles.playButtonFocused}
        >
          <Ionicons name="play" size={22} color="#000" />
          <ThemedText style={heroStyles.largePlayButtonText}>
            {movieProgress > 0 && movieProgress < 0.95
              ? 'İzlemeye Devam Et'
              : 'Oynat'}
          </ThemedText>
        </TVFocusable>

        {movieProgress > 0 && movieProgress < 0.95 && (
          <View style={styles.movieProgressBarContainer}>
            <View
              style={[
                styles.movieProgressBar,
                { width: `${movieProgress * 100}%` },
              ]}
            />
          </View>
        )}
      </View>

      {/* 2. Katman: İndir ve Fragman Butonları (Yan Yana / Dengeli İkili Blok) */}
      <View style={heroStyles.secondaryActionsRow}>
        {onDownload && (
          <TouchableOpacity
            style={[
              heroStyles.downloadActionBtn,
              downloadStatus === 'downloading' && heroStyles.downloadActionBtnActive,
              downloadStatus === 'completed' && heroStyles.downloadActionBtnCompleted,
            ]}
            onPress={onDownload}
            activeOpacity={0.75}
          >
            {downloadStatus === 'downloading' ? (
              <View style={{ width: 22, height: 22, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size={18} color="#00E5FF" />
              </View>
            ) : (
              <Ionicons
                name={
                  downloadStatus === 'completed'
                    ? 'checkmark-circle'
                    : downloadStatus === 'queued'
                    ? 'time-outline'
                    : downloadStatus === 'error'
                    ? 'alert-circle-outline'
                    : 'arrow-down-circle-outline'
                }
                size={22}
                color={
                  downloadStatus === 'completed'
                    ? '#00E676'
                    : downloadStatus === 'queued'
                    ? '#FFA000'
                    : downloadStatus === 'error'
                    ? '#FF5252'
                    : '#FFF'
                }
              />
            )}
            <ThemedText
              style={[
                heroStyles.downloadActionText,
                downloadStatus === 'downloading' && { color: '#00E5FF' },
                downloadStatus === 'completed' && { color: '#00E676' },
              ]}
            >
              {downloadStatus === 'completed'
                ? 'İndirildi'
                : downloadStatus === 'downloading'
                ? `%${Math.round((downloadProgress || 0) * 100)} İndiriliyor`
                : downloadStatus === 'queued'
                ? 'Kuyrukta'
                : downloadStatus === 'error'
                ? 'Tekrar Dene'
                : 'İndir'}
            </ThemedText>
          </TouchableOpacity>
        )}

        {trailerKey && (
          <TouchableOpacity
            style={heroStyles.trailerActionBtn}
            onPress={onOpenTrailer}
            activeOpacity={0.75}
          >
            <Ionicons name="film-outline" size={20} color="#FFF" />
            <ThemedText style={heroStyles.trailerActionText}>Fragman</ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {/* 3. Katman: İkincil Aksiyon İkonları (Ferah, Eşit Dağılımlı Konsol) */}
      <View style={heroStyles.mobileActionIconsRow}>
        <TouchableOpacity
          style={heroStyles.iconBtn}
          onPress={onToggleFavorite}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isFav ? 'heart' : 'heart-outline'}
            size={24}
            color={isFav ? '#E50914' : '#fff'}
          />
          <ThemedText style={heroStyles.iconBtnLabel}>
            {isFav ? 'Listede' : 'Listem'}
          </ThemedText>
        </TouchableOpacity>

        {onToggleWatchLater && (
          <TouchableOpacity
            style={heroStyles.iconBtn}
            onPress={onToggleWatchLater}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isWatchLater ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color={isWatchLater ? theme.primary : '#fff'}
            />
            <ThemedText style={heroStyles.iconBtnLabel}>
              {isWatchLater ? 'Kayıtlı' : 'Daha Sonra'}
            </ThemedText>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={heroStyles.iconBtn}
          onPress={onOpenRatingModal}
          activeOpacity={0.7}
        >
          <Ionicons
            name={userRating ? 'star' : 'star-outline'}
            size={24}
            color={userRating ? '#F5C518' : '#fff'}
          />
          <ThemedText style={heroStyles.iconBtnLabel}>
            {userRating ? `${userRating}/10` : 'Puanla'}
          </ThemedText>
        </TouchableOpacity>

        {onStartWatchParty && (
          <TouchableOpacity
            style={heroStyles.iconBtn}
            onPress={onStartWatchParty}
            activeOpacity={0.7}
          >
            <Ionicons
              name="people-outline"
              size={24}
              color="#3B82F6"
            />
            <ThemedText style={heroStyles.iconBtnLabel}>
              Birlikte İzle
            </ThemedText>
          </TouchableOpacity>
        )}

        {onPlayOnTv && (
          <TouchableOpacity
            style={heroStyles.iconBtn}
            onPress={onPlayOnTv}
            activeOpacity={0.7}
          >
            <Ionicons name="tv-outline" size={24} color="#FFFFFF" />
            <ThemedText style={heroStyles.iconBtnLabel}>TV'ye Aktar</ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {/* OVERVIEW */}
      {media.overview && (
        <ThemedText style={styles.overview} numberOfLines={6}>
          {media.overview}
        </ThemedText>
      )}
    </View>
  );
}

const heroStyles = StyleSheet.create({
  primaryPlayWrapper: {
    width: '100%',
    marginBottom: 10,
  },
  largePlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    width: '100%',
  },
  largePlayButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    marginBottom: 16,
  },
  downloadActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  downloadActionBtnActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderColor: 'rgba(0, 229, 255, 0.4)',
  },
  downloadActionBtnCompleted: {
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
    borderColor: 'rgba(0, 230, 118, 0.4)',
  },
  downloadActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  trailerActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  trailerActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  mobileActionIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 18,
  },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  iconBtnLabel: {
    fontSize: 10,
    color: '#aaa',
    fontWeight: '600',
  },
  iconBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    marginRight: 4,
  },
  iconBtnPrimaryText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
});
