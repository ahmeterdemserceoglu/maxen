export type ProfileMediaItem = {
  id: string;
  tmdbId?: string;
  title?: string;
  name?: string;
  type: 'movie' | 'tv';
  posterUrl?: string | null;
  backdropUrl?: string | null;
  overview?: string;
  year?: string;
  rating?: string;
  progress?: number;
  positionSeconds?: number;
  durationSeconds?: number;
  show_title?: string;
  season_number?: number;
  episode_number?: number;
  savedStreamUrl?: string | null;
  savedStreamHeaders?: Record<string, string> | null;
  savedAt: number;
};

export function extractCleanTmdbId(media: any): string {
  if (!media) return '';
  const candidate =
    media.tmdbId ??
    media.tmdbID ??
    media.show_id ??
    media.seriesId ??
    media.ProviderIds?.Tmdb ??
    media.providerIds?.Tmdb ??
    media.TmdbId ??
    media.externalIds?.Tmdb ??
    media.id ??
    media.Id;

  if (candidate === undefined || candidate === null) return '';
  const str = String(candidate).trim();

  if (/^tmdb-(tv-|movie-|episode-)?/i.test(str)) {
    return str.replace(/^tmdb-(tv-|movie-|episode-)?/i, '').trim();
  }
  if (/^(tv|movie)_\d+/i.test(str)) {
    return str.replace(/^(tv|movie)_/i, '').split('_')[0].trim();
  }

  return str;
}

export function mediaDocId(media: Record<string, unknown>): string {
  const isTv =
    media.type === 'tv' ||
    media.Type === 'Series' ||
    media.Type === 'Tv' ||
    (media.season_number !== undefined && media.season_number !== null) ||
    (media.episode_number !== undefined && media.episode_number !== null) ||
    (media.SeasonNumber !== undefined && media.SeasonNumber !== null) ||
    (media.EpisodeNumber !== undefined && media.EpisodeNumber !== null) ||
    (media.ParentIndexNumber !== undefined && media.ParentIndexNumber !== null) ||
    (media.IndexNumber !== undefined && media.IndexNumber !== null) ||
    Boolean(media.show_title);

  const type = isTv ? 'tv' : 'movie';
  const cleanId = extractCleanTmdbId(media) || String(media.id ?? media.Id ?? 'unknown');
  const base = `${type}_${cleanId}`.replace(/\//g, '_');

  if (isTv) {
    const s = media.season_number ?? media.SeasonNumber ?? media.ParentIndexNumber;
    const e = media.episode_number ?? media.EpisodeNumber ?? media.IndexNumber;
    if (s != null && e != null) {
      return `${base}_S${Number(s)}E${Number(e)}`;
    }
  }

  return base;
}

export function normalizeMediaItem(media: any): ProfileMediaItem {
  const isTv =
    media.type === 'tv' ||
    media.Type === 'Series' ||
    media.Type === 'Tv' ||
    (media.season_number !== undefined && media.season_number !== null) ||
    (media.episode_number !== undefined && media.episode_number !== null) ||
    (media.SeasonNumber !== undefined && media.SeasonNumber !== null) ||
    (media.EpisodeNumber !== undefined && media.EpisodeNumber !== null) ||
    Boolean(media.show_title);

  const isMovie = !isTv;

  const rawPoster =
    media.posterUrl ||
    media.poster_path ||
    media.poster ||
    media.thumbnail ||
    media.image ||
    null;

  const rawBackdrop =
    media.backdropUrl ||
    media.backdrop_path ||
    media.backdrop ||
    rawPoster;

  const formatTmdb = (path: string | null, width: string) => {
    if (!path || typeof path !== 'string') return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `https://image.tmdb.org/t/p/${width}${cleanPath}`;
  };

  const cleanId = extractCleanTmdbId(media);

  return {
    id: String(cleanId || media.id || media.tmdbId || media.Id),
    tmdbId: cleanId,
    title: media.title || media.name || media.show_title || null,
    name: media.name || media.title || null,
    type: isMovie ? 'movie' : 'tv',
    posterUrl: formatTmdb(rawPoster, 'w400'),
    backdropUrl: formatTmdb(rawBackdrop, 'w780'),
    overview: media.overview ?? null,
    year: media.year ?? null,
    rating: media.rating ?? null,
    progress: media.progress ?? null,
    positionSeconds: media.positionSeconds ?? null,
    durationSeconds: media.durationSeconds ?? null,
    show_title: isMovie ? undefined : (media.show_title || media.SeriesName || media.title || undefined),
    season_number:
      isMovie || (media.season_number == null && media.SeasonNumber == null && media.ParentIndexNumber == null)
        ? undefined
        : Number(media.season_number ?? media.SeasonNumber ?? media.ParentIndexNumber),
    episode_number:
      isMovie || (media.episode_number == null && media.EpisodeNumber == null && media.IndexNumber == null)
        ? undefined
        : Number(media.episode_number ?? media.EpisodeNumber ?? media.IndexNumber),
    savedStreamUrl: media.savedStreamUrl ?? null,
    savedStreamHeaders: media.savedStreamHeaders ?? null,
    savedAt: media.savedAt ?? Date.now(),
  };
}
