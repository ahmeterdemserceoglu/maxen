import {
  COMPLETION_THRESHOLD,
  createGenerationGuard,
  getAdjustedVolume,
  getContinueWatchingDocId,
  getPlaybackMediaKey,
  isAiredEpisode,
  isEpisodeAdjacent,
  isPreheatedPayloadForMedia,
  selectLatestContinueWatching,
  SerialWriteQueue,
  shouldRotateFailedStream,
} from '../src/utils/playerReliability';
import { getEpisodeProgress } from '../src/utils/watchProgress';
import { StreamSessionManager } from '../src/features/player/services/StreamSessionManager';

describe('continue watching identity and ordering', () => {
  test('uses one stable document per show but keeps movies separate', () => {
    expect(getContinueWatchingDocId({ type: 'tv', tmdbId: '123', season_number: 5, episode_number: 2 }))
      .toBe('tv_123');
    expect(getContinueWatchingDocId({ type: 'movie', tmdbId: '123' })).toBe('movie_123');
  });

  test('selects the latest timestamp instead of the highest episode number', () => {
    const latest = selectLatestContinueWatching([
      { type: 'tv', tmdbId: '123', season_number: 5, episode_number: 9, savedAt: 1000 },
      { type: 'tv', tmdbId: '123', season_number: 1, episode_number: 2, savedAt: 1001 },
    ]);
    expect(latest).toHaveLength(1);
    expect(latest[0].episode_number).toBe(2);
  });

  test('serializes writes for the same media key', async () => {
    const queue = new SerialWriteQueue();
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });

    const first = queue.enqueue('tv_123', async () => {
      events.push('first-start');
      await firstGate;
      events.push('first-end');
    });
    const second = queue.enqueue('tv_123', async () => {
      events.push('second');
    });

    await Promise.resolve();
    expect(events).toEqual(['first-start']);
    releaseFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(['first-start', 'first-end', 'second']);
  });
});

describe('async generation and media identity guards', () => {
  test('invalidates results created by an older playback generation', () => {
    const guard = createGenerationGuard();
    const oldGeneration = guard.current();
    guard.advance();
    expect(guard.isCurrent(oldGeneration)).toBe(false);
    expect(guard.isCurrent(guard.current())).toBe(true);
  });

  test('stream sessions require an exact media key', () => {
    const manager = new StreamSessionManager();
    expect(manager.setSession({
      streamUrl: 'https://cdn.example/video.m3u8',
      provider: 'test',
      expiresAt: 0,
    } as any)).toBe(false);
    expect(manager.getSession()).toBeNull();
    expect(manager.setSession({
      streamUrl: 'https://cdn.example/video.m3u8',
      provider: 'test',
      expiresAt: 0,
      mediaKey: 'tv_42_2_3',
    })).toBe(true);
  });

  test('old player cleanup cannot clear or refresh a newer media session', async () => {
    const manager = new StreamSessionManager();
    const refresh = jest.fn(async () => undefined);
    manager.setSession({ streamUrl: 'a', provider: 'a', expiresAt: 0, mediaKey: 'tv_a' });
    manager.setRefreshHandler('tv_a', refresh);
    manager.setSession({ streamUrl: 'b', provider: 'b', expiresAt: 0, mediaKey: 'tv_b' });

    expect(manager.clearSession('tv_a')).toBe(false);
    expect(manager.getSession()?.mediaKey).toBe('tv_b');
    expect(manager.clearRefreshHandler('tv_a')).toBe(true);
    expect(refresh).not.toHaveBeenCalled();
  });

  test('rotates provider after bounded retries of the same stream', () => {
    expect(shouldRotateFailedStream(1, 3)).toBe(false);
    expect(shouldRotateFailedStream(2, 3)).toBe(false);
    expect(shouldRotateFailedStream(3, 3)).toBe(true);
  });

  test('accepts preheated data only for the exact episode identity', () => {
    const current = { type: 'tv', tmdbId: '42', season_number: 2, episode_number: 3 };
    expect(isPreheatedPayloadForMedia({ mediaKey: 'tv_42_S2E3' }, current)).toBe(true);
    expect(isPreheatedPayloadForMedia({ mediaKey: 'tv_42_2_3' }, current)).toBe(true);
    expect(isPreheatedPayloadForMedia({ mediaKey: 'tv_42_S2E2' }, current)).toBe(false);
    expect(isPreheatedPayloadForMedia({}, current)).toBe(false);
  });
});

describe('episode and remote safeguards', () => {
  test('watch party media keys change with the episode', () => {
    expect(getPlaybackMediaKey({ type: 'tv', tmdbId: '42', seasonNumber: 2, episodeNumber: 3 }))
      .toBe('tv_42_2_3');
    expect(getPlaybackMediaKey({ type: 'tv', tmdbId: '42', seasonNumber: 2, episodeNumber: 4 }))
      .toBe('tv_42_2_4');
  });

  test('playlist episodes must be adjacent and already aired', () => {
    expect(isEpisodeAdjacent(
      { season_number: 2, episode_number: 3 },
      { season_number: 2, episode_number: 4 },
    )).toBe(true);
    expect(isEpisodeAdjacent(
      { season_number: 2, episode_number: 3 },
      { season_number: 2, episode_number: 7 },
    )).toBe(false);
    expect(isAiredEpisode({ air_date: '2026-09-15' }, new Date('2026-09-16T12:00:00Z'))).toBe(true);
    expect(isAiredEpisode({ air_date: '2026-09-20' }, new Date('2026-09-16T12:00:00Z'))).toBe(false);
  });

  test('volume changes preserve a real zero value', () => {
    expect(getAdjustedVolume(0, 0.1)).toBe(0.1);
    expect(getAdjustedVolume(1, 0.1)).toBe(1);
    expect(getAdjustedVolume(undefined, -0.1)).toBe(0.9);
  });
});

describe('watch progress calculation', () => {
  test('returns 1.0 for episodes prior to current watched episode in a series', () => {
    const records = [
      {
        tmdbId: 100,
        type: 'tv',
        season_number: 2,
        episode_number: 3,
        progress: 0.4,
      },
    ];

    // Previous season
    expect(getEpisodeProgress(records, 100, { season_number: 1, episode_number: 10 })).toBe(1.0);
    // Earlier episode in same season
    expect(getEpisodeProgress(records, 100, { season_number: 2, episode_number: 2 })).toBe(1.0);
    // Current episode
    expect(getEpisodeProgress(records, 100, { season_number: 2, episode_number: 3 })).toBe(0.4);
    // Later episode in same season
    expect(getEpisodeProgress(records, 100, { season_number: 2, episode_number: 4 })).toBe(0);
    // Future season
    expect(getEpisodeProgress(records, 100, { season_number: 3, episode_number: 1 })).toBe(0);
  });
});
