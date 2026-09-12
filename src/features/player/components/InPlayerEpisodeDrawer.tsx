import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { TMDB_BASE_URL, TMDB_IMAGE_BASE_URL } from '@/config/tmdb';
import { formatEpisodeTitle } from '@/utils/episodeUtils';
import { TVFocusable } from '@/components/TVFocusable';
import { requestTVFocus } from '@/utils/tvNodeHandle';

const isTV = Platform.isTV;

export interface InPlayerEpisodeDrawerProps {
  visible: boolean;
  onClose: () => void;
  tmdbId: string | number;
  currentSeason: number;
  currentEpisode: number;
  showTitle?: string;
  onSelectEpisode: (episode: any) => void;
}

export function InPlayerEpisodeDrawer({
  visible,
  onClose,
  tmdbId,
  currentSeason,
  currentEpisode,
  showTitle,
  onSelectEpisode,
}: InPlayerEpisodeDrawerProps) {
  const { width, height } = useWindowDimensions();
  const isDesktopOrTv = isTV || width > 768;

  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(currentSeason || 1);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [episodesCache, setEpisodesCache] = useState<Record<number, any[]>>({});

  const firstEpisodeRef = useRef<any>(null);

  // 1. Fetch seasons when drawer opens
  useEffect(() => {
    if (!visible || !tmdbId) return;

    let isMounted = true;
    const fetchShowDetails = async () => {
      try {
        const res = await fetch(`${TMDB_BASE_URL}/tv/${tmdbId}?language=tr-TR`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.seasons && isMounted) {
          const validSeasons = data.seasons.filter((s: any) => s.season_number > 0);
          setSeasons(validSeasons.length > 0 ? validSeasons : data.seasons);
        }
      } catch (err) {
        console.warn('[InPlayerEpisodeDrawer] Show details error:', err);
      }
    };

    fetchShowDetails();
    return () => {
      isMounted = false;
    };
  }, [visible, tmdbId]);

  // 2. Fetch episodes for selected season
  useEffect(() => {
    if (!visible || !tmdbId || !selectedSeason) return;

    if (episodesCache[selectedSeason]) {
      setEpisodes(episodesCache[selectedSeason]);
      return;
    }

    let isMounted = true;
    const fetchEpisodes = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${TMDB_BASE_URL}/tv/${tmdbId}/season/${selectedSeason}?language=tr-TR`
        );
        if (!res.ok) throw new Error('Episodes fetch failed');
        const data = await res.json();
        if (data?.episodes && isMounted) {
          setEpisodes(data.episodes);
          setEpisodesCache((prev) => ({ ...prev, [selectedSeason]: data.episodes }));
        }
      } catch (err) {
        console.warn('[InPlayerEpisodeDrawer] Episodes error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchEpisodes();
    return () => {
      isMounted = false;
    };
  }, [visible, tmdbId, selectedSeason]);

  // TV focus on active episode or first episode when loaded
  useEffect(() => {
    if (visible && isTV && episodes.length > 0) {
      const timer = setTimeout(() => {
        requestTVFocus(firstEpisodeRef);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [visible, episodes]);

  if (!visible) return null;

  return (
    <View style={styles.overlayContainer}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View
        style={[
          styles.drawerPanel,
          isDesktopOrTv ? styles.drawerPanelSide : styles.drawerPanelBottom,
          isDesktopOrTv ? { width: Math.min(width * 0.42, 460) } : { maxHeight: height * 0.82 },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitles}>
            <Text style={styles.headerMainTitle}>Bölümler</Text>
            {showTitle ? (
              <Text style={styles.headerSubTitle} numberOfLines={1}>
                {showTitle}
              </Text>
            ) : null}
          </View>
          <TVFocusable
            style={styles.closeBtn}
            focusedStyle={styles.closeBtnFocused}
            onPress={onClose}
            accessibilityLabel="Kapat"
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TVFocusable>
        </View>

        {/* Season Selector Tabs */}
        {seasons.length > 1 && (
          <View style={styles.seasonBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasonList}>
              {seasons.map((s) => {
                const sNum = s.season_number;
                const isSelected = sNum === selectedSeason;
                return (
                  <TVFocusable
                    key={`season-${sNum}`}
                    style={[styles.seasonTab, isSelected && styles.seasonTabActive]}
                    focusedStyle={styles.seasonTabFocused}
                    onPress={() => setSelectedSeason(sNum)}
                  >
                    <Text style={[styles.seasonTabTxt, isSelected && styles.seasonTabTxtActive]}>
                      {s.name || `${sNum}. Sezon`}
                    </Text>
                  </TVFocusable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Episode Content */}
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#E50914" />
            <Text style={styles.loaderTxt}>Bölümler yükleniyor...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.episodeScroll}
            contentContainerStyle={styles.episodeListContainer}
            showsVerticalScrollIndicator={false}
          >
            {episodes.map((ep, idx) => {
              const epNum = ep.episode_number ?? idx + 1;
              const isCurrent =
                selectedSeason === currentSeason && epNum === currentEpisode;
              const formattedTitle = formatEpisodeTitle(epNum, ep.name);
              const thumbUrl = ep.still_path
                ? `${TMDB_IMAGE_BASE_URL}/w300${ep.still_path}`
                : null;

              return (
                <TVFocusable
                  key={`ep-${ep.id || epNum}`}
                  ref={idx === 0 || isCurrent ? firstEpisodeRef : null}
                  style={[styles.episodeCard, isCurrent && styles.episodeCardCurrent]}
                  focusedStyle={styles.episodeCardFocused}
                  onPress={() => {
                    onSelectEpisode({
                      ...ep,
                      season_number: selectedSeason,
                      episode_number: epNum,
                    });
                    onClose();
                  }}
                >
                  <View style={styles.thumbContainer}>
                    {thumbUrl ? (
                      <Image
                        source={{ uri: thumbUrl }}
                        style={styles.thumbnail}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <View style={styles.thumbFallback}>
                        <Ionicons name="film-outline" size={24} color="#666" />
                      </View>
                    )}
                    <View style={styles.playOverlay}>
                      <Ionicons
                        name={isCurrent ? 'radio-button-on' : 'play-circle'}
                        size={isCurrent ? 22 : 28}
                        color={isCurrent ? '#E50914' : 'rgba(255,255,255,0.85)'}
                      />
                    </View>
                  </View>

                  <View style={styles.metaContainer}>
                    <View style={styles.titleRow}>
                      <Text
                        style={[styles.episodeTitle, isCurrent && styles.episodeTitleCurrent]}
                        numberOfLines={1}
                      >
                        {formattedTitle}
                      </Text>
                      {isCurrent && (
                        <View style={styles.nowPlayingBadge}>
                          <Text style={styles.nowPlayingTxt}>OYNATILIYOR</Text>
                        </View>
                      )}
                    </View>
                    {ep.runtime ? (
                      <Text style={styles.runtimeTxt}>{ep.runtime} dk</Text>
                    ) : null}
                    {ep.overview ? (
                      <Text style={styles.overviewTxt} numberOfLines={2}>
                        {ep.overview}
                      </Text>
                    ) : null}
                  </View>
                </TVFocusable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  drawerPanel: {
    backgroundColor: '#0F0F14',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 24,
  },
  drawerPanelSide: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.12)',
  },
  drawerPanelBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitles: {
    flex: 1,
    marginRight: 12,
  },
  headerMainTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  headerSubTitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnFocused: {
    backgroundColor: '#E50914',
    transform: [{ scale: 1.1 }],
  },
  seasonBar: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  seasonList: {
    gap: 8,
  },
  seasonTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  seasonTabActive: {
    backgroundColor: '#E50914',
  },
  seasonTabFocused: {
    borderWidth: 2,
    borderColor: '#fff',
    transform: [{ scale: 1.05 }],
  },
  seasonTabTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: '#aaa',
  },
  seasonTabTxtActive: {
    color: '#fff',
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loaderTxt: {
    color: '#888',
    fontSize: 13,
    marginTop: 12,
  },
  episodeScroll: {
    flex: 1,
  },
  episodeListContainer: {
    padding: 16,
    gap: 12,
  },
  episodeCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 8,
    gap: 12,
  },
  episodeCardCurrent: {
    borderColor: '#E50914',
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
  },
  episodeCardFocused: {
    borderColor: '#E50914',
    borderWidth: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    transform: [{ scale: isTV ? 1.03 : 1 }],
  },
  thumbContainer: {
    width: 110,
    height: 64,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#202028',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  episodeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  episodeTitleCurrent: {
    color: '#FF4D58',
  },
  nowPlayingBadge: {
    backgroundColor: '#E50914',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  nowPlayingTxt: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  runtimeTxt: {
    fontSize: 11,
    color: '#777',
    marginTop: 2,
  },
  overviewTxt: {
    fontSize: 11,
    color: '#999',
    marginTop: 3,
    lineHeight: 15,
  },
});
