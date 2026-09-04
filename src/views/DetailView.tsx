import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  StatusBar,
  Animated,
  findNodeHandle,
  useWindowDimensions,
  Platform,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { TVFocusable } from '@/components/TVFocusable';
import { useAuth } from '@/contexts/AuthContext';
import { useUiStore } from '@/store/uiStore';
import { createWatchPartyRoom } from '@/services/watchPartyService';
import { PlayOnTvModal } from '@/components/PlayOnTvModal';
import { extractCleanTmdbId } from '@/types/profileMedia';
import {
  subscribeToDownloads,
  queueDownload,
  deleteDownload,
  type DownloadItem,
} from '@/services/downloadService';
import { resolveParallelDirectStreamResult } from '@/features/player/services/streamResolverService';
import { API_BASE_URL } from '@/config/tmdb';
import {
  useDetailState,
  DetailHero,
  SeasonEpisodeList,
  CastMemberList,
  RecommendationsGrid,
  RatingModal,
  TrailerModal,
} from './detail';

const AnimatedImage = Animated.createAnimatedComponent(Image);

export interface DetailViewProps {
  media: any;
  profileId: string;
  onClose: () => void;
  onSelectActor: (actor: any) => void;
  onPlayMedia: (media: any) => void;
  onSelectMedia?: (media: any) => void;
}

