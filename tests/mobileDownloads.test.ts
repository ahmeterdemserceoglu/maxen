import { createHash } from 'crypto';
import { buildOfflineHlsPlan } from '../src/services/offlineHls';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/', getInfoAsync: jest.fn(),
  getFreeDiskStorageAsync: jest.fn(), makeDirectoryAsync: jest.fn(),
  writeAsStringAsync: jest.fn(), readAsStringAsync: jest.fn(), deleteAsync: jest.fn(),
  createDownloadResumable: jest.fn(),
}));

const manifest = '#EXTM3U\n#EXTINF:5,\nsegments/a.ts\n#EXT-X-ENDLIST';
const media = { id: 'movie_1', tmdbId: '1', type: 'movie' as const, title: 'Test', streamUrl: 'https://cdn.test/main.m3u8' };
let service: typeof import('../src/services/downloadService');
let native: any;
let storage: any;
let files: Map<string, string>;
let jobs: any[];
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
async function settled() {
  for (let i = 0; i < 30; i++) await tick();
  return (await service.getDownloads())[0];
}
beforeEach(async () => {
  jest.resetModules();
  native = require('expo-file-system/legacy');
  const storageModule = require('@react-native-async-storage/async-storage');
  storage = storageModule.default || storageModule;
  await storage.clear();
  files = new Map(); jobs = [];
  native.getFreeDiskStorageAsync.mockResolvedValue(10e9);
  native.makeDirectoryAsync.mockImplementation(async (uri: string) => { files.set(uri, 'directory'); });
  native.getInfoAsync.mockImplementation(async (uri: string) => files.has(uri) ? {
    exists: true, size: Buffer.byteLength(files.get(uri)!), modificationTime: 1,
    md5: createHash('md5').update(files.get(uri)!).digest('hex'),
  } : { exists: false });
  native.writeAsStringAsync.mockImplementation(async (uri: string, data: string) => { files.set(uri, data); });
  native.readAsStringAsync.mockImplementation(async (uri: string) => { if (!files.has(uri)) throw new Error('missing'); return files.get(uri); });
  native.deleteAsync.mockImplementation(async (uri: string) => { for (const k of files.keys()) if (k.startsWith(uri)) files.delete(k); });
  native.createDownloadResumable.mockImplementation((url: string, uri: string, options: any, progress: any, resumeData: any) => {
    const complete = async () => { files.set(uri, 'video bytes'); return { status: resumeData ? 206 : 200, uri, headers: { 'Content-Type': 'video/mp4' } }; };
    const job = { downloadAsync: jest.fn(complete), resumeAsync: jest.fn(complete), pauseAsync: jest.fn(async () => ({ resumeData: '42' })), url, uri, options, progress, resumeData };
    jobs.push(job); return job;
  });
  global.fetch = jest.fn(async (url: any) => ({ ok: true, status: 200, url, text: async () => manifest })) as any;
  service = require('../src/services/downloadService');
});

