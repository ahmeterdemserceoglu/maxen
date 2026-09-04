import { TMDB_BASE_URL } from '@/config/tmdb';
import { type ProfileMediaItem } from '@/types/profileMedia';

export interface EpisodeNotification {
  seriesId: string;
  seriesTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string;
  airDate: string;
}

/**
 * Checks a list of TV series to see if a new episode has aired
 * after the user's current progress.
 */
export async function checkNewEpisodes(
  continueWatchingList: ProfileMediaItem[]
): Promise<EpisodeNotification[]> {
  const notifications: EpisodeNotification[] = [];

  // Filter only TV series
  const seriesList = continueWatchingList.filter((m) => m.type === 'tv');

  for (const series of seriesList) {
    if (!series.tmdbId) continue;
    
    try {
      // 1. Fetch TV Series Details to get the latest season/episode
      const res = await fetch(
        `${TMDB_BASE_URL}/tv/${series.tmdbId}?language=tr-TR`
      );
      if (!res.ok) continue;
      const data = await res.json();
      
      const lastAired = data.last_episode_to_air;
      if (!lastAired) continue;

      // Check if this episode is newer than what the user watched
      // The user's last watched is stored in series.season_number and series.episode_number
      const userSeason = series.season_number || 1;
      const userEpisode = series.episode_number || 1;

      // Sadece 14 gün içinde yayınlanmış yeni bir bölüm varsa VEYA kullanıcının izlediği bölümün tam olarak bir sonrasıyken yeni çıktıysa
      const airDate = lastAired.air_date ? new Date(lastAired.air_date) : new Date(0);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - airDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const isNewer = 
        lastAired.season_number > userSeason || 
        (lastAired.season_number === userSeason && lastAired.episode_number > userEpisode);
        
      const isRecentlyAired = diffDays <= 14;

      if (isNewer && isRecentlyAired) {
        notifications.push({
          seriesId: series.tmdbId,
          seriesTitle: series.title || '',
          seasonNumber: lastAired.season_number,
          episodeNumber: lastAired.episode_number,
          episodeName: lastAired.name || '',
          airDate: lastAired.air_date || '',
        });
      }
    } catch (e) {
      console.warn('Error checking new episodes for', series.title, e);
    }
  }

  return notifications;
}
