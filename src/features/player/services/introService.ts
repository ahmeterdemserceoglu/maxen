import { Platform } from 'react-native';
import { TMDB_BASE_URL } from '@/config/tmdb';
import { API_BASE_URL } from '@/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { withoutStaleEpisodePlayback } from '@/utils/episodePlayback';
import { isAiredEpisode, isEpisodeAdjacent } from '@/utils/playerReliability';

export interface IntroSegment {
  start_sec: number;
  end_sec: number;
}

export interface IntroData {
  intro?: IntroSegment | null;
  hasIntro: boolean;
}

// L1 In-Memory Cache
const memoryCache = new Map<string, IntroData>();

/**
 * Fetches intro segment for a given TV show episode using IntroDB with 2-tier caching.
 */
export async function fetchEpisodeIntro(
  tmdbId: string,
  season: number,
  episode: number
): Promise<IntroData> {
  try {
    if (!tmdbId || !season || !episode) {
      return { hasIntro: false };
    }

    const cacheKey = `intro_${tmdbId}_s${season}_e${episode}`;

    // 1. In-Memory Cache Kontrolü
    if (memoryCache.has(cacheKey)) {
      return memoryCache.get(cacheKey)!;
    }

    // 2. AsyncStorage Kalıcı Önbellek Kontrolü
    try {
      const stored = await AsyncStorage.getItem(`@${cacheKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        memoryCache.set(cacheKey, parsed);
        return parsed;
      }
    } catch (e) {}

    // 3. TMDB'den IMDb ID'yi al
    const extRes = await fetch(`${TMDB_BASE_URL}/tv/${tmdbId}/external_ids`);
    if (!extRes.ok) return { hasIntro: false };

    const extData = await extRes.json();
    const imdbId = extData?.imdb_id;
    if (!imdbId) return { hasIntro: false };

    // 4. Önce Güvenli Vercel Backend Proxy üzerinden dene
    let data: any = null;
    try {
      const proxyRes = await fetch(
        `${API_BASE_URL}/api/intro?imdb_id=${imdbId}&season=${season}&episode=${episode}`
      );
      if (proxyRes.ok) {
        data = await proxyRes.json();
      }
    } catch (proxyErr) {
      console.warn('[IntroService] Proxy hatası, doğrudan deneniyor:', proxyErr);
    }

    // 5. Proxy yanıt vermezse ve web ortamında değilsek doğrudan IntroDB fallback (Webde CORS engellenir)
    if (!data && Platform.OS !== 'web') {
      const directRes = await fetch(
        `https://api.introdb.app/intro?imdb_id=${imdbId}&season=${season}&episode=${episode}`
      );
      if (directRes.ok) {
        data = await directRes.json();
      }
    }

    if (
      data &&
      typeof data.start_sec === 'number' &&
      typeof data.end_sec === 'number' &&
      data.end_sec > data.start_sec
    ) {
      const result: IntroData = {
        hasIntro: true,
        intro: {
          start_sec: data.start_sec,
          end_sec: data.end_sec,
        },
      };
      memoryCache.set(cacheKey, result);
      AsyncStorage.setItem(`@${cacheKey}`, JSON.stringify(result)).catch(() => {});
      return result;
    }
  } catch (error) {
    console.warn('[IntroService] Intro verisi çekilemedi:', error);
  }

  return { hasIntro: false };
}

/**
 * Calculates and returns the next episode media object.
 */
export async function getNextEpisodeMedia(currentMedia: any): Promise<any | null> {
  try {
    const playlist = currentMedia.playlist as any[] | undefined;
    const currentIndex = currentMedia.playlistIndex as number | undefined;

    // 1. Eğer playlist varsa sıradakini al
    if (playlist && currentIndex !== undefined && currentIndex >= 0 && currentIndex < playlist.length - 1) {
      const nextEp = playlist[currentIndex + 1];
      if (!isAiredEpisode(nextEp)) {
        console.log('[IntroService] Playlist sıradaki bölüm henüz yayınlanmamış:', nextEp.air_date);
        return null;
      }
      return withoutStaleEpisodePlayback({
        ...currentMedia,
        ...nextEp,
        id: nextEp.Id || nextEp.id || currentMedia.id,
        title: nextEp.Name || nextEp.name || currentMedia.title,
        show_title: currentMedia.show_title || currentMedia.SeriesName || currentMedia.title,
        type: 'tv',
        season_number: nextEp.ParentIndexNumber || nextEp.season_number || currentMedia.season_number,
        episode_number: nextEp.IndexNumber || nextEp.episode_number || (currentMedia.episode_number || 1) + 1,
        playlist,
        playlistIndex: currentIndex + 1,
      });
    }

    // 2. Playlist yoksa TMDB üzerinden sonraki bölümü bul
    const tmdbId = currentMedia.tmdbId || currentMedia.id;
    const curSeason = currentMedia.season_number || currentMedia.SeasonNumber || 1;
    const curEpisode = currentMedia.episode_number || currentMedia.EpisodeNumber || 1;

    if (!tmdbId) return null;

    const seasonRes = await fetch(`${TMDB_BASE_URL}/tv/${tmdbId}/season/${curSeason}?language=tr-TR`);
    if (seasonRes.ok) {
      const seasonData = await seasonRes.json();
      const episodes = seasonData?.episodes || [];
      const nextEp = episodes.find((ep: any) => ep.episode_number === curEpisode + 1);

      if (nextEp) {
        if (!isAiredEpisode(nextEp)) {
          console.log('[IntroService] Sıradaki bölüm henüz yayınlanmamış (air_date gelecekte):', nextEp.air_date);
          return null;
        }
        return withoutStaleEpisodePlayback({
          ...currentMedia,
          ...nextEp,
          id: `tmdb-${nextEp.id}`,
          title: nextEp.name,
          show_title: currentMedia.show_title || currentMedia.title || currentMedia.name,
          type: 'tv',
          season_number: curSeason,
          episode_number: curEpisode + 1,
        });
      } else {
        // Mevcut sezonda sonraki bölüm yoksa bir sonraki sezonun 1. bölümünü dene
        const nextSeasonRes = await fetch(`${TMDB_BASE_URL}/tv/${tmdbId}/season/${curSeason + 1}?language=tr-TR`);
        if (nextSeasonRes.ok) {
          const nextSeasonData = await nextSeasonRes.json();
          const firstEpOfNextSeason = (nextSeasonData?.episodes || [])[0];
          if (firstEpOfNextSeason && isAiredEpisode(firstEpOfNextSeason)) {
            return withoutStaleEpisodePlayback({
              ...currentMedia,
              ...firstEpOfNextSeason,
              id: `tmdb-${firstEpOfNextSeason.id}`,
              title: firstEpOfNextSeason.name,
              show_title: currentMedia.show_title || currentMedia.title || currentMedia.name,
              type: 'tv',
              season_number: curSeason + 1,
              episode_number: 1,
            });
          }
        }
      }
    }
  } catch (error) {
    console.warn('[IntroService] Sonraki bölüm bulunamadı:', error);
  }

  // Ağ hatasında veya sezon sonunda doğrulanmamış/sahte bir bölüm üretme.
  return null;
}
