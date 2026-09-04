import { streamPreheater } from '../src/features/player/services/StreamPreheater';
import { streamSessionManager } from '../src/features/player/services/StreamSessionManager';
import { usePlayerStore } from '../src/store/playerStore';

// Mock dependencies
jest.mock('../src/features/player/services/introService', () => ({
  fetchEpisodeIntro: jest.fn().mockResolvedValue({
    hasIntro: true,
    intro: { start_sec: 10, end_sec: 90 },
  }),
}));

jest.mock('../src/services/api/tmdbService', () => ({
  fetchMediaSceneThumbnails: jest.fn().mockResolvedValue([
    'https://image.tmdb.org/t/p/w300/thumb1.jpg',
  ]),
}));

jest.mock('../src/features/player/services/streamResolverService', () => ({
  resolveParallelDirectStreamResult: jest.fn().mockImplementation(async ({ tmdbId, isMovie }) => ({
    streamUrl: `https://mock.stream/${isMovie ? 'movie' : 'tv'}_${tmdbId}.m3u8`,
    provider: 'MockProvider',
  })),
}));

jest.mock('../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'test_user' },
    activeProfile: { id: 'prof_1' },
  }),
}));

jest.mock('../src/hooks/use-theme', () => ({
  useTheme: () => ({
    colors: { background: '#000', text: '#fff' },
  }),
}));

jest.mock('../src/services/profileMediaService', () => ({
  getMediaRating: jest.fn().mockResolvedValue(8),
  setMediaRating: jest.fn().mockResolvedValue(undefined),
  isFavorite: jest.fn().mockResolvedValue(false),
  toggleFavorite: jest.fn().mockResolvedValue(true),
  isWatchLater: jest.fn().mockResolvedValue(false),
  toggleWatchLater: jest.fn().mockResolvedValue(true),
  getContinueWatching: jest.fn().mockResolvedValue([
    {
      id: 'tv_1399',
      tmdbId: '1399',
      season_number: 2,
      episode_number: 3,
      progress: 0.4,
    },
  ]),
}));