export function DetailView(props: DetailViewProps) {
  const {
    isTV,
    isTablet,
    styles,
    theme,
    isMovie,
    tmdbId,
    genreList,
    genres,
    cast,
    seasons,
    activeSeason,
    episodes,
    loadingEpisodes,
    movieRuntime,
    localProgresses,
    movieProgress,
    allEpisodes,
    recommendations,
    collectionData,
    userRating,
    isFav,
    isWatchLaterState,
    trailerKey,
    isTrailerModalOpen,
    setIsTrailerModalOpen,
    isRatingModalOpen,
    setIsRatingModalOpen,
    fadeAnim,
    scrollY,
    backdropTranslateY,
    backdropScale,
    heroOpacity,
    backdropSource,
    closeButtonRef,
    playButtonRef,
    trailerButtonRef,
    favoriteButtonRef,
    watchLaterButtonRef,
    ratingButtonRef,
    seasonRefs,
    episodeRefs,
    actorRefs,
    firstEpisodeRef,
    handleRate,
    handleToggleFavorite,
    handleToggleWatchLater,
    handleClose,
    handleSeasonChange,
    handlePlayEpisode,
    handlePlayMovie,
    buildEpisodePlayPayload,
    buildMoviePlayPayload,
    onSelectActor,
    onPlayMedia,
    onSelectMedia,
  } = useDetailState(props);

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isLargeTv = isTV && screenWidth >= 1600;

  const { user, activeProfile } = useAuth();
  const { openWatchParty } = useUiStore();
  const { media, profileId } = props;
  const [playOnTvVisible, setPlayOnTvVisible] = useState(false);
  const [playOnTvMedia, setPlayOnTvMedia] = useState<any>(null);

  const handlePlaySeries = () => {
    if (episodes.length === 0 && allEpisodes.length === 0) return;

    const targetId = extractCleanTmdbId(media);
    const matchedProgress = localProgresses.find(
      (p: any) => extractCleanTmdbId(p) === targetId
    );
    if (matchedProgress && matchedProgress.season_number && matchedProgress.episode_number) {
      const targetSeason = Number(matchedProgress.season_number);
      const targetEpisode = Number(matchedProgress.episode_number);
      const targetEp = allEpisodes.find(
        (ep: any) =>
          Number(ep.ParentIndexNumber ?? ep.season_number) === targetSeason &&
          Number(ep.IndexNumber ?? ep.episode_number) === targetEpisode
      );
      if (targetEp) {
        handlePlayEpisode(targetEp);
        return;
      }
    }
    handlePlayEpisode(episodes[0] || allEpisodes[0]);
  };

  const resolvePlayPayloadForTv = () => {
    if (isMovie) return buildMoviePlayPayload();

    const matchedProgress = localProgresses.find(
      (p: any) => String(p.tmdbId || p.id) === String(media.tmdbId || media.id)
    );
    if (matchedProgress && matchedProgress.season_number && matchedProgress.episode_number) {
      const targetSeason = Number(matchedProgress.season_number);
      const targetEpisode = Number(matchedProgress.episode_number);
      const targetEp = allEpisodes.find(
        (ep: any) =>
          Number(ep.ParentIndexNumber ?? ep.season_number) === targetSeason &&
          Number(ep.IndexNumber ?? ep.episode_number) === targetEpisode
      );
      if (targetEp) return buildEpisodePlayPayload(targetEp);
    }

    const episode = episodes[0] || allEpisodes[0];
    if (episode) return buildEpisodePlayPayload(episode);
    return { ...media, type: 'tv' as const };
  };

  const handlePlayOnTv = () => {
    setPlayOnTvMedia(resolvePlayPayloadForTv());
    setPlayOnTvVisible(true);
  };

  const handleStartWatchParty = async () => {
    if (!user) return;
    try {
      const room = await createWatchPartyRoom(user, activeProfile, media, 0, true);
      openWatchParty(room);
    } catch (e) {
      console.warn('Watch party create error:', e);
    }
  };

  // ─── ÇEVRİMDIŞI İNDİRME ENTEGRASYONU ──────────────────────────────
  const [downloadInfo, setDownloadInfo] = useState<DownloadItem | null>(null);
  const [downloadedEpisodeMap, setDownloadedEpisodeMap] = useState<Record<string, string>>({});

  const cleanTmdbId = extractCleanTmdbId(media);
  const currentSeason = isMovie
    ? 1
    : Number(typeof activeSeason === 'object' ? activeSeason?.season_number : activeSeason) || 1;
  const currentEpisode = isMovie ? 1 : (Number(episodes[0]?.episode_number) || 1);
  const downloadKey = isMovie
    ? `movie_${cleanTmdbId}`
    : `tv_${cleanTmdbId}_s${currentSeason}_e${currentEpisode}`;

  useEffect(() => {
    const unsub = subscribeToDownloads((items) => {
      const found = items.find((d) => d.id === downloadKey);
      setDownloadInfo(found ? { ...found } : null);

      const map: Record<string, string> = {};
      items.forEach((item) => {
        map[item.id] = item.status;
      });
      setDownloadedEpisodeMap({ ...map });
    });
    return () => unsub();
  }, [downloadKey]);

  const handleDownload = async () => {
    if (downloadInfo?.status === 'completed') {
      Alert.alert(
        'İndirme Yönetimi',
        `"${media.title || media.name}" cihazınıza indirilmiş durumda.`,
        [
          { text: 'Kapat', style: 'cancel' },
          {
            text: 'İndirmeyi Sil',
            style: 'destructive',
            onPress: () => deleteDownload(downloadKey),
          },
        ]
      );
      return;
    }

    if (downloadInfo?.status === 'downloading') {
      Alert.alert('İndiriliyor', 'İndirme arka planda güvenle devam ediyor.');
      return;
    }

    try {
      Alert.alert('İndirme Başlatılıyor', 'Video akış kaynağı hazırlanıyor, arka planda güvenle indirilecek.');
      let streamUrl = media.savedStreamUrl || media.StreamUrl;
      if (!streamUrl) {
        const cleanBaseUrl = (API_BASE_URL || 'https://maxen.sbs').replace(/\/api\/?$/, '').replace(/\/$/, '');
        const directResult = await resolveParallelDirectStreamResult({
          tmdbId: cleanTmdbId,
          isMovie,
          seasonNum: currentSeason,
          episodeNum: currentEpisode,
          cleanBaseUrl,
          timeoutMs: 6000,
        });
        if (directResult?.streamUrl) {
          streamUrl = directResult.streamUrl;
        }
      }

      if (!streamUrl) {
        Alert.alert('Hata', 'İndirilecek video akış kaynağı bulunamadı.');
        return;
      }

      await queueDownload({
        id: downloadKey,
        tmdbId: cleanTmdbId,
        type: isMovie ? 'movie' : 'tv',
        title: isMovie
          ? (media.title || media.name)
          : `${media.title || media.name} - S${currentSeason}B${currentEpisode}`,
        show_title: media.title || media.name,
        season_number: currentSeason,
        episode_number: currentEpisode,
        posterUrl: media.posterUrl || (media.poster_path ? `https://image.tmdb.org/t/p/w500${media.poster_path}` : null),
        backdropUrl: media.backdropUrl,
        streamUrl,
      });
    } catch (e: any) {
      Alert.alert('Hata', e.message || 'İndirme başlatılamadı.');
    }
  };

  const handleDownloadEpisode = async (episode: any) => {
    const sNum = Number(episode.season_number ?? (typeof activeSeason === 'object' ? activeSeason?.season_number : activeSeason) ?? 1);
    const epNum = Number(episode.episode_number ?? 1);
    const epDownloadKey = `tv_${cleanTmdbId}_s${sNum}_e${epNum}`;

    if (downloadedEpisodeMap[epDownloadKey] === 'completed') {
      Alert.alert(
        'Bölüm İndirilmiş',
        `"${media.title || media.name} S${sNum}:B${epNum}" zaten cihazınızda kayıtlı.`,
        [
          { text: 'Kapat', style: 'cancel' },
          {
            text: 'İndirmeyi Sil',
            style: 'destructive',
            onPress: () => deleteDownload(epDownloadKey),
          },
        ]
      );
      return;
    }

    try {
      Alert.alert('İndirme Başlatılıyor', `${media.title || media.name} S${sNum}:B${epNum} hazırlanıyor, arka planda indirilecek.`);
      const cleanBaseUrl = (API_BASE_URL || 'https://maxen.sbs').replace(/\/api\/?$/, '').replace(/\/$/, '');
      const directResult = await resolveParallelDirectStreamResult({
        tmdbId: cleanTmdbId,
        isMovie: false,
        seasonNum: sNum,
        episodeNum: epNum,
        cleanBaseUrl,
        timeoutMs: 6000,
      });

      if (!directResult?.streamUrl) {
        Alert.alert('Hata', 'İndirilecek bölüm akış kaynağı bulunamadı.');
        return;
      }

      await queueDownload({
        id: epDownloadKey,
        tmdbId: cleanTmdbId,
        type: 'tv',
        title: `${media.title || media.name} - S${sNum}:B${epNum} ${episode.name || ''}`.trim(),
        show_title: media.title || media.name,
        season_number: sNum,
        episode_number: epNum,
        posterUrl: episode.still_path
          ? `https://image.tmdb.org/t/p/w500${episode.still_path}`
          : media.posterUrl || (media.poster_path ? `https://image.tmdb.org/t/p/w500${media.poster_path}` : null),
        backdropUrl: media.backdropUrl,
        streamUrl: directResult.streamUrl,
      });
    } catch (e: any) {
      Alert.alert('Hata', e.message || 'Bölüm indirmesi başlatılamadı.');
    }
  };

  /*
   * ============================================================
   * TV VIEW
   * ============================================================
   */
  if (isTV) {
    return (
      <Animated.View style={[styles.containerTV, { opacity: fadeAnim }]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        {/* BACKDROP */}
        <View pointerEvents="none" style={styles.tvHeroBackground}>
          <Image
            source={backdropSource}
            style={styles.tvHeroImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />

          <LinearGradient
            colors={[
              'rgba(0,0,0,0.98)',
              isMovie ? 'rgba(0,0,0,0.78)' : 'rgba(0,0,0,0.80)',
              isMovie ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.25)',
              isMovie ? 'rgba(0,0,0,0.90)' : 'rgba(0,0,0,0.88)',
              '#000',
            ]}
            locations={[0, isMovie ? 0.28 : 0.30, isMovie ? 0.55 : 0.58, isMovie ? 0.78 : 0.82, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          <LinearGradient
            colors={['rgba(0,0,0,0.95)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </View>

        {/* TOP BAR */}
        <View
          style={[
            styles.tvTopBar,
            {
              paddingHorizontal: isLargeTv ? 72 : 48,
              paddingTop: screenHeight > 900 ? 28 : 18,
            },
          ]}
        >
          <TVFocusable
            ref={closeButtonRef}
            onPress={handleClose}
            style={[styles.tvCloseButton, { minWidth: 56, minHeight: 56 }]}
            focusedStyle={styles.tvCloseButtonFocused}
            nextFocusDown={
              playButtonRef.current ? findNodeHandle(playButtonRef.current) || undefined : undefined
            }
          >
            <Ionicons name="arrow-back" size={30} color="#fff" />
          </TVFocusable>
        </View>

        {/* TV CONTENT: MOVIE vs SERIES */}
        {isMovie ? (
          <ScrollView
            style={styles.tvMainScroll}
            contentContainerStyle={[
              styles.tvMovieContent,
              {
                paddingHorizontal: isLargeTv ? 72 : 48,
                paddingTop: screenHeight > 900 ? 92 : 70,
                paddingBottom: 90,
              },
            ]}
            showsVerticalScrollIndicator={false}
            directionalLockEnabled
            scrollEventThrottle={16}
            nestedScrollEnabled
            overScrollMode="never"
          >
            <DetailHero
              media={media}
              isMovie={true}
              isTV={true}
              styles={styles}
              movieRuntime={movieRuntime}
              seasonsCount={seasons.length}
              genres={genres}
              genreList={genreList}
              movieProgress={movieProgress}
              isFav={isFav}
              isWatchLater={isWatchLaterState}
              userRating={userRating}
              trailerKey={trailerKey}
              playButtonRef={playButtonRef}
              trailerButtonRef={trailerButtonRef}
              favoriteButtonRef={favoriteButtonRef}
              watchLaterButtonRef={watchLaterButtonRef}
              ratingButtonRef={ratingButtonRef}
              closeButtonRef={closeButtonRef}
              actorRefs={actorRefs}
              onPlay={handlePlayMovie}
              onToggleFavorite={handleToggleFavorite}
              onToggleWatchLater={handleToggleWatchLater}
              onOpenRatingModal={() => setIsRatingModalOpen(true)}
              onOpenTrailer={() => setIsTrailerModalOpen(true)}
              onStartWatchParty={handleStartWatchParty}
              onDownload={handleDownload}
              downloadStatus={downloadInfo?.status || 'idle'}
              downloadProgress={downloadInfo?.progress || 0}
            />

            <CastMemberList
              cast={cast}
              isTV={true}
              styles={styles}
              actorRefs={actorRefs}
              playButtonRef={playButtonRef}
              onSelectActor={onSelectActor}
            />

            <RecommendationsGrid
              collectionData={collectionData}
              recommendations={recommendations}
              isTV={true}
              styles={styles}
              theme={theme}
              onSelectMedia={onSelectMedia}
              onPlayMedia={onPlayMedia}
            />
          </ScrollView>
        ) : (
          <View
            style={[
              styles.tvSeriesLayout,
              {
                flex: 1,
                paddingHorizontal: isLargeTv ? 56 : 36,
                columnGap: isLargeTv ? 32 : 24,
              },
            ]}
          >
            {/* LEFT COLUMN */}
            <ScrollView
              style={[styles.tvSeriesLeftScroll, { flex: 1 }]}
              contentContainerStyle={[
                styles.tvSeriesLeftContent,
                {
                  paddingVertical: 24,
                  paddingBottom: 96,
                },
              ]}
              showsVerticalScrollIndicator={false}
              directionalLockEnabled
              nestedScrollEnabled
              overScrollMode="never"
            >
              <DetailHero
                media={media}
                isMovie={false}
                isTV={true}
                styles={styles}
                movieRuntime={movieRuntime}
                seasonsCount={seasons.length}
                genres={genres}
                genreList={genreList}
                movieProgress={movieProgress}
                isFav={isFav}
                isWatchLater={isWatchLaterState}
                userRating={userRating}
                trailerKey={trailerKey}
                playButtonRef={playButtonRef}
                trailerButtonRef={trailerButtonRef}
                favoriteButtonRef={favoriteButtonRef}
                watchLaterButtonRef={watchLaterButtonRef}
                ratingButtonRef={ratingButtonRef}
                closeButtonRef={closeButtonRef}
                actorRefs={actorRefs}
                onPlay={handlePlaySeries}
                onToggleFavorite={handleToggleFavorite}
                onToggleWatchLater={handleToggleWatchLater}
                onOpenRatingModal={() => setIsRatingModalOpen(true)}
                onOpenTrailer={() => setIsTrailerModalOpen(true)}
                onStartWatchParty={handleStartWatchParty}
                onDownload={handleDownload}
                downloadStatus={downloadInfo?.status || 'idle'}
                downloadProgress={downloadInfo?.progress || 0}
              />

              <CastMemberList
                cast={cast}
                isTV={true}
                styles={styles}
                actorRefs={actorRefs}
                playButtonRef={playButtonRef}
                onSelectActor={onSelectActor}
              />

              <RecommendationsGrid
                collectionData={collectionData}
                recommendations={recommendations}
                isTV={true}
                styles={styles}
                theme={theme}
                onSelectMedia={onSelectMedia}
                onPlayMedia={onPlayMedia}
              />
            </ScrollView>

            {/* RIGHT COLUMN (EPISODES) */}
            <View
              style={[
                {
                  flex: isLargeTv ? 0.42 : 0.46,
                  minWidth: isLargeTv ? 560 : 460,
                  maxWidth: isLargeTv ? 760 : 680,
                },
              ]}
            >
              <SeasonEpisodeList
                tmdbId={tmdbId}
                seasons={seasons}
                activeSeason={activeSeason}
                episodes={episodes}
                loadingEpisodes={loadingEpisodes}
                localProgresses={localProgresses}
                isTV={true}
                styles={styles}
                seasonRefs={seasonRefs}
                episodeRefs={episodeRefs}
                firstEpisodeRef={firstEpisodeRef}
                playButtonRef={playButtonRef}
                onSeasonChange={handleSeasonChange}
                onPlayEpisode={handlePlayEpisode}
              />
            </View>
          </View>
        )}

        {/* MODALS */}
        <RatingModal
          visible={isRatingModalOpen}
          onClose={() => setIsRatingModalOpen(false)}
          currentRating={userRating}
          onRate={handleRate}
          mediaTitle={media?.title || media?.name}
        />

        <TrailerModal
          visible={isTrailerModalOpen}
          onClose={() => setIsTrailerModalOpen(false)}
          youtubeKey={trailerKey}
          title={media?.title || media?.name}
        />
      </Animated.View>
    );
  }

  /*
   * ============================================================
   * MOBILE / TABLET / DESKTOP WEB VIEW
   * ============================================================
   */
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 768;

  return (
    <View
      style={[
        styles.container,
        isDesktopWeb && {
          backgroundColor: 'rgba(0, 0, 0, 0.82)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 28,
        },
      ]}
      {...(isDesktopWeb
        ? {
            onClick: (e: any) => {
              if (e.target === e.currentTarget) {
                handleClose();
              }
            },
          }
        : {})}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* MODAL WRAPPER (Desktop Web Netflix Center Dialog) */}
      <View
        style={
          isDesktopWeb
            ? {
                width: '92%',
                maxWidth: 1040,
                height: '95%',
                backgroundColor: '#161616',
                borderRadius: 14,
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.08)',
              }
            : { flex: 1, width: '100%', height: '100%', position: 'relative' }
        }
      >
        {/* PARALLAX HERO BACKDROP */}
        <Animated.View
          style={[
            styles.heroContainer,
            isDesktopWeb && {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 460,
              zIndex: 1,
            },
            {
              transform: [{ translateY: backdropTranslateY }],
              opacity: Animated.multiply(fadeAnim, heroOpacity),
            },
          ]}
        >
          <View style={styles.backdrop}>
            <AnimatedImage
              source={backdropSource}
              style={[styles.backdropImage, { transform: [{ scale: backdropScale }] }]}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />

            <LinearGradient
              colors={['transparent', 'rgba(22,22,22,0.4)', 'rgba(22,22,22,0.85)', '#161616']}
              style={StyleSheet.absoluteFillObject}
            />
          </View>
        </Animated.View>

        {/* MAIN SCROLLABLE CONTENT */}
        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            isDesktopWeb && { paddingTop: 340, paddingBottom: 60 },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
        >
          <View style={[styles.mainContent, isDesktopWeb && { paddingHorizontal: 40 }]}>
            <DetailHero
              media={media}
              isMovie={isMovie}
              isTV={isTV}
              styles={styles}
              movieRuntime={movieRuntime}
              seasonsCount={seasons.length}
              genres={genres}
              genreList={genreList}
              movieProgress={movieProgress}
              isFav={isFav}
              isWatchLater={isWatchLaterState}
              userRating={userRating}
              trailerKey={trailerKey}
              playButtonRef={playButtonRef}
              favoriteButtonRef={favoriteButtonRef}
              watchLaterButtonRef={watchLaterButtonRef}
              ratingButtonRef={ratingButtonRef}
              onPlay={isMovie ? handlePlayMovie : handlePlaySeries}
              onToggleFavorite={handleToggleFavorite}
              onToggleWatchLater={handleToggleWatchLater}
              onOpenRatingModal={() => setIsRatingModalOpen(true)}
              onOpenTrailer={() => setIsTrailerModalOpen(true)}
              onStartWatchParty={handleStartWatchParty}
              onPlayOnTv={handlePlayOnTv}
              onDownload={handleDownload}
              downloadStatus={downloadInfo?.status || 'idle'}
              downloadProgress={downloadInfo?.progress || 0}
            />

            <CastMemberList
              cast={cast}
              isTV={isTV}
              styles={styles}
              genres={genres}
              onSelectActor={onSelectActor}
            />

            {!isMovie && (
              <SeasonEpisodeList
                tmdbId={tmdbId}
                seasons={seasons}
                activeSeason={activeSeason}
                episodes={episodes}
                loadingEpisodes={loadingEpisodes}
                localProgresses={localProgresses}
                isTV={isTV}
                styles={styles}
                onSeasonChange={handleSeasonChange}
                onPlayEpisode={handlePlayEpisode}
                onDownloadEpisode={handleDownloadEpisode}
                downloadedEpisodeKeys={downloadedEpisodeMap}
              />
            )}

            <RecommendationsGrid
              collectionData={collectionData}
              recommendations={recommendations}
              isTV={isTV}
              styles={styles}
              theme={theme}
              onSelectMedia={onSelectMedia}
              onPlayMedia={onPlayMedia}
            />
          </View>
        </Animated.ScrollView>

        {/* TOP BAR / BACK BUTTON / CLOSE BUTTON */}
        <View
          style={[
            styles.topBar,
            isDesktopWeb && {
              position: 'absolute',
              top: 18,
              right: 18,
              left: 'auto',
              zIndex: 60,
            },
          ]}
          pointerEvents="box-none"
        >
          <TVFocusable
            ref={closeButtonRef}
            onPress={handleClose}
            style={[
              styles.closeButton,
              isDesktopWeb && {
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: 'rgba(20, 20, 20, 0.85)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.15)',
              },
            ]}
            focusedStyle={{
              backgroundColor: theme.primary,
              transform: [{ scale: 1.1 }],
              borderRadius: 22,
            }}
          >
            <Ionicons name={isDesktopWeb ? "close" : "arrow-back"} size={isDesktopWeb ? 22 : 28} color="#fff" />
          </TVFocusable>
        </View>
      </View>

      {/* MODALS */}
      <RatingModal
        visible={isRatingModalOpen}
        onClose={() => setIsRatingModalOpen(false)}
        currentRating={userRating}
        onRate={handleRate}
        mediaTitle={media?.title || media?.name}
      />

      <TrailerModal
        visible={isTrailerModalOpen}
        onClose={() => setIsTrailerModalOpen(false)}
        youtubeKey={trailerKey}
        title={media?.title || media?.name}
      />

      <PlayOnTvModal
        visible={playOnTvVisible}
        media={playOnTvMedia}
        profileId={profileId}
        onClose={() => setPlayOnTvVisible(false)}
      />
    </View>
  );
}
