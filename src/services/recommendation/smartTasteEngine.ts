import { getContinueWatching, getFavorites, getWatchLater } from '@/services/profileMediaService';
import { TMDB_BASE_URL, TMDB_IMAGE_BASE_URL } from '@/config/tmdb';
import { normalizeTmdbItem, NormalizedMediaItem } from '@/types/media';

export interface TasteProfile {
  seedTmdbIds: string[];
  totalInteractions: number;
  hasSufficientData: boolean;
}

/**
 * Computes a weighted user taste profile from Continue Watching (>85% completed),
 * Favorites (+2.5), and Watch Later (+1.0).
 */
export async function computeUserTasteProfile(
  userId: string,
  profileId: string
): Promise<TasteProfile> {
  try {
    const [cwList, favList, wlList] = await Promise.all([
      getContinueWatching(userId, profileId).catch(() => []),
      getFavorites(userId, profileId).catch(() => []),
      getWatchLater(userId, profileId).catch(() => []),
    ]);

    const weightedSeeds: { tmdbId: string; weight: number }[] = [];

    // 1. Favorites carry strong positive signal (Weight: +2.5)
    favList.forEach((fav) => {
      const id = String(fav.tmdbId || fav.id);
      if (id && id !== 'undefined') {
        weightedSeeds.push({ tmdbId: id, weight: 2.5 });
      }
    });

    // 2. High progress / completed Continue Watching items (Weight: +3.0 for >85% progress)
    cwList.forEach((cw) => {
      const id = String(cw.tmdbId || cw.id);
      const progress = cw.progress || 0;
      if (id && id !== 'undefined') {
        if (progress >= 0.85) {
          weightedSeeds.push({ tmdbId: id, weight: 3.0 });
        } else if (progress >= 0.4) {
          weightedSeeds.push({ tmdbId: id, weight: 1.5 });
        }
      }
    });

    // 3. Watch Later list (Weight: +1.0)
    wlList.forEach((wl) => {
      const id = String(wl.tmdbId || wl.id);
      if (id && id !== 'undefined') {
        weightedSeeds.push({ tmdbId: id, weight: 1.0 });
      }
    });

    // Aggregate weights per TMDB ID
    const aggregated: Record<string, number> = {};
    weightedSeeds.forEach(({ tmdbId, weight }) => {
      aggregated[tmdbId] = (aggregated[tmdbId] || 0) + weight;
    });

    // Sort descending by accumulated weight
    const sortedSeeds = Object.entries(aggregated)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    return {
      seedTmdbIds: sortedSeeds.slice(0, 6),
      totalInteractions: weightedSeeds.length,
      hasSufficientData: sortedSeeds.length > 0,
    };
  } catch (error) {
    console.warn('Taste profile computation error:', error);
    return {
      seedTmdbIds: [],
      totalInteractions: 0,
      hasSufficientData: false,
    };
  }
}

/**
 * Fetches personalized recommendations for the calculated taste profile.
 * Falls back to Top-Rated / Trending mix on cold-start (no prior interaction history).
 */
export async function fetchSmartRecommendations(
  tasteProfile: TasteProfile
): Promise<NormalizedMediaItem[]> {
  try {
    if (!tasteProfile.hasSufficientData || tasteProfile.seedTmdbIds.length === 0) {
      // Cold-start fallback: Top Rated + Trending Mix
      const res = await fetch(`${TMDB_BASE_URL}/trending/all/week?language=tr-TR`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.results || []).map(normalizeTmdbItem);
    }

    // Query TMDB /recommendations for top 4 seed items in parallel
    const recommendationPromises = tasteProfile.seedTmdbIds.slice(0, 4).map(async (tmdbId) => {
      try {
        const res = await fetch(
          `${TMDB_BASE_URL}/movie/${tmdbId}/recommendations?language=tr-TR&page=1`
        );
        if (!res.ok) {
          // If movie recommendations fail, try TV recommendations endpoint
          const tvRes = await fetch(
            `${TMDB_BASE_URL}/tv/${tmdbId}/recommendations?language=tr-TR&page=1`
          );
          if (!tvRes.ok) return [];
          const tvData = await tvRes.json();
          return (tvData.results || []).map(normalizeTmdbItem);
        }
        const data = await res.json();
        return (data.results || []).map(normalizeTmdbItem);
      } catch {
        return [];
      }
    });

    const resultsArray = await Promise.all(recommendationPromises);
    const flattened = resultsArray.flat();

    // Deduplicate and filter out items without poster or title
    const seen = new Set<string>();
    const deduplicated = flattened.filter((item) => {
      if (!item || !item.tmdbId || seen.has(item.tmdbId)) return false;
      seen.add(item.tmdbId);
      return true;
    });

    // Sort by rating descending
    deduplicated.sort((a, b) => {
      const ratingA = parseFloat(a.rating) || 0;
      const ratingB = parseFloat(b.rating) || 0;
      return ratingB - ratingA;
    });

    return deduplicated.slice(0, 20);
  } catch (error) {
    console.warn('fetchSmartRecommendations error:', error);
    return [];
  }
}
