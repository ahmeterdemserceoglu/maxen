import { TMDB_BASE_URL, TMDB_IMAGE_BASE_URL } from '@/config/tmdb';

export function normalizeTmdbItem(item: any) {
  const isMovie = item.media_type === 'movie' || (!item.media_type && (item.title !== undefined || item.release_date !== undefined));
  return {
    ...item,
    id: item.id,
    title: item.title || item.name,
    type: isMovie ? 'movie' : 'tv',
    isJellyfin: false,
    tmdbId: item.id?.toString(),
    posterUrl: item.poster_path
      ? `${TMDB_IMAGE_BASE_URL}/w400${item.poster_path}`
      : null,
    backdropUrl: item.backdrop_path
      ? `${TMDB_IMAGE_BASE_URL}/w1280${item.backdrop_path}`
      : null,
    rating: item.vote_average ? item.vote_average.toFixed(1) : '—',
    runtime: '',
    year: isMovie
      ? item.release_date?.split('-')[0] || ''
      : item.first_air_date?.split('-')[0] || '',
    overview: item.overview || '',
    seasons: item.number_of_seasons || 0,
    episodes: item.number_of_episodes || 0,
  };
}

export async function fetchHomePoolData(activeTab: string) {
  let poolUrls: string[] = [];

  if (activeTab === 'movies') {
    poolUrls = [
      `${TMDB_BASE_URL}/movie/now_playing?language=tr-TR&page=1`,
      `${TMDB_BASE_URL}/movie/popular?language=tr-TR&page=1`,
      `${TMDB_BASE_URL}/movie/top_rated?language=tr-TR&page=1`,
      `${TMDB_BASE_URL}/trending/movie/week?language=tr-TR`,
      `${TMDB_BASE_URL}/discover/movie?language=tr-TR&sort_by=popularity.desc&page=2`,
    ];
  } else if (activeTab === 'tv') {
    poolUrls = [
      `${TMDB_BASE_URL}/tv/on_the_air?language=tr-TR&page=1`,
      `${TMDB_BASE_URL}/tv/popular?language=tr-TR&page=1`,
      `${TMDB_BASE_URL}/tv/top_rated?language=tr-TR&page=1`,
      `${TMDB_BASE_URL}/trending/tv/week?language=tr-TR`,
      `${TMDB_BASE_URL}/discover/tv?language=tr-TR&sort_by=popularity.desc&page=2`,
    ];
  } else {
    poolUrls = [
      `${TMDB_BASE_URL}/trending/all/day?language=tr-TR`,
      `${TMDB_BASE_URL}/movie/popular?language=tr-TR&page=1`,
      `${TMDB_BASE_URL}/tv/popular?language=tr-TR&page=1`,
      `${TMDB_BASE_URL}/movie/top_rated?language=tr-TR&page=1`,
      `${TMDB_BASE_URL}/tv/top_rated?language=tr-TR&page=1`,
      `${TMDB_BASE_URL}/trending/movie/week?language=tr-TR`,
      `${TMDB_BASE_URL}/trending/tv/week?language=tr-TR`,
    ];
  }

  const responses = await Promise.allSettled(
    poolUrls.map((url) =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
        .catch(() => ({ results: [] }))
    )
  );

  const heroPool: any[] = [];
  const popularList: any[] = [];
  const trendingList: any[] = [];
  const topRatedList: any[] = [];

  responses.forEach((res, idx) => {
    if (res.status === 'fulfilled' && res.value?.results) {
      const normalized = res.value.results.map(normalizeTmdbItem);
      if (idx === 0) heroPool.push(...normalized);
      else if (idx === 1) popularList.push(...normalized);
      else if (idx === 2) trendingList.push(...normalized);
      else if (idx === 3) topRatedList.push(...normalized);
      else heroPool.push(...normalized);
    }
  });

  return {
    heroPool,
    popularList,
    trendingList,
    topRatedList,
  };
}

export async function fetchMediaDetailData(tmdbId: string, type: 'movie' | 'tv') {
  const detailUrl = `${TMDB_BASE_URL}/${type}/${tmdbId}?language=tr-TR&append_to_response=credits,recommendations,similar,videos`;
  const res = await fetch(detailUrl);
  if (!res.ok) throw new Error(`TMDB detail error: ${res.statusText}`);
  return await res.json();
}

export async function fetchSeasonData(tvId: string, seasonNumber: number) {
  const seasonUrl = `${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}?language=tr-TR`;
  const res = await fetch(seasonUrl);
  if (!res.ok) throw new Error(`TMDB season error: ${res.statusText}`);
  return await res.json();
}

export async function fetchBoxsetData(collectionId: string | number) {
  const collectionUrl = `${TMDB_BASE_URL}/collection/${collectionId}?language=tr-TR`;
  const res = await fetch(collectionUrl);
  if (!res.ok) return null;
  return await res.json();
}

export async function fetchMediaSceneThumbnails(
  tmdbId: string | number,
  type: 'movie' | 'tv',
  seasonNumber?: number,
  episodeNumber?: number
): Promise<string[]> {
  try {
    if (!tmdbId) return [];
    if (type === 'tv' && seasonNumber && episodeNumber) {
      const epUrl = `${TMDB_BASE_URL}/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}/images`;
      const res = await fetch(epUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.stills && data.stills.length > 0) {
          return data.stills.map((s: any) => `${TMDB_IMAGE_BASE_URL}/w300${s.file_path}`);
        }
      }
    }

    // Movie images or TV fallback
    const imagesUrl = `${TMDB_BASE_URL}/${type === 'tv' ? 'tv' : 'movie'}/${tmdbId}/images`;
    const res = await fetch(imagesUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.backdrops && data.backdrops.length > 0) {
        return data.backdrops.map((b: any) => `${TMDB_IMAGE_BASE_URL}/w300${b.file_path}`);
      }
    }
  } catch (e) {
    console.warn('Failed to fetch media scene thumbnails:', e);
  }
  return [];
}
