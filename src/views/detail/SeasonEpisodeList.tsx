import { TVEpisodePanel } from './TVEpisodePanel';
import React from 'react';
import { getEpisodeProgress } from '@/utils/watchProgress';
import {
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { TVFocusable } from '@/components/TVFocusable';
import { TMDB_IMAGE_BASE_URL } from '@/config/tmdb';
import { streamPreheater } from '@/features/player/services';

export interface SeasonEpisodeListProps {
  tmdbId?: string | number | null;
  seasons: any[];
  activeSeason: any;
  episodes: any[];
  loadingEpisodes: boolean;
  localProgresses: any[];
  isTV: boolean;
  styles: any;
  seasonRefs?: any;
  episodeRefs?: any;
  firstEpisodeRef?: any;
  playButtonRef?: any;
  onFirstFocusableResolved?: (nodeId: number) => void;
  onSeasonChange: (season: any) => void;
  onPlayEpisode: (episode: any) => void;
  onDownloadEpisode?: (episode: any) => void;
  downloadedEpisodeKeys?: Record<string, string>;
}

import { formatEpisodeTitle } from '@/utils/episodeUtils';
export { formatEpisodeTitle };

export function SeasonEpisodeList({
  tmdbId,
  seasons,
  activeSeason,
  episodes,
  loadingEpisodes,
  localProgresses,
  isTV,
  styles,
  seasonRefs,
  episodeRefs,
  firstEpisodeRef,
  playButtonRef,
  onFirstFocusableResolved,
  onSeasonChange,
  onPlayEpisode,
  onDownloadEpisode,
  downloadedEpisodeKeys,
}: SeasonEpisodeListProps) {
  const targetTmdbId = tmdbId || episodes?.[0]?.show_id || episodes?.[0]?.tmdbId;

  React.useEffect(() => {
    if (isTV || !episodes || episodes.length === 0) return;
    if (!targetTmdbId) return;

    // Preheat first episode
    const ep0 = episodes[0];
    const s0 =
      ep0.season_number ??
      ep0.ParentIndexNumber ??
      activeSeason?.season_number ??
      activeSeason?.IndexNumber ??
      1;
    const e0 = ep0.episode_number ?? ep0.IndexNumber ?? 1;
    const key0 = streamPreheater.generateKey(targetTmdbId, 'tv', s0, e0);
    if (!streamPreheater.has(key0)) {
      streamPreheater.preheat(targetTmdbId, 'tv', s0, e0).catch(() => {});
    }

    // Preheat second episode if available
    if (episodes.length > 1) {
      const ep1 = episodes[1];
      const s1 =
        ep1.season_number ??
        ep1.ParentIndexNumber ??
        activeSeason?.season_number ??
        activeSeason?.IndexNumber ??
        1;
      const e1 = ep1.episode_number ?? ep1.IndexNumber ?? 2;
      const key1 = streamPreheater.generateKey(targetTmdbId, 'tv', s1, e1);
      if (!streamPreheater.has(key1)) {
        streamPreheater.preheat(targetTmdbId, 'tv', s1, e1).catch(() => {});
      }
    }
  }, [episodes, tmdbId, activeSeason]);
  /*
   * ============================================================
   * TV EPISODE PANEL
   * ============================================================
   */
  const seasonScrollRef = React.useRef<ScrollView>(null);
  const activeSeasonNumber = Number(activeSeason?.season_number ?? activeSeason?.IndexNumber ?? 1);

  const getEpisodeId = React.useCallback((episode: any) => String(episode?.Id ?? episode?.id ?? ''), []);
  const getEpisodeNumber = React.useCallback((episode: any, index: number) =>
    Number(episode?.episode_number ?? episode?.IndexNumber ?? index + 1), []);
  const getProgress = React.useCallback((episode: any) => {
    return getEpisodeProgress(localProgresses, targetTmdbId, episode, activeSeasonNumber);
  }, [targetTmdbId, activeSeasonNumber, localProgresses]);

  if (isTV) return <TVEpisodePanel {...{
  tmdbId,
  seasons,
  activeSeason,
  episodes,
  loadingEpisodes,
  localProgresses,
  isTV,
  styles,
  seasonRefs,
  episodeRefs,
  firstEpisodeRef,
  playButtonRef,
  onFirstFocusableResolved,
  onSeasonChange,
  onPlayEpisode,
  onDownloadEpisode,
  downloadedEpisodeKeys,
}} />;

  /*
   * ============================================================
   * MOBILE EPISODES SECTION
   * ============================================================
   */
  return (
    <View style={styles.episodesSection}>
      <View style={styles.episodesHeader}>
        <ThemedText style={styles.sectionTitle}>Bölümler</ThemedText>

        {seasons.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {seasons.map((season, index) => {
              const seasonNum =
                season.IndexNumber || season.season_number;
              const activeNum =
                activeSeason?.IndexNumber || activeSeason?.season_number;
              const active = seasonNum === activeNum;

              return (
                <TVFocusable
                  key={
                    season.Id ||
                    season.id ||
                    `s-${seasonNum}-${index}`
                  }
                  onPress={() => onSeasonChange(season)}
                  style={[
                    styles.seasonTab,
                    active && styles.seasonTabActive,
                  ]}
                  focusedStyle={styles.seasonTabFocused}
                >
                  <ThemedText
                    style={[
                      styles.seasonTabText,
                      active && styles.seasonTabTextActive,
                    ]}
                  >
                    {seasonNum}. Sezon
                  </ThemedText>
                </TVFocusable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {loadingEpisodes ? (
        <ActivityIndicator
          size="large"
          color="#E50914"
          style={{ margin: 40 }}
        />
      ) : (
        <View style={styles.episodesList}>
          {episodes.map((episode, index) => {
            const epNum = episode.episode_number ?? index + 1;
            const epTitle = formatEpisodeTitle(epNum, episode.name);
            const epOverview = episode.overview;
            const thumbnail = episode.still_path
              ? `${TMDB_IMAGE_BASE_URL}/w300${episode.still_path}`
              : null;

            const progress = getProgress(episode);

            return (
              <TVFocusable
                key={episode.Id || episode.id || index}
                onPress={() => onPlayEpisode(episode)}
                style={styles.episodeCard}
                focusedStyle={styles.episodeCardFocused}
              >
                <View style={styles.epCardMain}>
                  <View
                    style={{
                      position: 'relative',
                      width: 140,
                      height: 80,
                    }}
                  >
                    {thumbnail ? (
                      <Image
                        source={{ uri: thumbnail }}
                        style={[
                          styles.epThumb,
                          { width: '100%', height: '100%' },
                        ]}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <View
                        style={[
                          styles.epThumb,
                          {
                            width: '100%',
                            height: '100%',
                            backgroundColor: '#1e1e24',
                            justifyContent: 'center',
                            alignItems: 'center',
                          },
                        ]}
                      >
                        <Ionicons name="play-outline" size={20} color="#666" />
                      </View>
                    )}

                    {progress > 0 && progress < 0.95 && (
                      <View style={styles.epProgressBarContainer}>
                        <View
                          style={[
                            styles.epProgressBar,
                            { width: `${progress * 100}%` },
                          ]}
                        />
                      </View>
                    )}
                  </View>

                  <View style={styles.epInfo}>
                    <ThemedText style={styles.epTitle} numberOfLines={1}>
                      {epTitle}
                    </ThemedText>

                    {episode.runtime ? (
                      <ThemedText style={styles.epMeta}>
                        {episode.runtime} dk
                      </ThemedText>
                    ) : null}

                    {epOverview ? (
                      <ThemedText
                        style={styles.epOverview}
                        numberOfLines={2}
                      >
                        {epOverview}
                      </ThemedText>
                    ) : null}
                  </View>

                  {onDownloadEpisode && (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation?.();
                        onDownloadEpisode(episode);
                      }}
                      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                      style={{
                        paddingHorizontal: 12,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      {downloadedEpisodeKeys?.[`tv_${targetTmdbId}_s${Number(episode.season_number ?? activeSeason?.season_number ?? activeSeason?.IndexNumber ?? 1)}_e${epNum}`] === 'downloading' ? (
                        <View style={{ width: 26, height: 26, justifyContent: 'center', alignItems: 'center' }}>
                          <ActivityIndicator size="small" color="#00E5FF" />
                        </View>
                      ) : (
                        <Ionicons
                          name={
                            downloadedEpisodeKeys?.[`tv_${targetTmdbId}_s${Number(episode.season_number ?? activeSeason?.season_number ?? activeSeason?.IndexNumber ?? 1)}_e${epNum}`] === 'completed'
                              ? 'checkmark-circle'
                              : downloadedEpisodeKeys?.[`tv_${targetTmdbId}_s${Number(episode.season_number ?? activeSeason?.season_number ?? activeSeason?.IndexNumber ?? 1)}_e${epNum}`] === 'queued'
                              ? 'time-outline'
                              : downloadedEpisodeKeys?.[`tv_${targetTmdbId}_s${Number(episode.season_number ?? activeSeason?.season_number ?? activeSeason?.IndexNumber ?? 1)}_e${epNum}`] === 'error'
                              ? 'alert-circle-outline'
                              : 'arrow-down-circle-outline'
                          }
                          size={26}
                          color={
                            downloadedEpisodeKeys?.[`tv_${targetTmdbId}_s${Number(episode.season_number ?? activeSeason?.season_number ?? activeSeason?.IndexNumber ?? 1)}_e${epNum}`] === 'completed'
                              ? '#00E676'
                              : downloadedEpisodeKeys?.[`tv_${targetTmdbId}_s${Number(episode.season_number ?? activeSeason?.season_number ?? activeSeason?.IndexNumber ?? 1)}_e${epNum}`] === 'queued'
                              ? '#FFA000'
                              : downloadedEpisodeKeys?.[`tv_${targetTmdbId}_s${Number(episode.season_number ?? activeSeason?.season_number ?? activeSeason?.IndexNumber ?? 1)}_e${epNum}`] === 'error'
                              ? '#FF5252'
                              : '#888888'
                          }
                        />
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </TVFocusable>
            );
          })}
        </View>
      )}
    </View>
  );
}
