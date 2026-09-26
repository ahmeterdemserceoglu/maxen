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
  if (showId == null || !Array.isArray(records)) return 0;
  const targetShow = extractCleanTmdbId({ id: showId });
  const targetSeason = Number(episode.season_number ?? episode.ParentIndexNumber ?? season);
  const targetEpisode = Number(episode.episode_number ?? episode.IndexNumber);

  // 1. Doğrudan bu bölüm için saklanmış spesifik kayıt var mı?
  const directRecord = records.find((item) =>
    extractCleanTmdbId(item) === targetShow &&
    Number(item.season_number ?? item.SeasonNumber ?? item.ParentIndexNumber) === targetSeason &&
    Number(item.episode_number ?? item.EpisodeNumber ?? item.IndexNumber) === targetEpisode
  );
  if (directRecord) {
    return getWatchProgress(directRecord);
  }

  // 2. Dizi genelinde en son kalınan kayıt üzerinden önceki bölümleri tamamlandı (1.0) say
  const showRecord = records.find((item) => extractCleanTmdbId(item) === targetShow);
  if (showRecord) {
    const curShowSeason = Number(showRecord.season_number ?? showRecord.SeasonNumber ?? showRecord.ParentIndexNumber ?? 1);
    const curShowEpisode = Number(showRecord.episode_number ?? showRecord.EpisodeNumber ?? showRecord.IndexNumber ?? 1);

    if (targetSeason < curShowSeason || (targetSeason === curShowSeason && targetEpisode < curShowEpisode)) {
      return 1.0;
    }
    if (targetSeason === curShowSeason && targetEpisode === curShowEpisode) {
      return getWatchProgress(showRecord);
    }
  }

  return 0;
}
