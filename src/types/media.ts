export interface Genre {
  id: number;
  name: string;
}

export interface MediaItem {
  id: string | number;
  tmdbId?: string | number;
  type?: 'movie' | 'tv';
  title?: string;
  name?: string;
  overview?: string;
  posterUrl?: string;
  backdropUrl?: string;
  posterPath?: string;
  backdropPath?: string;
  rating?: string | number;
  voteAverage?: number;
  year?: string | number;
  releaseDate?: string;
  runtime?: string | number;
  genres?: Genre[];
  seasons?: number;
  episodes?: number;
  EpisodeNumber?: number;
  SeasonNumber?: number;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  SeriesName?: string;
  show_title?: string;
  episode_number?: number;
  season_number?: number;
  progress?: number;
  positionSeconds?: number;
  durationSeconds?: number;
  savedAt?: number;
}

export interface NormalizedMediaItem {
  id: string | number;
  title: string;
  type: 'movie' | 'tv';
  isJellyfin?: boolean;
  tmdbId?: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  rating: string;
  runtime: string;
  year: string;
  overview: string;
  seasons: number;
  episodes: number;
  [key: string]: any;
}

export function normalizeTmdbItem(item: any): NormalizedMediaItem {
  const isMovie =
    item.media_type === 'movie' ||
    (!item.media_type && (item.title !== undefined || item.release_date !== undefined));
  return {
    ...item,
    id: item.id,
    title: item.title || item.name,
    type: isMovie ? 'movie' : 'tv',
    isJellyfin: false,
    tmdbId: item.id?.toString(),
    posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w400${item.poster_path}` : null,
    backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
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
