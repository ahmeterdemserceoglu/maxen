const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maxen-offline-test-'));
  const downloadDir = path.join(root, 'downloads');
  const folder = path.join(downloadDir, 'offline-film');
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, 'video.mp4'), 'LOCAL_VIDEO');
  await fs.writeFile(path.join(downloadDir, 'downloads.json'), JSON.stringify([{ id: 'offline-film', item: { id: 42, type: 'movie', title: 'Çevrimdışı Film' }, season: 1, episode: 1, audioLabel: 'Türkçe', subtitleLabel: '', status: 'complete', file: 'video.mp4' }]));
  process.env.MAXEN_PLAYER_PORT = '0';
  process.env.MAXEN_CACHE_DIR = path.join(root, 'cache');
  process.env.MAXEN_DOWNLOAD_DIR = downloadDir;
  global.fetch = async () => { throw new Error('fetch failed'); };
  const { server, startServer } = require('./server');
  try {
    const { port } = await startServer();
    const base = `http://127.0.0.1:${port}`;
    const get = (url) => new Promise((resolve, reject) => {
      http.get(url, (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString() }));
      }).on('error', reject);
    });
    const home = await get(`${base}/api/home`);
    assert.equal(home.status, 200);
    assert.equal(JSON.parse(home.body).offline, true);
    assert.equal(JSON.parse(home.body).downloads[0].item.title, 'Çevrimdışı Film');
    const downloads = await get(`${base}/api/downloads`);
    assert.equal(JSON.parse(downloads.body).downloads.length, 1);
    const video = await get(`${base}/api/download/file/offline-film/video.mp4`);
    assert.equal(video.body, 'LOCAL_VIDEO');
    console.log('Offline home, download list and local playback file: OK');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
