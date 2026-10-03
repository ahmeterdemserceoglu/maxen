const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createDownloadManager } = require('./downloads');

const fixture = {
  '/master.m3u8': '#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",NAME="English",LANGUAGE="eng",URI="english.m3u8"\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",NAME="Italian",LANGUAGE="ita",URI="italian.m3u8"\n#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="s",NAME="Türkçe",LANGUAGE="tr",URI="turkish.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=1500000,AUDIO="a",SUBTITLES="s",CODECS="avc1.42e01e,mp4a.40.2"\nvideo.m3u8\n',
  '/video.m3u8': '#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXTINF:4,\nvideo.ts\n#EXT-X-ENDLIST\n',
  '/english.m3u8': '#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXTINF:4,\nenglish.aac\n#EXT-X-ENDLIST\n',
  '/italian.m3u8': '#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXTINF:4,\nitalian.aac\n#EXT-X-ENDLIST\n',
  '/turkish.m3u8': '#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXTINF:4,\nturkish.vtt\n#EXT-X-ENDLIST\n',
  '/video.ts': Buffer.from('VIDEO_PART'),
  '/english.aac': Buffer.from('ENGLISH_AUDIO'),
  '/italian.aac': Buffer.from('ITALIAN_AUDIO'),
  '/turkish.vtt': 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nMerhaba\n',
};

async function main() {
  const server = http.createServer((req, res) => {
    const body = fixture[req.url];
    if (!body) { res.writeHead(404); res.end(); return; }
    res.end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maxen-download-test-'));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const manager = createDownloadManager({ directory: root, resolveSource: async () => ({ streamUrl: `${base}/master.m3u8`, headers: {} }), fetchSource: fetch });
    const item = { id: 42, type: 'movie', title: 'Deneme' };
    const params = { tmdbId: 42, type: 'movie', season: 1, episode: 1 };
    const options = await manager.options(params);
    assert.deepEqual(options.audio.map((entry) => entry.label), ['English', 'Italian']);
    assert.deepEqual(options.subtitles.map((entry) => entry.label), ['Türkçe']);
    assert.throws(() => manager.start({ token: options.token, item }), /ses seçmelisiniz/i);
    const entry = manager.start({ token: options.token, audioId: options.audio[0].id, subtitleId: options.subtitles[0].id, item });
    for (let i = 0; i < 100 && manager.list()[0].status === 'downloading'; i++) await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(manager.list()[0].status, 'complete', manager.list()[0].error);
    const folder = path.join(root, entry.id);
    const master = await fs.readFile(path.join(folder, 'master.m3u8'), 'utf8');
    assert.match(master, /offline-audio/);
    assert.match(master, /offline-subtitles/);
    assert.doesNotMatch(master, /http:/);
    assert.equal(await fs.readFile(path.join(folder, 'audio-segment-0.aac'), 'utf8'), 'ENGLISH_AUDIO');
    assert.equal(await fs.readFile(path.join(folder, 'subtitle-segment-0.vtt'), 'utf8'), fixture['/turkish.vtt']);
    assert.equal((JSON.parse(await fs.readFile(path.join(root, 'downloads.json.bak'), 'utf8')))[0].status, 'complete');
    assert.equal((JSON.parse(await fs.readFile(path.join(folder, 'metadata.json'), 'utf8')))[0].item.title, 'Deneme');
    await fs.writeFile(path.join(root, 'downloads.json'), '{bozuk');
    const listing = createDownloadManager({ directory: root, resolveSource: async () => { throw new Error('offline'); }, fetchSource: fetch }).list();
    assert.equal(listing[0].status, 'complete');
    await fs.writeFile(path.join(root, 'downloads.json'), '{bozuk');
    await fs.writeFile(path.join(root, 'downloads.json.bak'), '{bozuk');
    const restored = createDownloadManager({ directory: root, resolveSource: async () => { throw new Error('offline'); }, fetchSource: fetch }).list();
    assert.equal(restored[0].item.title, 'Deneme');
    await manager.remove(entry.id);
    await assert.rejects(fs.stat(folder), { code: 'ENOENT' });
    assert.equal(manager.list().length, 0);
    console.log('Download options, mandatory audio, optional subtitle, offline files and full deletion: OK');
  } finally {
    server.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
