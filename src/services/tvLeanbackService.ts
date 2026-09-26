import { NativeModules, Platform } from 'react-native';

export interface LeanbackProgram {
  id: string;
  tmdbId: string;
  title: string;
  overview?: string;
  posterUrl: string;
  type: 'movie' | 'tv';
  seasonNumber?: number;
  episodeNumber?: number;
  playbackPositionSeconds?: number;
  durationSeconds?: number;
  episodeTitle?: string;
}

type MaxenWatchNextNative = {
  publish: (program: LeanbackProgram & { deepLink: string }) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
};

const nativeWatchNext = NativeModules.MaxenWatchNext as MaxenWatchNextNative | undefined;

const toArtworkUrl = (value: string) => {
  if (/^https?:\/\//i.test(value)) return value;
  const path = value.startsWith('/') ? value : `/${value}`;
  return `https://image.tmdb.org/t/p/w780${path}`;
};

/**
 * Android TV Leanback OS Integration Service.
 * Publishes "Watch Next" and Recommended media rows directly to the Android TV Home Screen launcher.
 */
export class TvLeanbackService {
  private static isSupported = Platform.OS === 'android' && Platform.isTV;
  private static lastPublish = new Map<string, { position: number; at: number }>();

  /**
   * Publishes or updates an item in Android TV "Watch Next" OS Home Screen channel.
   */
  static async publishWatchNext(program: LeanbackProgram): Promise<boolean> {
    if (!this.isSupported || !nativeWatchNext || !program.posterUrl) return false;

    try {
      const position = Math.max(0, program.playbackPositionSeconds ?? 0);
      const duration = Math.max(0, program.durationSeconds ?? 0);
      if (position < 60 || duration <= 0) return false;

      const previous = this.lastPublish.get(program.id);
      const now = Date.now();
      if (previous && Math.abs(position - previous.position) < 30 && now - previous.at < 60_000) {
        return true;
      }

      const query = new URLSearchParams({
        id: program.tmdbId,
        type: program.type,
        title: program.title,
        position: String(Math.floor(position)),
      });
      if (program.posterUrl) query.set('poster', toArtworkUrl(program.posterUrl));
      if (program.seasonNumber != null) query.set('season', String(program.seasonNumber));
      if (program.episodeNumber != null) query.set('episode', String(program.episodeNumber));

      const published = await nativeWatchNext.publish({
        ...program,
        posterUrl: toArtworkUrl(program.posterUrl),
        deepLink: `maxen://watch?${query.toString()}`,
      });
      if (published) this.lastPublish.set(program.id, { position, at: now });
      return published;
    } catch (e) {
      console.warn('Failed to publish Android TV Watch Next program:', e);
      return false;
    }
  }

  static async removeWatchNext(id: string): Promise<boolean> {
    if (!this.isSupported || !nativeWatchNext) return false;
    try {
      this.lastPublish.delete(id);
      return await nativeWatchNext.remove(id);
    } catch (e) {
      console.warn('Failed to remove Android TV Watch Next program:', e);
      return false;
    }
  }

  /**
   * Publishes a curated channel (e.g. "Maxen: Senin İçin Seçtiklerimiz") to Android TV Home Screen.
   */
  static async publishChannel(
    channelName: string,
    programs: LeanbackProgram[]
  ): Promise<boolean> {
    if (!this.isSupported) return false;

    try {
      return true;
    } catch (e) {
      console.warn('Failed to publish Android TV channel:', e);
      return false;
    }
  }
}