test('relative segment paths stay segments; completed HLS is fully local', async () => {
  await service.queueDownload(media);
  const item = await settled();
  expect(item.status).toBe('completed');
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(jobs[0].url).toBe('https://cdn.test/segments/a.ts');
  expect(await service.verifyDownloadIntegrity(item)).toBe(true);
  files.delete(jobs[0].uri);
  expect(await service.verifyDownloadIntegrity(item)).toBe(false);
});
test('same-size corruption is detected without relying on modification time', async () => {
  await service.queueDownload(media); const item = await settled();
  files.set(jobs[0].uri, 'wrong bytes');
  expect(await service.verifyDownloadIntegrity(item)).toBe(false);
});
test('404 MP4 is an error and invalid file is removed', async () => {
  native.createDownloadResumable.mockImplementation((url: string, uri: string) => ({ downloadAsync: async () => { files.set(uri, '404'); return { status: 404, uri }; } }));
  await service.queueDownload({ ...media, streamUrl: 'https://cdn.test/video.mp4' });
  expect((await settled()).status).toBe('error');
  expect(files.has('file:///documents/maxen_downloads/movie_1/video.mp4')).toBe(false);
});
test('one missing HLS segment fails the entire download after retries', async () => {
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
  native.createDownloadResumable.mockImplementation(() => ({ downloadAsync: async () => ({ status: 500 }), pauseAsync: async () => ({}) }));
  await service.queueDownload(media);
  for (let i = 0; i < 5; i++) { await tick(); await jest.runOnlyPendingTimersAsync(); }
  expect((await settled()).status).toBe('error');
  jest.useRealTimers();
});
test.each(['queued', 'downloading'])('startup recovers persisted %s jobs', async status => {
  await storage.setItem('@maxen_downloads_v1', JSON.stringify([{ ...media, status, progress: 0 }]));
  await service.getDownloads(); await new Promise(r => setTimeout(r, 10));
  expect((await settled()).status).toBe('completed');
});
test('reading download list during an active job preserves queue object identity', async () => {
  let finish!: () => void;
  native.createDownloadResumable.mockImplementation((url: string, uri: string) => ({ downloadAsync: () => new Promise(resolve => { finish = () => { files.set(uri, 'video'); resolve({ status: 200, uri }); }; }) }));
  await service.queueDownload({ ...media, streamUrl: 'https://cdn.test/video.mp4' });
  await settled(); await service.getDownloads(); finish();
  expect((await settled()).status).toBe('completed');
});
test('pause saves native resume data; resume calls resumeAsync', async () => {
  let release!: () => void;
  native.createDownloadResumable.mockImplementationOnce((url: string, uri: string) => ({
    downloadAsync: () => new Promise(resolve => { release = () => resolve(undefined); }),
    pauseAsync: async () => { files.set(uri, 'x'.repeat(42)); release(); return { resumeData: '42' }; },
  }));
  await service.queueDownload({ ...media, streamUrl: 'https://cdn.test/video.mp4' }); await settled();
  await service.pauseDownload(media.id);
  expect((await service.getDownloads())[0]).toMatchObject({ status: 'paused', resumeData: '42' });
  await service.resumeDownload(media.id); await settled();
  expect(jobs[0].resumeData).toBe('42');
  expect(jobs[0].resumeAsync).toHaveBeenCalledTimes(1);
  expect(jobs[0].downloadAsync).not.toHaveBeenCalled();
});
test('deleting active work waits for paused native writers before removing files', async () => {
  let release!: () => void; const events: string[] = [];
  native.createDownloadResumable.mockImplementationOnce((url: string, uri: string) => ({
    downloadAsync: () => new Promise(resolve => { release = () => { files.set(uri, 'partial'); events.push('write'); resolve(undefined); }; }),
    pauseAsync: async () => { release(); events.push('pause'); return {}; },
  }));
  await service.queueDownload({ ...media, streamUrl: 'https://cdn.test/video.mp4' }); await settled();
  await service.deleteDownload(media.id);
  expect(events).toEqual(['write', 'pause']);
  expect(await service.getDownloads()).toEqual([]);
  expect([...files.keys()].filter(k => k.includes('movie_1'))).toEqual([]);
});
test('rotating encryption keys and fMP4 initialization get distinct local resources', async () => {
  const text = '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXT-X-KEY:METHOD=AES-128,URI="key1"\n#EXTINF:5,\na.m4s\n#EXT-X-KEY:METHOD=AES-128,URI="key2"\n#EXTINF:5,\nb.m4s\n#EXT-X-ENDLIST';
  const plan = await buildOfflineHlsPlan(media.streamUrl, async url => ({ text, url }));
  expect(plan.assets.filter(a => a.key).map(a => a.file)).toEqual(['asset_1.key', 'asset_3.key']);
  expect(plan.playlists[plan.entry]).toContain('URI="asset_0.mp4"');
  expect(plan.assets).toHaveLength(5);
});
test('external audio in a master playlist is downloaded alongside video', async () => {
  const master = '#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="sound",NAME="English",DEFAULT=YES,URI="audio.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=1000,AUDIO="sound"\nvideo.m3u8';
  const plan = await buildOfflineHlsPlan(media.streamUrl, async url => ({ text: url === media.streamUrl ? master : manifest, url }));
  expect(Object.keys(plan.playlists)).toHaveLength(3);
  expect(plan.playlists[plan.entry]).toContain('AUDIO="sound"');
  expect(plan.playlists[plan.entry]).not.toContain('https:');
});
test('byte ranges become separate local files with correct HTTP ranges', async () => {
  const text = '#EXTM3U\n#EXTINF:5,\n#EXT-X-BYTERANGE:4@0\nall.mp4\n#EXTINF:5,\n#EXT-X-BYTERANGE:4\nall.mp4\n#EXT-X-ENDLIST';
  const plan = await buildOfflineHlsPlan(media.streamUrl, async url => ({ text, url }));
  expect(plan.assets.map(a => a.range)).toEqual([{ start: 0, length: 4 }, { start: 4, length: 4 }]);
  expect(plan.playlists[plan.entry]).not.toContain('#EXT-X-BYTERANGE');
});

