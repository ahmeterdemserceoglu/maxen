import { API_BASE_URL } from '@/config/tmdb';

export interface XRayActor {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface XRaySong {
  title: string;
  artist: string;
  albumCover: string | null;
  spotifyUrl: string | null;
  previewUrl: string | null;
}

export interface XRayScene {
  id: string;
  startSeconds: number;
  endSeconds: number;
  description: string;
  song?: XRaySong | null;
  actors: XRayActor[];
}

export interface XRayData {
  hasXRay: boolean;
  tmdbId: string | number;
  imdbId?: string;
  scenes: XRayScene[];
}

// In-memory cache
const xrayCache = new Map<string, XRayData>();

export async function fetchXRayData(
  tmdbId: number | string,
  mediaType: 'movie' | 'tv' = 'movie',
  seasonNumber?: number,
  episodeNumber?: number
): Promise<XRayData | null> {
  if (!tmdbId) return null;

  const cacheKey = `${mediaType}_${tmdbId}_s${seasonNumber ?? 0}_e${episodeNumber ?? 0}`;
  if (xrayCache.has(cacheKey)) {
    return xrayCache.get(cacheKey) || null;
  }

  try {
    const params = new URLSearchParams({
      tmdbId: String(tmdbId),
      type: mediaType,
    });

    if (seasonNumber !== undefined) params.append('season', String(seasonNumber));
    if (episodeNumber !== undefined) params.append('episode', String(episodeNumber));

    const res = await fetch(`${API_BASE_URL}/api/xray?${params.toString()}`);
    if (!res.ok) {
      return null;
    }

    const data: XRayData = await res.json();
    if (data && data.hasXRay) {
      xrayCache.set(cacheKey, data);
      return data;
    }

    return null;
  } catch (err) {
    console.warn('fetchXRayData error:', err);
    return null;
  }
}

/**
 * Verilen saniyedeki aktif sahneyi döner.
 * Eğer o saniyede bir sahne eşleşmezse null döner (X-Ray gereksiz açılmaz).
 */
export function getCurrentScene(
  xrayData: XRayData | null,
  currentSeconds: number
): XRayScene | null {
  if (!xrayData || !xrayData.hasXRay || !xrayData.scenes || xrayData.scenes.length === 0) {
    return null;
  }

  // 1. Doğrudan zaman aralığına denk gelen sahne
  const exactScene = xrayData.scenes.find(
    (scene) => currentSeconds >= scene.startSeconds && currentSeconds <= scene.endSeconds
  );
  if (exactScene) return exactScene;

  // 2. En yakın sahne (5 saniye tolerans)
  const nearbyScene = xrayData.scenes.find(
    (scene) => Math.abs(currentSeconds - scene.startSeconds) <= 5
  );

  return nearbyScene || null;
}