describe('Preheating Integration Unit Tests', () => {
  let preheatSpy: jest.SpyInstance;

  beforeEach(() => {
    streamPreheater.clear();
    jest.clearAllMocks();
    preheatSpy = jest.spyOn(streamPreheater, 'preheat');
  });

  afterEach(() => {
    preheatSpy.mockRestore();
  });

  describe('HeroBanner Preheating Behavior', () => {
    it('should generate expected preheating key and call preheat for active movie hero', async () => {
      const hero = {
        id: 550,
        tmdbId: '550',
        title: 'Fight Club',
        type: 'movie' as const,
        isMovie: true,
        isJellyfin: false,
        posterUrl: null,
        backdropUrl: null,
        rating: '8.8',
        runtime: '139',
        year: '1999',
        overview: 'An insomniac office worker...',
        seasons: 0,
        episodes: 0,
      };

      const rawId = hero.tmdbId || hero.id;
      const mediaType = hero.type || (hero.isMovie ? 'movie' : 'tv');

      await streamPreheater.preheat(rawId, mediaType, 1, 1);

      expect(preheatSpy).toHaveBeenCalledWith('550', 'movie', 1, 1);
      expect(streamPreheater.has('movie_550_1_1')).toBe(true);
    });

    it('should preheat TV show hero item with default season 1 episode 1', async () => {
      const hero = {
        id: 1399,
        tmdbId: '1399',
        title: 'Game of Thrones',
        type: 'tv' as const,
        isMovie: false,
        isJellyfin: false,
        posterUrl: null,
        backdropUrl: null,
        rating: '9.2',
        runtime: '',
        year: '2011',
        overview: 'Winter is coming',
        seasons: 8,
        episodes: 73,
      };

      const rawId = hero.tmdbId || hero.id;
      const mediaType = hero.type || (hero.isMovie ? 'movie' : 'tv');

      await streamPreheater.preheat(rawId, mediaType, 1, 1);

      expect(preheatSpy).toHaveBeenCalledWith('1399', 'tv', 1, 1);
      expect(streamPreheater.has('tv_1399_1_1')).toBe(true);
    });
  });

  describe('SeasonEpisodeList Preheating Behavior', () => {
    it('should preheat first and second episodes when episode list is populated', async () => {
      const tmdbId = '1399';
      const episodes = [
        { id: 101, episode_number: 1, season_number: 1, name: 'Winter Is Coming' },
        { id: 102, episode_number: 2, season_number: 1, name: 'The Kingsroad' },
        { id: 103, episode_number: 3, season_number: 1, name: 'Lord Snow' },
      ];

      // Simulate SeasonEpisodeList preheating logic
      const ep0 = episodes[0];
      const s0 = ep0.season_number ?? 1;
      const e0 = ep0.episode_number ?? 1;
      const key0 = streamPreheater.generateKey(tmdbId, 'tv', s0, e0);
      if (!streamPreheater.has(key0)) {
        await streamPreheater.preheat(tmdbId, 'tv', s0, e0);
      }

      if (episodes.length > 1) {
        const ep1 = episodes[1];
        const s1 = ep1.season_number ?? 1;
        const e1 = ep1.episode_number ?? 2;
        const key1 = streamPreheater.generateKey(tmdbId, 'tv', s1, e1);
        if (!streamPreheater.has(key1)) {
          await streamPreheater.preheat(tmdbId, 'tv', s1, e1);
        }
      }

      expect(preheatSpy).toHaveBeenCalledWith('1399', 'tv', 1, 1);
      expect(preheatSpy).toHaveBeenCalledWith('1399', 'tv', 1, 2);
      expect(streamPreheater.has('tv_1399_1_1')).toBe(true);
      expect(streamPreheater.has('tv_1399_1_2')).toBe(true);
      expect(streamPreheater.has('tv_1399_1_3')).toBe(false);
    });
  });

  describe('DetailView Preheating & Cache Access Behavior', () => {
    it('should preheat movie in DetailView and retrieve cached stream on play', async () => {
      const tmdbId = '603'; // The Matrix
      await streamPreheater.preheat(tmdbId, 'movie', 1, 1);

      const key = streamPreheater.generateKey(tmdbId, 'movie', 1, 1);
      const preheated = streamPreheater.get(key);

      expect(preheated).not.toBeNull();
      expect(preheated?.tmdbId).toBe('603');
      expect(preheated?.streamResult?.streamUrl).toBe('https://mock.stream/movie_603.m3u8');
    });

    it('should preheat continue-watching TV episode when available', async () => {
      const tmdbId = '1399';
      const cwSeason = 2;
      const cwEpisode = 3;

      await streamPreheater.preheat(tmdbId, 'tv', cwSeason, cwEpisode);

      const key = streamPreheater.generateKey(tmdbId, 'tv', cwSeason, cwEpisode);
      const preheated = streamPreheater.get(key);

      expect(preheated).not.toBeNull();
      expect(preheated?.season).toBe(2);
      expect(preheated?.episode).toBe(3);
    });

    it('should preheat newly selected season on handleSeasonChange', async () => {
      const tmdbId = '1399';
      const newlySelectedSeasonNum = 4;
      const firstEpisodeOfSeason = 1;

      await streamPreheater.preheat(tmdbId, 'tv', newlySelectedSeasonNum, firstEpisodeOfSeason);

      const key = streamPreheater.generateKey(tmdbId, 'tv', 4, 1);
      expect(streamPreheater.has(key)).toBe(true);
    });
  });

  describe('VideoPlayerView & useStreamResolver Fast-Path Cache Integration', () => {
    beforeEach(() => {
      streamSessionManager.clearSession();
      usePlayerStore.getState().reset();
    });

    it('should activate instant play when preheated stream is available in cache', async () => {
      const tmdbId = '550';
      const isMovie = true;
      const seasonNum = 1;
      const episodeNum = 1;

      // 1. Preheat stream
      await streamPreheater.preheat(tmdbId, 'movie', seasonNum, episodeNum);

      // 2. Fast-Path check (as performed in VideoPlayerView / useStreamResolver)
      const cacheKey = streamPreheater.generateKey(tmdbId, isMovie ? 'movie' : 'tv', seasonNum, episodeNum);
      const preheated = streamPreheater.get(cacheKey);

      expect(preheated?.streamResult?.streamUrl).toBe('https://mock.stream/movie_550.m3u8');

      if (preheated?.streamResult?.streamUrl) {
        streamSessionManager.setSession({
          streamUrl: preheated.streamResult.streamUrl,
          provider: preheated.streamResult.provider || 'Preheated Cache',
          expiresAt: Date.now() + 2 * 60 * 60 * 1000,
          headers: preheated.streamResult.headers || {},
        });
      }

      const activeSession = streamSessionManager.getSession();
      expect(activeSession?.streamUrl).toBe('https://mock.stream/movie_550.m3u8');
      expect(activeSession?.provider).toBe('MockProvider');
    });

    it('should resolve in-flight preheat request when playback begins while preheating is still ongoing', async () => {
      const tmdbId = '777';
      const isMovie = false;
      const seasonNum = 1;
      const episodeNum = 1;

      // Trigger preheating without awaiting
      const inFlightPromise = streamPreheater.preheat(tmdbId, 'tv', seasonNum, episodeNum);
      const cacheKey = streamPreheater.generateKey(tmdbId, isMovie ? 'movie' : 'tv', seasonNum, episodeNum);
      const preheated = streamPreheater.get(cacheKey);

      expect(preheated?.inFlightPromise).toBeDefined();

      // Fast-path in-flight resolution race
      const res = await Promise.race([
        preheated!.inFlightPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Preheat timeout')), 3500)),
      ]);

      expect(res?.streamResult?.streamUrl).toBe('https://mock.stream/tv_777.m3u8');

      if (res?.streamResult?.streamUrl) {
        streamSessionManager.setSession({
          streamUrl: res.streamResult.streamUrl,
          provider: res.streamResult.provider || 'Preheated Cache',
          expiresAt: Date.now() + 2 * 60 * 60 * 1000,
          headers: res.streamResult.headers || {},
        });
      }

      const activeSession = streamSessionManager.getSession();
      expect(activeSession?.streamUrl).toBe('https://mock.stream/tv_777.m3u8');
    });

    it('should support instant fast-path resolution with subtitles', async () => {
      const customKey = streamPreheater.generateKey('888', 'movie', 1, 1);
      streamPreheater.set(customKey, {
        key: customKey,
        tmdbId: '888',
        type: 'movie',
        season: 1,
        episode: 1,
        timestamp: Date.now(),
        streamResult: {
          streamUrl: 'https://mock.stream/movie_888.m3u8',
          provider: 'FastCache',
          subtitles: [
            { label: 'Turkish', lang: 'tr', url: 'https://subs.mock/tr.vtt' },
            { label: 'English', lang: 'en', url: 'https://subs.mock/en.vtt' },
          ],
        },
      });

      const cached = streamPreheater.get(customKey);
      expect(cached?.streamResult?.streamUrl).toBe('https://mock.stream/movie_888.m3u8');
      expect(cached?.streamResult?.subtitles?.length).toBe(2);

      // Apply fast-path
      if (cached?.streamResult) {
        usePlayerStore.getState().setStreamUrl(cached.streamResult.streamUrl);
        if (cached.streamResult.subtitles) {
          usePlayerStore.getState().setSubtitles(cached.streamResult.subtitles);
        }
      }

      expect(usePlayerStore.getState().streamUrl).toBe('https://mock.stream/movie_888.m3u8');
      expect(usePlayerStore.getState().subtitles.length).toBe(2);
      expect(usePlayerStore.getState().subtitles[0].lang).toBe('tr');
    });
  });
});