test('completed resources are reused after HLS retry; partial bytes are never trusted', async () => {
  await service.queueDownload(media); await settled();
  const firstJobCount = jobs.length;
  // Force a retry by removing the manifest while retaining verified segment receipts.
  files.delete('file:///documents/maxen_downloads/movie_1/local_playlist.m3u8');
  await service.queueDownload(media);
  expect((await settled()).status).toBe('completed');
  expect(jobs.length).toBe(firstJobCount);
});
test('concurrent enqueues deduplicate the same media', async () => {
  await Promise.all([service.queueDownload(media), service.queueDownload(media)]);
  await settled();
  expect(await service.getDownloads()).toHaveLength(1);
  expect(jobs).toHaveLength(1);
});
test('explicit provider headers reach manifest and segment requests', async () => {
  await service.queueDownload({ ...media, headers: { Referer: 'https://provider.test/', Authorization: 'fixture' } });
  await settled();
  expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Referer).toBe('https://provider.test/');
  expect(jobs[0].options.headers.Authorization).toBe('fixture');
});
test('live playlists are rejected without a misleading completed entry', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, text: async () => '#EXTM3U\n#EXTINF:5,\na.ts' });
  await service.queueDownload(media);
  expect((await settled()).status).toBe('error');
  expect(jobs).toHaveLength(0);
});
test('default master subtitles are localized with their WebVTT segments', async () => {
  const master = '#EXTM3U\n#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Turkish",LANGUAGE="tr",URI="subs.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=1000,SUBTITLES="subs"\nvideo.m3u8';
  const plan = await buildOfflineHlsPlan(media.streamUrl, async url => ({ text: url === media.streamUrl ? master : url.includes('subs.m3u8') ? manifest.replace('segments/a.ts', 'a.vtt') : manifest, url }));
  expect(plan.assets.some(a => a.file.endsWith('.vtt'))).toBe(true);
  expect(plan.playlists[plan.entry]).toContain('SUBTITLES="subs"');
});

test('pausing HLS stops segment writers and resume does not trust their partial files', async () => {
  let release!: () => void;
  native.createDownloadResumable.mockImplementationOnce((url: string, uri: string) => ({
    downloadAsync: () => new Promise(resolve => { release = () => { files.set(uri, 'partial'); resolve(undefined); }; }),
    pauseAsync: async () => { release(); return {}; },
  }));
  await service.queueDownload(media); await settled();
  await service.pauseDownload(media.id);
  expect((await service.getDownloads())[0].status).toBe('paused');
  await service.resumeDownload(media.id);
  expect((await settled()).status).toBe('completed');
  expect(files.get(jobs[0].uri)).toBe('video bytes');
});

test('switching episodes removes stale offline flags and stream URLs', () => {
  const { withoutStaleEpisodePlayback } = require('../src/utils/episodePlayback');
  expect(withoutStaleEpisodePlayback({ tmdbId: '1', isOfflinePlayback: true, savedStreamUrl: 'file:///old', episode_number: 2 }))
    .toEqual({ tmdbId: '1', episode_number: 2, positionSeconds: 0 });
});
