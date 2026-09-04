import { StyleSheet, Platform } from 'react-native';

export const getStyles = (
  width: number,
  height: number,
  isTablet: boolean
) =>
  StyleSheet.create({
    /*
     * ========================================================
     * MOBILE
     * ========================================================
     */

    container: {
      flex: 1,
      backgroundColor: '#000',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 999,
    },

    heroContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: isTablet
        ? height * 0.7
        : height * 0.48,
      zIndex: 1,
    },

    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },

    backdropImage: {
      width: '100%',
      height: '100%',
    },

    topBar: {
      position: 'absolute',
      top:
        Platform.OS === 'ios'
          ? 60
          : 40,
      left: 20,
      right: 20,
      flexDirection: 'row',
      alignItems: 'center',
      zIndex: 50,
    },

    closeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor:
        'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },

    scrollView: {
      flex: 1,
      zIndex: 2,
    },

    scrollContent: {
      paddingTop: isTablet
        ? height * 0.45
        : height * 0.32,
      paddingBottom: 60,
    },

    mainContent: {
      paddingHorizontal:
        isTablet ? 32 : 18,
    },

    categoryBadge: {
      fontSize: 12,
      color: '#E50914',
      fontWeight: '800',
      letterSpacing: 2,
      marginBottom: 6,
    },

    title: {
      fontSize: isTablet ? 48 : 28,
      lineHeight: isTablet ? 56 : 34,
      fontWeight: '900',
      color: '#fff',
      marginBottom: 10,
      includeFontPadding: false,
    },

    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 18,
      flexWrap: 'wrap',
    },

    ratingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        'rgba(255,255,255,0.15)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      marginRight: 12,
    },

    ratingText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '800',
      marginLeft: 4,
    },

    metaText: {
      color: '#ccc',
      fontSize: 13,
      fontWeight: '600',
    },

    metaDivider: {
      color: '#666',
      marginHorizontal: 8,
      fontSize: 13,
    },

    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
    },

    playButton: {
      backgroundColor: '#fff',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      paddingVertical: 11,
      borderRadius: 6,
      gap: 8,
    },

    playButtonFocused: {
      backgroundColor: '#E50914',
      transform: [
        {
          scale: 1.05,
        },
      ],
    },

    playButtonText: {
      color: '#000',
      fontSize: 18,
      fontWeight: '900',
    },

    trailerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.16)',
      paddingHorizontal: 20,
      paddingVertical: 11,
      borderRadius: 6,
      gap: 8,
      marginLeft: 10,
    },

    trailerButtonText: {
      color: '#fff',
      fontSize: 17,
      fontWeight: '800',
    },

    overview: {
      fontSize: isTablet
        ? 16
        : 13.5,
      lineHeight: isTablet
        ? 24
        : 19,
      color: '#ddd',
      marginBottom: 20,
      maxWidth: isTablet
        ? '70%'
        : '100%',
    },

    infoBlock: {
      marginBottom: 40,
      gap: 6,
    },

    infoLine: {
      fontSize: 13,
      color: '#999',
      lineHeight: 18,
    },

    infoLabel: {
      color: '#666',
      fontWeight: '600',
    },

    castContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
    },

    castList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      flex: 1,
    },

    actorButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 4,
      marginBottom: 2,
    },

    actorThumb: {
      width: 20,
      height: 20,
      borderRadius: 10,
      marginRight: 4,
    },

    actorLink: {
      color: '#1a73e8',
      fontSize: 13,
      fontWeight: '500',
    },

    episodesSection: {
      marginTop: 10,
    },

    episodesHeader: {
      marginBottom: 24,
    },

    sectionTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: '#fff',
      marginBottom: 20,
    },

    seasonsScroll: {
      flexDirection: 'row',
    },

    seasonTab: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      marginRight: 12,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: '#333',
      backgroundColor:
        'rgba(255,255,255,0.05)',
    },

    seasonTabActive: {
      backgroundColor: '#E50914',
      borderColor: '#E50914',
    },

    seasonTabFocused: {
      borderColor: '#fff',
      transform: [
        {
          scale: 1.05,
        },
      ],
    },

    seasonTabText: {
      color: '#999',
      fontSize: 18,
      fontWeight: '700',
    },

    seasonTabTextActive: {
      color: '#fff',
    },

    episodesList: {
      gap: 16,
    },

    episodeCard: {
      backgroundColor:
        'rgba(255,255,255,0.03)',
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: 'transparent',
    },

    episodeCardFocused: {
      backgroundColor:
        'rgba(255,255,255,0.08)',
      borderColor:
        'rgba(255,255,255,0.2)',
      transform: [
        {
          scale: 1.01,
        },
      ],
    },

    epCardMain: {
      flexDirection: 'row',
      gap: 16,
    },

    epThumb: {
      width: 140,
      height: 80,
      borderRadius: 6,
      backgroundColor: '#222',
    },

    epInfo: {
      flex: 1,
      justifyContent: 'center',
    },

    epTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: '#fff',
      marginBottom: 4,
    },

    epMeta: {
      color: '#E50914',
      fontSize: 12,
      fontWeight: '700',
    },

    epOverview: {
      fontSize: 13,
      color: '#888',
      lineHeight: 18,
    },

    movieProgressBarContainer: {
      height: 4,
      backgroundColor:
        'rgba(255,255,255,0.2)',
      borderRadius: 2,
      marginTop: 8,
      overflow: 'hidden',
    },

    movieProgressBar: {
      height: '100%',
      backgroundColor: '#E50914',
    },

    epProgressBarContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 4,
      backgroundColor:
        'rgba(255,255,255,0.2)',
      overflow: 'hidden',
    },

    epProgressBar: {
      height: '100%',
      backgroundColor: '#E50914',
    },

    /*
     * ========================================================
     * TV
     * ========================================================
     */

    containerTV: {
      flex: 1,
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 999,
      backgroundColor: '#000',
    },

    tvHeroBackground: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 0,
    },

    tvHeroImage: {
      position: 'absolute',
      right: 0,
      top: 0,
      width: '72%',
      height: '100%',
    },

    tvTopBar: {
      position: 'absolute',
      top: 32,
      left: 42,
      zIndex: 100,
    },

    tvCloseButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor:
        'rgba(0,0,0,0.65)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.12)',
    },

    tvCloseButtonFocused: {
      backgroundColor: '#E50914',
      borderColor: '#fff',
      transform: [
        {
          scale: 1.08,
        },
      ],
    },

    /*
     * MOVIE
     */

    tvMainScroll: {
      flex: 1,
      zIndex: 2,
    },

    tvMovieContent: {
      paddingTop: 100,
      paddingLeft: 70,
      paddingRight: 70,
      paddingBottom: 80,
    },

    tvMovieInfo: {
      width: '62%',
      maxWidth: 1000,
    },

    tvCategory: {
      color: '#E50914',
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 2,
      marginBottom: 8,
    },

    tvMovieTitle: {
      color: '#fff',
      fontSize: 44,
      lineHeight: 52,
      fontWeight: '900',
      marginBottom: 12,
      maxWidth: 800,
    },

    tvSeriesTitle: {
      color: '#fff',
      fontSize: 44,
      lineHeight: 52,
      fontWeight: '900',
      marginBottom: 12,
    },

    tvMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 16,
    },

    tvRatingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        'rgba(255,255,255,0.13)',
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 6,
      gap: 5,
    },

    tvRatingText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '800',
    },

    tvMetaText: {
      color: '#ccc',
      fontSize: 17,
      fontWeight: '600',
    },

    tvMetaDot: {
      color: '#777',
      fontSize: 18,
    },

    tvGenreRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 18,
    },

    tvGenrePill: {
      backgroundColor:
        'rgba(255,255,255,0.10)',
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },

    tvGenreText: {
      color: '#ddd',
      fontSize: 13,
      fontWeight: '600',
    },

    tvActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 6,
      marginBottom: 18,
    },

    tvSeriesActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 18,
    },

    tvPlayButton: {
      minWidth: 160,
      height: 48,
      paddingHorizontal: 24,
      borderRadius: 6,
      backgroundColor: '#fff',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },

    tvPlayButtonFocused: {
      backgroundColor: '#FFFFFF',
      borderWidth: 2.5,
      borderColor: '#E50914',
      shadowColor: '#E50914',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 10,
      elevation: 10,
      transform: [
        {
          scale: 1.06,
        },
      ],
    },

    tvPlayText: {
      color: '#000',
      fontSize: 16,
      fontWeight: '800',
    },

    tvTrailerButton: {
      minWidth: 150,
      height: 48,
      paddingHorizontal: 20,
      borderRadius: 6,
      backgroundColor: 'rgba(255,255,255,0.16)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginLeft: 12,
    },

    tvTrailerButtonFocused: {
      backgroundColor: 'rgba(255,255,255,0.3)',
      borderWidth: 3,
      borderColor: '#FFFFFF',
      shadowColor: '#FFFFFF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 10,
      elevation: 12,
      transform: [{ scale: 1.08 }],
    },

    tvTrailerText: {
      color: '#fff',
      fontSize: 21,
      fontWeight: '800',
    },

    tvFavoriteButton: {
      minWidth: 190,
      height: 54,
      paddingHorizontal: 24,
      borderRadius: 8,
      backgroundColor:
        'rgba(255,255,255,0.13)',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.18)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },

    tvFavoriteActive: {
      backgroundColor: '#E50914',
      borderColor: '#E50914',
    },

    tvFavoriteFocused: {
      borderWidth: 3,
      borderColor: '#FFFFFF',
      shadowColor: '#FFFFFF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 10,
      elevation: 12,
      transform: [
        {
          scale: 1.08,
        },
      ],
    },

    tvFavoriteText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '800',
    },

    tvMovieProgressContainer: {
      width: 380,
      height: 5,
      backgroundColor:
        'rgba(255,255,255,0.20)',
      borderRadius: 3,
      overflow: 'hidden',
      marginTop: -10,
      marginBottom: 22,
    },

    tvMovieProgress: {
      height: '100%',
      backgroundColor: '#E50914',
    },

    tvOverview: {
      color: '#ddd',
      fontSize: 18,
      lineHeight: 28,
      maxWidth: 850,
      marginBottom: 26,
    },

    /*
     * CAST
     */

    tvCastSection: {
      marginTop: 12,
      marginBottom: 20,
    },

    tvSectionLabel: {
      color: '#999',
      fontSize: 15,
      fontWeight: '900',
      letterSpacing: 2,
      marginBottom: 12,
    },

    tvActorCard: {
      width: 105,
      marginRight: 15,
      alignItems: 'center',
      padding: 6,
      borderRadius: 8,
    },

    tvActorFocused: {
      backgroundColor:
        'rgba(255,255,255,0.10)',
      transform: [
        {
          scale: 1.04,
        },
      ],
    },

    tvActorImageWrapper: {
      width: 72,
      height: 72,
      borderRadius: 36,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'transparent',
      marginBottom: 7,
    },

    tvActorImageFocused: {
      borderColor: '#E50914',
    },

    tvActorImage: {
      width: '100%',
      height: '100%',
    },

    tvActorPlaceholder: {
      backgroundColor: '#222',
      justifyContent: 'center',
      alignItems: 'center',
    },

    tvActorName: {
      color: '#bbb',
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
    },

    tvActorNameFocused: {
      color: '#fff',
    },

    /*
     * SERIES LAYOUT
     */

    tvSeriesLayout: {
      flex: 1,
      zIndex: 2,
      flexDirection: 'row',
      paddingTop: 90,
      paddingLeft: 70,
      paddingRight: 55,
      paddingBottom: 40,
      gap: 42,
    },

    tvSeriesLeftScroll: {
      width: '43%',
    },

    tvSeriesLeftContent: {
      paddingBottom: 60,
      paddingRight: 20,
    },

    tvEpisodePanel: {
      flex: 1,
      minWidth: 0,
    },

    tvSeasonHeader: {
      paddingBottom: 14,
    },

    tvEpisodeTitle: {
      color: '#fff',
      fontSize: 26,
      fontWeight: '900',
      marginBottom: 15,
    },

    tvSeasonTab: {
      height: 42,
      paddingHorizontal: 18,
      borderRadius: 7,
      marginRight: 9,
      justifyContent: 'center',
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.16)',
      backgroundColor:
        'rgba(255,255,255,0.06)',
    },

    tvSeasonActive: {
      backgroundColor: '#E50914',
      borderColor: '#E50914',
    },

    tvSeasonFocused: {
      borderColor: '#fff',
      transform: [
        {
          scale: 1.06,
        },
      ],
    },

    tvSeasonText: {
      color: '#aaa',
      fontSize: 16,
      fontWeight: '800',
    },

    tvSeasonTextActive: {
      color: '#fff',
    },

    tvEpisodeScroll: {
      flex: 1,
    },

    tvEpisodeContent: {
      paddingTop: 4,
      paddingBottom: 60,
      gap: 10,
    },

    tvEpisodeCard: {
      width: '100%',
      minHeight: 104,
      padding: 10,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: 'transparent',
      backgroundColor:
        'rgba(255,255,255,0.045)',
    },

    tvEpisodeFocused: {
      backgroundColor:
        'rgba(255,255,255,0.12)',
      borderColor:
        'rgba(255,255,255,0.45)',
      transform: [
        {
          scale: 1.015,
        },
      ],
    },

    tvEpisodeMain: {
      flexDirection: 'row',
      gap: 14,
    },

    tvEpisodeThumbWrapper: {
      width: 170,
      height: 96,
      borderRadius: 6,
      overflow: 'hidden',
      backgroundColor: '#151515',
    },

    tvEpisodeThumb: {
      width: '100%',
      height: '100%',
    },

    tvEpisodePlayOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor:
        'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
    },

    tvEpisodeProgressContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 4,
      backgroundColor:
        'rgba(255,255,255,0.25)',
    },

    tvEpisodeProgress: {
      height: '100%',
      backgroundColor: '#E50914',
    },

    tvEpisodeInfo: {
      flex: 1,
      justifyContent: 'center',
      minWidth: 0,
    },

    tvEpisodeName: {
      color: '#fff',
      fontSize: 19,
      fontWeight: '800',
      marginBottom: 5,
    },

    tvEpisodeNameFocused: {
      color: '#fff',
    },

    tvEpisodeRuntime: {
      color: '#E50914',
      fontSize: 12,
      fontWeight: '800',
      marginBottom: 5,
    },

    tvEpisodeOverview: {
      color: '#999',
      fontSize: 13,
      lineHeight: 18,
    },

    tvLoadingEpisodes: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },

    recSection: {
      marginTop: 28,
      marginBottom: 8,
    },
    recTitle: {
      fontSize: isTablet ? 20 : 16,
      fontWeight: '800',
      color: '#fff',
      marginBottom: 12,
      letterSpacing: 0.5,
    },
    recCard: {
      width: isTablet ? 140 : 110,
      marginRight: 14,
    },
    recPoster: {
      width: '100%',
      height: isTablet ? 210 : 165,
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    recMovieTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: '#ddd',
      marginTop: 6,
    },
    recRating: {
      fontSize: 11,
      fontWeight: '700',
      color: '#E50914',
      marginTop: 2,
    },

    tvRecCard: {
      width: 140,
      marginRight: 16,
      borderRadius: 8,
      padding: 4,
    },
    tvRecCardFocused: {
      transform: [{ scale: 1.08 }],
      backgroundColor: 'rgba(255,255,255,0.15)',
    },
    tvRecPoster: {
      width: '100%',
      height: 210,
      borderRadius: 6,
      backgroundColor: '#151515',
    },
    tvRecTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: '#fff',
      marginTop: 6,
    },
  });
