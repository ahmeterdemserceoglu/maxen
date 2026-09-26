import { extractCleanTmdbId, mediaDocId } from '@/types/profileMedia';

function isTvMedia(media: Record<string, any>): boolean {
  return media?.type === 'tv' ||
    media?.Type === 'Series' ||
    media?.Type === 'Tv' ||
    media?.season_number != null ||
    media?.episode_number != null ||
    media?.SeasonNumber != null ||
    media?.EpisodeNumber != null ||
    Boolean(media?.show_title);
}

/** Continue Watching represents the current position of a title, not its history. */
export function getContinueWatchingDocId(media: Record<string, any>): string {
  const cleanId = extractCleanTmdbId(media) || String(media?.id ?? media?.Id ?? 'unknown');
  return `${isTvMedia(media) ? 'tv' : 'movie'}_${cleanId}`.replace(/\//g, '_');
}

export function getPlaybackMediaKey(media: Record<string, any>): string {
  const type = isTvMedia(media) ? 'tv' : 'movie';
  const cleanId = extractCleanTmdbId(media) || String(media?.id ?? media?.Id ?? 'unknown');
  const season = Number(media?.season_number ?? media?.seasonNumber ?? media?.SeasonNumber ?? 1);
  const episode = Number(media?.episode_number ?? media?.episodeNumber ?? media?.EpisodeNumber ?? 1);
  return `${type}_${cleanId}_${season}_${episode}`;
}

export function selectLatestContinueWatching<T extends Record<string, any>>(items: T[]): T[] {
  const latestByTitle = new Map<string, T>();
  for (const item of [...items].sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0))) {
    const key = getContinueWatchingDocId(item);
    if (!latestByTitle.has(key)) latestByTitle.set(key, item);
  }
  return Array.from(latestByTitle.values());
}

export class SerialWriteQueue {
  private tails = new Map<string, Promise<unknown>>();

  enqueue<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    this.tails.set(key, current);
    current.finally(() => {
      if (this.tails.get(key) === current) this.tails.delete(key);
    }).catch(() => undefined);
    return current;
  }
}

export interface GenerationGuard {
  current(): number;
  advance(): number;
  isCurrent(generation: number): boolean;
}

export function createGenerationGuard(): GenerationGuard {
  let generation = 0;
  return {
    current: () => generation,
    advance: () => ++generation,
    isCurrent: (candidate) => candidate === generation,
  };
}

export const COMPLETION_THRESHOLD = 0.95;

export function isPreheatedPayloadForMedia(
  payload: Record<string, any> | null | undefined,
  media: Record<string, any>,
): boolean {
  if (!payload?.mediaKey && !payload?.key) return false;
  const candidate = payload.mediaKey || payload.key;
  return candidate === mediaDocId(media) || candidate === getPlaybackMediaKey(media);
}

function episodeNumber(media: Record<string, any>): number {
  return Number(media?.episode_number ?? media?.EpisodeNumber ?? media?.IndexNumber ?? 0);
}

function seasonNumber(media: Record<string, any>): number {
  return Number(media?.season_number ?? media?.SeasonNumber ?? media?.ParentIndexNumber ?? 0);
}

export function isEpisodeAdjacent(current: Record<string, any>, candidate: Record<string, any>): boolean {
  const currentSeason = seasonNumber(current);
  const currentEpisode = episodeNumber(current);
  const nextSeason = seasonNumber(candidate);
  const nextEpisode = episodeNumber(candidate);
  return (nextSeason === currentSeason && nextEpisode === currentEpisode + 1) ||
    (nextSeason === currentSeason + 1 && nextEpisode === 1);
}

export function isAiredEpisode(episode: Record<string, any>, now = new Date()): boolean {
  if (!episode?.air_date) return true;
  const airDate = new Date(`${episode.air_date}T23:59:59Z`);
  return !Number.isNaN(airDate.getTime()) && airDate.getTime() <= now.getTime();
}

export function getAdjustedVolume(volume: number | undefined, delta: number): number {
  const current = volume ?? 1;
  return Math.min(1, Math.max(0, current + delta));
}

export function shouldRotateFailedStream(attempt: number, maxSameStreamAttempts = 3): boolean {
  return attempt >= maxSameStreamAttempts;
}
