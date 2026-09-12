import { extractCleanTmdbId } from '@/types/profileMedia';

/** Stored progress is a fraction; elapsed time is the fallback for older records. */
export function getWatchProgress(item: any): number {
  const ratio = item?.progress;
  if (typeof ratio === 'number' && Number.isFinite(ratio)) {
    return Math.max(0, Math.min(1, ratio));
  }
  const position = Number(item?.positionSeconds);
  const duration = Number(item?.durationSeconds);
  return Number.isFinite(position) && Number.isFinite(duration) && duration > 0
    ? Math.max(0, Math.min(1, position / duration))
    : 0;
}

export function getEpisodeProgress(records: any[], showId: string | number | null | undefined, episode: any, season = 1): number {
  if (showId == null) return 0;
  const targetShow = extractCleanTmdbId({ id: showId });
  const targetSeason = Number(episode.season_number ?? episode.ParentIndexNumber ?? season);
  const targetEpisode = Number(episode.episode_number ?? episode.IndexNumber);
  const record = records.find((item) =>
    extractCleanTmdbId(item) === targetShow &&
    Number(item.season_number ?? item.SeasonNumber ?? item.ParentIndexNumber) === targetSeason &&
    Number(item.episode_number ?? item.EpisodeNumber ?? item.IndexNumber) === targetEpisode
  );
  return getWatchProgress(record);
}
