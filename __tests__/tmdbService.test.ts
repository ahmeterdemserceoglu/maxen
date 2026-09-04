import { normalizeTmdbItem } from '../src/services/api/tmdbService';

describe('TMDB Service Normalization Unit Tests', () => {
  it('should normalize movie items correctly', () => {
    const rawMovie = {
      id: 550,
      title: 'Fight Club',
      media_type: 'movie',
      poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
      backdrop_path: '/hZkgoQYus5vegHoetLkCJzb17zJ.jpg',
      vote_average: 8.433,
      release_date: '1999-10-15',
      overview: 'A ticking-time-bomb insomniac...',
    };

    const normalized = normalizeTmdbItem(rawMovie);

    expect(normalized.id).toBe(550);
    expect(normalized.tmdbId).toBe('550');
    expect(normalized.title).toBe('Fight Club');
    expect(normalized.type).toBe('movie');
    expect(normalized.rating).toBe('8.4');
    expect(normalized.year).toBe('1999');
    expect(normalized.posterUrl).toContain('/w400/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg');
    expect(normalized.backdropUrl).toContain('/w1280/hZkgoQYus5vegHoetLkCJzb17zJ.jpg');
    expect(normalized.isJellyfin).toBe(false);
  });

  it('should normalize TV show items correctly', () => {
    const rawShow = {
      id: 1399,
      name: 'Game of Thrones',
      first_air_date: '2011-04-17',
      vote_average: 8.452,
      poster_path: '/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg',
      backdrop_path: null,
      number_of_seasons: 8,
      number_of_episodes: 73,
      overview: 'Seven noble families fight for control...',
    };

    const normalized = normalizeTmdbItem(rawShow);

    expect(normalized.id).toBe(1399);
    expect(normalized.title).toBe('Game of Thrones');
    expect(normalized.type).toBe('tv');
    expect(normalized.rating).toBe('8.5');
    expect(normalized.year).toBe('2011');
    expect(normalized.seasons).toBe(8);
    expect(normalized.episodes).toBe(73);
    expect(normalized.backdropUrl).toBeNull();
  });

  it('should handle missing data gracefully without crashing', () => {
    const emptyItem = {};
    const normalized = normalizeTmdbItem(emptyItem);

    expect(normalized.title).toBeUndefined();
    expect(normalized.rating).toBe('—');
    expect(normalized.year).toBe('');
    expect(normalized.posterUrl).toBeNull();
    expect(normalized.backdropUrl).toBeNull();
  });
});
