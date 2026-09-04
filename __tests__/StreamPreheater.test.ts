import {
  streamPreheater,
  StreamPreheaterService,
  PreheatedData,
} from '../src/features/player/services/StreamPreheater';

// Mock dependencies
jest.mock('../src/features/player/services/introService', () => ({
  fetchEpisodeIntro: jest.fn().mockImplementation(async (tmdbId, season, episode) => {
    if (tmdbId === 'fail') throw new Error('Intro fetch failed');
    return {
      hasIntro: true,
      intro: { start_sec: 10, end_sec: 90 },
    };
  }),
}));

jest.mock('../src/services/api/tmdbService', () => ({
  fetchMediaSceneThumbnails: jest.fn().mockImplementation(async (tmdbId, type, season, episode) => {
    if (tmdbId === 'fail') throw new Error('Thumbnail fetch failed');
    return [
      'https://image.tmdb.org/t/p/w300/thumb1.jpg',
      'https://image.tmdb.org/t/p/w300/thumb2.jpg',
    ];
  }),
}));

jest.mock('../src/features/player/services/streamResolverService', () => ({
  resolveParallelDirectStreamResult: jest.fn().mockImplementation(async ({ tmdbId, isMovie }) => {
    if (tmdbId === 'fail') return null;
    return {
      streamUrl: `https://mock.stream/video_${tmdbId}.m3u8`,
      provider: 'MockProvider',
      headers: { 'User-Agent': 'TestAgent' },
    };
  }),
  resolveParallelDirectStream: jest.fn().mockImplementation(async () => true),
}));

