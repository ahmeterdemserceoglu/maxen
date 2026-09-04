import React from 'react';
import {
  View,
  ScrollView,
  ActivityIndicator,
  findNodeHandle,
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
  onSeasonChange: (season: any) => void;
  onPlayEpisode: (episode: any) => void;
  onDownloadEpisode?: (episode: any) => void;
  downloadedEpisodeKeys?: Record<string, string>;
}

export function formatEpisodeTitle(epNum: number, rawTitle?: string): string {
  if (!rawTitle || !rawTitle.trim()) return `${epNum}. Bölüm`;
  const trimmed = rawTitle.trim();

  // "2. Bölüm", "2.Bölüm", "Bölüm 2", "Episode 2", "Ep. 2", "2" gibi tekrarları yakala
  const isGenericEpisodeTitle =
    new RegExp(`^(?:${epNum}\\.?\\s*)?(?:bölüm|episode|ep\\.?)\\s*${epNum}?$`, 'i').test(trimmed) ||
    new RegExp(`^${epNum}\\.?\\s*bölüm$`, 'i').test(trimmed) ||
    trimmed === String(epNum);

  if (isGenericEpisodeTitle) {
    return `${epNum}. Bölüm`;
  }

  // Eğer başlık zaten "2. " veya "2 - " ile başlıyorsa çift numara olmasını engelle (örn: "2. Kış Geliyor" -> "2. Kış Geliyor")
  const prefixMatch = trimmed.match(new RegExp(`^${epNum}[.\\-\\s:]+\\s*(.+)`, 'i'));
  if (prefixMatch && prefixMatch[1]) {
    return `${epNum}. ${prefixMatch[1].trim()}`;
  }

  return `${epNum}. ${trimmed}`;
}

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
  onSeasonChange,
  onPlayEpisode,
  onDownloadEpisode,
  downloadedEpisodeKeys,
}: SeasonEpisodeListProps) {
  const targetTmdbId = tmdbId || episodes?.[0]?.show_id || episodes?.[0]?.tmdbId;

  React.useEffect(() => {
    if (!episodes || episodes.length === 0) return;
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
    const id = getEpisodeId(episode);
    const progressItem = localProgresses.find((p: any) => String(p?.Id ?? p?.id ?? '') === id);
    return Number(progressItem?.progress ?? 0);
  }, [getEpisodeId, localProgresses]);

  const preferredFocusIndex = Math.max(
    0,
    episodes.findIndex((episode: any) => {
      const progress = getProgress(episode);
      return progress > 0 && progress < 0.95;
    })
  );

  React.useEffect(() => {
    if (!isTV) return;
    episodeRefs.current = {};
    if (firstEpisodeRef) firstEpisodeRef.current = null;
  }, [activeSeasonNumber, isTV, episodeRefs, firstEpisodeRef]);

  React.useEffect(() => {
    if (!isTV || loadingEpisodes || episodes.length === 0) return;

    const focusTarget = () => {
      const target = episodeRefs?.current?.[preferredFocusIndex] || firstEpisodeRef?.current;
      target?.focus?.();
    };

    requestAnimationFrame(() => requestAnimationFrame(focusTarget));
  }, [episodes, loadingEpisodes, activeSeasonNumber, preferredFocusIndex, isTV, episodeRefs, firstEpisodeRef]);

  if (isTV) {
    return (
      <View style={styles.tvEpisodePanel}>
        <View style={styles.tvSeasonHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <ThemedText style={styles.tvEpisodeTitle}>Bölümler</ThemedText>
            <ThemedText style={{ color: '#8f8f8f', fontSize: 15, fontWeight: '600' }}>
              {episodes.length > 0 ? `${episodes.length} bölüm` : 'Bölüm bulunamadı'}
            </ThemedText>
          </View>

          <ScrollView
            ref={seasonScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            directionalLockEnabled
            contentContainerStyle={{ paddingRight: 24, gap: 10 }}
          >
            {seasons.map((season, index) => {
              const seasonNum = Number(season?.season_number ?? season?.IndexNumber ?? index + 1);
              const active = seasonNum === activeSeasonNumber;
              const previousSeason = seasonRefs?.current?.[index - 1];
              const nextSeason = seasonRefs?.current?.[index + 1];

              return (
                <TVFocusable
                  key={`season-${seasonNum}`}
                  ref={(ref) => {
                    if (seasonRefs?.current) seasonRefs.current[index] = ref;
                  }}
                  onFocus={() => {
                    const x = Math.max(0, index * 120 - 80);
                    seasonScrollRef.current?.scrollTo({ x, animated: true });
                  }}
                  onPress={() => onSeasonChange(season)}
                  style={[styles.tvSeasonTab, active && styles.tvSeasonActive, { minWidth: 112, height: 48, justifyContent: 'center' }]}
                  focusedStyle={{
                    ...styles.tvSeasonFocused,
                    transform: [{ scale: 1.05 }],
                    borderWidth: 2.5,
                    borderColor: '#FFFFFF',
                  }}
                  nextFocusLeft={previousSeason ? findNodeHandle(previousSeason) || undefined : undefined}
                  nextFocusRight={nextSeason ? findNodeHandle(nextSeason) || undefined : undefined}
                  nextFocusDown={firstEpisodeRef?.current ? findNodeHandle(firstEpisodeRef.current) || undefined : undefined}
                  nextFocusUp={playButtonRef?.current ? findNodeHandle(playButtonRef.current) || undefined : undefined}
                >
                  <ThemedText style={[styles.tvSeasonText, active && styles.tvSeasonTextActive]}>
                    {seasonNum}. Sezon
                  </ThemedText>
                </TVFocusable>
              );
            })}
          </ScrollView>
        </View>

        {loadingEpisodes ? (
          <View style={[styles.tvLoadingEpisodes, { minHeight: 260 }]}>
            <ActivityIndicator size="large" color="#E50914" />
            <ThemedText style={{ color: '#999', marginTop: 12, fontSize: 16 }}>Bölümler yükleniyor…</ThemedText>
          </View>
        ) : episodes.length === 0 ? (
          <View style={{ minHeight: 180, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="film-outline" size={42} color="#555" />
            <ThemedText style={{ color: '#888', marginTop: 12, fontSize: 16 }}>Bu sezonda bölüm bulunamadı.</ThemedText>
          </View>
        ) : (
          <ScrollView
            style={styles.tvEpisodeScroll}
            contentContainerStyle={[styles.tvEpisodeContent, { paddingBottom: 28, gap: 12 }]}
            showsVerticalScrollIndicator
            directionalLockEnabled
            nestedScrollEnabled
            overScrollMode="never"
          >
            {episodes.map((episode, index) => {
              const episodeId = getEpisodeId(episode) || `episode-${index}`;
              const epNum = getEpisodeNumber(episode, index);
              const epTitle = formatEpisodeTitle(epNum, episode?.name || episode?.Name);
              const epOverview = episode?.overview || episode?.Overview;
              const progress = getProgress(episode);
              const thumbnail = episode?.still_path
                ? `${TMDB_IMAGE_BASE_URL}/w780${episode.still_path}`
                : null;

              const previousEpisode = episodeRefs?.current?.[index - 1];
              const nextEpisode = episodeRefs?.current?.[index + 1];
              const isPreferred = index === preferredFocusIndex;

              return (
                <TVFocusable
                  key={`${activeSeasonNumber}-${episodeId}-${index}`}
                  ref={(ref) => {
                    if (episodeRefs?.current) episodeRefs.current[index] = ref;
                    if (index === preferredFocusIndex && firstEpisodeRef) {
                      firstEpisodeRef.current = ref;
                    }
                  }}
                  onFocus={() => {
                    // Focuslanan bölümü panel içinde görünür tut.
                    const node = episodeRefs?.current?.[index];
                    if (node?.measureLayout && episodeRefs?.current?.[0]) {
                      // Native TV'de ScrollView doğal olarak reveal eder; manuel scroll sadece fallback.
                    }
                  }}
                  onPress={() => onPlayEpisode(episode)}
                  style={[styles.tvEpisodeCard, { borderRadius: 10, overflow: 'hidden', minHeight: 128, backgroundColor: '#161c24' }]}
                  focusedStyle={{
                    borderWidth: 2.5,
                    borderColor: '#E50914',
                    transform: [{ scale: 1.015 }],
                    borderRadius: 10,
                    backgroundColor: 'rgba(229, 9, 20, 0.12)',
                  }}
                  nextFocusUp={
                    index === 0
                      ? (seasonRefs?.current?.[Math.max(0, seasons.findIndex((s: any) => Number(s?.season_number ?? s?.IndexNumber ?? 1) === activeSeasonNumber))]
                          ? findNodeHandle(seasonRefs.current[Math.max(0, seasons.findIndex((s: any) => Number(s?.season_number ?? s?.IndexNumber ?? 1) === activeSeasonNumber))]) || undefined
                          : undefined)
                      : previousEpisode
                        ? findNodeHandle(previousEpisode) || undefined
                        : undefined
                  }
                  nextFocusDown={nextEpisode ? findNodeHandle(nextEpisode) || undefined : undefined}
                  nextFocusLeft={undefined}
                  nextFocusRight={undefined}
                >
                  {({ focused }) => (
                    <View style={[styles.tvEpisodeMain, { flexDirection: 'row', gap: 16, padding: 12, alignItems: 'center', minHeight: 128 }]}> 
                      <View style={{ width: 200, height: 112, position: 'relative', borderRadius: 8, overflow: 'hidden', backgroundColor: '#10141a' }}>
                        {thumbnail ? (
                          <Image
                            source={{ uri: thumbnail }}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                            transition={120}
                            cachePolicy="memory-disk"
                            recyclingKey={episodeId}
                          />
                        ) : (
                          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="play-outline" size={34} color="#666" />
                          </View>
                        )}

                        <View style={{ position: 'absolute', left: 10, top: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.82)' }}>
                          <ThemedText style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>B{epNum}</ThemedText>
                        </View>

                        {focused && (
                          <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.34)' } as any}>
                            <View style={{ width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.62)' }}>
                              <Ionicons name="play" size={28} color="#fff" />
                            </View>
                          </View>
                        )}

                        {progress > 0 && progress < 0.95 && (
                          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, backgroundColor: 'rgba(255,255,255,0.25)' }}>
                            <View style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%`, height: '100%', backgroundColor: '#E50914' }} />
                          </View>
                        )}
                      </View>

                      <View style={{ flex: 1, minWidth: 0, paddingVertical: 4 }}>
                        <ThemedText
                          style={[styles.tvEpisodeName, focused && styles.tvEpisodeNameFocused, { fontSize: 20, fontWeight: '800', marginBottom: 8 }]}
                          numberOfLines={2}
                        >
                          {epTitle}
                        </ThemedText>
                        {!!episode.runtime && (
                          <ThemedText style={[styles.tvEpisodeRuntime, { fontSize: 15, color: '#999', marginBottom: 8 }]}>
                            {episode.runtime} dk
                          </ThemedText>
                        )}
                        {!!epOverview && (
                          <ThemedText style={[styles.tvEpisodeOverview, { fontSize: 15, lineHeight: 22, color: '#C8C8C8' }]} numberOfLines={3}>
                            {epOverview}
                          </ThemedText>
                        )}
                      </View>

                      {onDownloadEpisode && (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation?.();
                            onDownloadEpisode(episode);
                          }}
                          focusable={false}
                          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                          style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Ionicons
                            name="arrow-down-circle-outline"
                            size={30}
                            color="#aaa"
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </TVFocusable>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  }

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

            const progressObj = localProgresses.find(
              (p) => p.id === (episode.Id || episode.id)
            );
            const progress = progressObj?.progress || 0;

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
