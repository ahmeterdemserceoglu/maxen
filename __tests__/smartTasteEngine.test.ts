import {
  computeUserTasteProfile,
  fetchSmartRecommendations,
  TasteProfile,
} from '../src/services/recommendation/smartTasteEngine';
import * as profileMediaService from '../src/services/profileMediaService';

jest.mock('../src/services/profileMediaService');
const mockedProfileService = profileMediaService as jest.Mocked<typeof profileMediaService>;

describe('Smart Taste Profile Recommendation Engine Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as any;
  });

  describe('computeUserTasteProfile', () => {
    it('should compute weighted seeds prioritizing completed continue-watching items and favorites', async () => {
      // Mock continue watching: item 101 is 90% completed (+3.0), item 102 is 20% (< 40% -> 0 weight)
      mockedProfileService.getContinueWatching.mockResolvedValueOnce([
        { id: '101', tmdbId: '101', progress: 0.9, type: 'movie', title: 'Inception' } as any,
        { id: '102', tmdbId: '102', progress: 0.2, type: 'movie', title: 'Low Progress' } as any,
      ]);

      // Mock favorites: item 201 (+2.5), item 101 (+2.5 -> total for 101 will be 3.0 + 2.5 = 5.5)
      mockedProfileService.getFavorites.mockResolvedValueOnce([
        { id: '201', tmdbId: '201', type: 'movie', title: 'Interstellar' } as any,
        { id: '101', tmdbId: '101', type: 'movie', title: 'Inception' } as any,
      ]);

      // Mock watch later: item 301 (+1.0)
      mockedProfileService.getWatchLater.mockResolvedValueOnce([
        { id: '301', tmdbId: '301', type: 'movie', title: 'Oppenheimer' } as any,
      ]);

      const profile = await computeUserTasteProfile('user123', 'profile456');

      expect(profile.hasSufficientData).toBe(true);
      // Item 101 should be top seed because it has the highest accumulated weight (5.5)
      expect(profile.seedTmdbIds[0]).toBe('101');
      expect(profile.seedTmdbIds).toContain('201');
      expect(profile.seedTmdbIds).toContain('301');
    });

    it('should handle cold-start with no watch history gracefully', async () => {
      mockedProfileService.getContinueWatching.mockResolvedValueOnce([]);
      mockedProfileService.getFavorites.mockResolvedValueOnce([]);
      mockedProfileService.getWatchLater.mockResolvedValueOnce([]);

      const profile = await computeUserTasteProfile('new_user', 'profile1');

      expect(profile.hasSufficientData).toBe(false);
      expect(profile.seedTmdbIds).toEqual([]);
      expect(profile.totalInteractions).toBe(0);
    });

    it('should handle service errors gracefully without throwing', async () => {
      mockedProfileService.getContinueWatching.mockRejectedValueOnce(new Error('Network error'));
      mockedProfileService.getFavorites.mockRejectedValueOnce(new Error('Firestore error'));
      mockedProfileService.getWatchLater.mockRejectedValueOnce(new Error('Auth error'));

      const profile = await computeUserTasteProfile('user123', 'profile1');

      expect(profile.hasSufficientData).toBe(false);
      expect(profile.seedTmdbIds).toEqual([]);
    });
  });

  describe('fetchSmartRecommendations', () => {
    it('should fetch and deduplicate recommendations for computed seed IDs', async () => {
      const mockTasteProfile: TasteProfile = {
        seedTmdbIds: ['101', '201'],
        totalInteractions: 5,
        hasSufficientData: true,
      };

      const mockTmdbRecs = {
        results: [
          { id: 501, title: 'Tenet', vote_average: 7.5, poster_path: '/tenet.jpg' },
          { id: 502, title: 'Memento', vote_average: 8.4, poster_path: '/memento.jpg' },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockTmdbRecs,
      });

      const recommendations = await fetchSmartRecommendations(mockTasteProfile);

      expect(recommendations.length).toBeGreaterThan(0);
      // Verify higher rated movie is first
      expect(recommendations[0].title).toBe('Memento');
    });

    it('should fallback to trending recommendations on cold-start profile', async () => {
      const coldTasteProfile: TasteProfile = {
        seedTmdbIds: [],
        totalInteractions: 0,
        hasSufficientData: false,
      };

      const mockTrending = {
        results: [
          { id: 999, title: 'Trending Hit', vote_average: 8.1, poster_path: '/hit.jpg' },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTrending,
      });

      const recommendations = await fetchSmartRecommendations(coldTasteProfile);

      expect(recommendations.length).toBe(1);
      expect(recommendations[0].title).toBe('Trending Hit');
    });
  });
});