describe('StreamPreheater Service & LRU Cache Unit Tests', () => {
  beforeEach(() => {
    streamPreheater.clear();
    jest.clearAllMocks();
  });

  describe('Key Generation', () => {
    it('should generate expected key format for movie with default params', () => {
      const key = streamPreheater.generateKey('12345', 'movie');
      expect(key).toBe('movie_12345_1_1');
    });

    it('should generate expected key format for movie with numeric tmdbId', () => {
      const key = streamPreheater.generateKey(550, 'movie', 1, 1);
      expect(key).toBe('movie_550_1_1');
    });

    it('should generate expected key format for TV series with season and episode', () => {
      const key = streamPreheater.generateKey('67890', 'tv', 2, 4);
      expect(key).toBe('tv_67890_2_4');
    });

    it('should handle case insensitivity and string inputs for type', () => {
      const key1 = streamPreheater.generateKey(1399, 'TV', 3, 10);
      expect(key1).toBe('tv_1399_3_10');

      const key2 = streamPreheater.generateKey(550, 'MOVIE', 1, 1);
      expect(key2).toBe('movie_550_1_1');
    });
  });

  describe('Cache, TTL and LRU Operations', () => {
    it('should store and retrieve preheated data within TTL', () => {
      const testData: PreheatedData = {
        key: 'movie_100_1_1',
        tmdbId: '100',
        type: 'movie',
        season: 1,
        episode: 1,
        streamResult: {
          streamUrl: 'https://test.m3u8',
          provider: 'Test',
        },
        timestamp: Date.now(),
      };

      streamPreheater.set(testData.key, testData);
      expect(streamPreheater.has('movie_100_1_1')).toBe(true);
      expect(streamPreheater.get('movie_100_1_1')).toEqual(testData);
      expect(streamPreheater.size).toBe(1);
    });

    it('should return null and purge expired item beyond TTL', () => {
      // Create a service instance with a short TTL (50ms)
      const shortLivedService = new StreamPreheaterService(50, 10);

      const oldData: PreheatedData = {
        key: 'movie_200_1_1',
        tmdbId: '200',
        type: 'movie',
        season: 1,
        episode: 1,
        timestamp: Date.now() - 100, // 100ms old (> 50ms TTL)
      };

      shortLivedService.set(oldData.key, oldData);
      expect(shortLivedService.get('movie_200_1_1')).toBeNull();
      expect(shortLivedService.size).toBe(0);
    });

    it('should clear all cache items on clear()', () => {
      streamPreheater.set('movie_1_1_1', {
        key: 'movie_1_1_1',
        tmdbId: '1',
        type: 'movie',
        season: 1,
        episode: 1,
        timestamp: Date.now(),
      });
      streamPreheater.set('tv_2_1_1', {
        key: 'tv_2_1_1',
        tmdbId: '2',
        type: 'tv',
        season: 1,
        episode: 1,
        timestamp: Date.now(),
      });

      expect(streamPreheater.size).toBe(2);
      streamPreheater.clear();
      expect(streamPreheater.size).toBe(0);
      expect(streamPreheater.get('movie_1_1_1')).toBeNull();
    });

    it('should evict least recently used (LRU) item when max size is exceeded', () => {
      // Create an instance with capacity of 3 items
      const lruService = new StreamPreheaterService(15 * 60 * 1000, 3);

      lruService.set('item_1', { key: 'item_1', tmdbId: '1', type: 'movie', season: 1, episode: 1, timestamp: Date.now() });
      lruService.set('item_2', { key: 'item_2', tmdbId: '2', type: 'movie', season: 1, episode: 1, timestamp: Date.now() });
      lruService.set('item_3', { key: 'item_3', tmdbId: '3', type: 'movie', season: 1, episode: 1, timestamp: Date.now() });

      expect(lruService.size).toBe(3);

      // Access item_1 to mark it as most recently used
      lruService.get('item_1');

      // Add item_4 -> should evict item_2 (oldest unaccessed item)
      lruService.set('item_4', { key: 'item_4', tmdbId: '4', type: 'movie', season: 1, episode: 1, timestamp: Date.now() });

      expect(lruService.size).toBe(3);
      expect(lruService.get('item_2')).toBeNull(); // evicted
      expect(lruService.get('item_1')).not.toBeNull(); // retained
      expect(lruService.get('item_3')).not.toBeNull(); // retained
      expect(lruService.get('item_4')).not.toBeNull(); // retained
    });
  });

  describe('Preheat Operations', () => {
    it('should preheat TV series data including stream, intro, and thumbnails', async () => {
      const data = await streamPreheater.preheat('1399', 'tv', 1, 1);

      expect(data).toBeDefined();
      expect(data.key).toBe('tv_1399_1_1');
      expect(data.tmdbId).toBe('1399');
      expect(data.type).toBe('tv');
      expect(data.season).toBe(1);
      expect(data.episode).toBe(1);
      expect(data.streamResult?.streamUrl).toBe('https://mock.stream/video_1399.m3u8');
      expect(data.introData?.hasIntro).toBe(true);
      expect(data.introData?.intro?.start_sec).toBe(10);
      expect(data.sceneThumbnails?.length).toBe(2);
    });

    it('should return cached data immediately when already preheated with streamResult', async () => {
      const first = await streamPreheater.preheat('550', 'movie', 1, 1);
      expect(first.streamResult?.streamUrl).toBe('https://mock.stream/video_550.m3u8');

      // Second call should return cached object immediately
      const second = await streamPreheater.preheat('550', 'movie', 1, 1);
      expect(second).toBe(first);
    });

    it('should deduplicate concurrent preheat calls and share in-flight promise', async () => {
      const promise1 = streamPreheater.preheat('999', 'movie', 1, 1);
      const promise2 = streamPreheater.preheat('999', 'movie', 1, 1);

      const [res1, res2] = await Promise.all([promise1, promise2]);
      expect(res1).toBe(res2);
      expect(res1.key).toBe('movie_999_1_1');
    });

    it('should support preheatDirect with custom resolver function', async () => {
      const customResolver = jest.fn().mockResolvedValue({
        streamUrl: 'https://custom.stream/direct.m3u8',
        provider: 'CustomDirect',
        headers: { 'X-Custom': '1' },
      });

      const data = await streamPreheater.preheatDirect('888', 'movie', 1, 1, customResolver);

      expect(customResolver).toHaveBeenCalledTimes(1);
      expect(data.streamResult?.streamUrl).toBe('https://custom.stream/direct.m3u8');
      expect(data.streamResult?.provider).toBe('CustomDirect');
    });

    it('should handle failures gracefully without throwing unhandled exceptions', async () => {
      const data = await streamPreheater.preheat('fail', 'tv', 1, 1);

      expect(data).toBeDefined();
      expect(data.streamResult).toBeNull();
      expect(data.introData).toBeNull();
      expect(data.sceneThumbnails).toEqual([]);
    });
  });
});
