const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

function attributes(line) {
  const result = {};
  for (const match of line.matchAll(/([A-Z0-9-]+)=("(?:[^"\\]|\\.)*"|[^,]*)/g)) {
    result[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  return result;
}

function mediaLines(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function masterInfo(text, url) {
  const lines = mediaLines(text);
  const media = lines.filter((line) => line.startsWith('#EXT-X-MEDIA:')).map((line) => attributes(line.slice(13)));
  const variants = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('#EXT-X-STREAM-INF:')) continue;
    const next = lines.slice(i + 1).find((line) => !line.startsWith('#'));
    if (next) variants.push({ ...attributes(lines[i].slice(18)), url: new URL(next, url).toString() });
  }
  return {
    variants,
    audio: media.filter((entry) => entry.TYPE === 'AUDIO' && entry.URI).map((entry, index) => ({ ...entry, id: `audio-${index}`, url: new URL(entry.URI, url).toString() })),
    subtitles: media.filter((entry) => entry.TYPE === 'SUBTITLES' && entry.URI).map((entry, index) => ({ ...entry, id: `subtitle-${index}`, url: new URL(entry.URI, url).toString() })),
  };
}

function extension(url, fallback) {
  try { return path.extname(new URL(url).pathname).slice(0, 8).replace(/[^.a-zA-Z0-9]/g, '') || fallback; }
  catch { return fallback; }
}

function createDownloadManager({ directory, resolveSource, fetchSource }) {
  const indexFile = path.join(directory, 'downloads.json');
  const backupFile = path.join(directory, 'downloads.json.bak');
  const sessions = new Map();
  const posterRequests = new Map();
  function readIndex(file) {
    try {
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      return Array.isArray(value) ? value : null;
    } catch { return null; }
  }
  function recoverFolders() {
    let folders = [];
    try { folders = fs.readdirSync(directory, { withFileTypes: true }).filter((value) => value.isDirectory()); } catch {}
    return folders.flatMap((folder) => {
      const location = path.join(directory, folder.name);
      let entry = readIndex(path.join(location, 'metadata.json'))?.[0];
      const file = entry?.file || (fs.existsSync(path.join(location, 'master.m3u8')) ? 'master.m3u8' : fs.readdirSync(location).find((name) => /^video\.[a-z0-9]+$/i.test(name)));
      if (!file || !fs.existsSync(path.join(location, file))) return [];
      if (!entry) entry = { id: folder.name, item: { id: folder.name, type: 'movie', title: 'Kurtarılan indirme' }, season: 1, episode: 1, audioLabel: 'İndirilen ses', subtitleLabel: '' };
      return [{ ...entry, id: folder.name, file, status: 'complete', progress: 100 }];
    });
  }
  let entries = readIndex(indexFile) ?? readIndex(backupFile) ?? recoverFolders();
  for (const entry of entries) if (entry.status === 'downloading') { entry.status = 'failed'; entry.error = 'Uygulama kapandı. İndirmeyi yeniden başlatın.'; }
  function save() {
    fs.mkdirSync(directory, { recursive: true });
    const payload = JSON.stringify(entries, null, 2);
    const temp = path.join(directory, `downloads.${process.pid}.tmp`);
    fs.writeFileSync(temp, payload);
    fs.renameSync(temp, indexFile);
    fs.writeFileSync(backupFile, payload);
    for (const entry of entries) {
      const folder = path.join(directory, entry.id);
      if (fs.existsSync(folder)) fs.writeFileSync(path.join(folder, 'metadata.json'), JSON.stringify([entry], null, 2));
    }
  }
  save();

  async function request(url, headers = {}, range = '') {
    const response = await fetchSource(url, { headers: { ...headers, ...(range ? { Range: range } : {}) } });
    if (!response.ok) throw new Error(`Kaynak yanıtı: ${response.status}`);
    return response;
  }
  async function readText(url, headers) { return (await request(url, headers)).text(); }

  async function inspectSource(source) {
    const url = source.streamUrl;
    if (!/\.m3u8(?:$|[?#])/i.test(url)) return { kind: 'file', audio: [], subtitles: [], variants: [] };
    const text = await readText(url, source.headers);
    const info = masterInfo(text, url);
    return { kind: 'hls', text, ...info };
  }

  async function options(params) {
    const kinds = params.type === 'tv' ? ['original', 'dub'] : ['original'];
    const results = await Promise.allSettled(kinds.map(async (kind) => {
      const source = await resolveSource(kind, params);
      return { kind, source, info: await inspectSource(source) };
    }));
    const available = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    if (!available.length) throw new Error(results[0]?.reason?.message || 'İndirilebilir yayın bulunamadı.');
    const token = randomUUID();
    sessions.set(token, { available, expires: Date.now() + 10 * 60_000, params });
    const audio = available.flatMap(({ kind, info }) => info.audio.length
      ? info.audio.map((track) => ({ id: `${kind}:${track.id}`, label: track.NAME || track.LANGUAGE || 'Ses', language: track.LANGUAGE || '', kind }))
      : [{ id: `${kind}:default`, label: kind === 'dub' ? 'Türkçe dublaj' : 'Orijinal ses', language: kind === 'dub' ? 'tr' : '', kind }]);
    const subtitles = available.flatMap(({ kind, info }) => info.subtitles.map((track) => ({ id: `${kind}:${track.id}`, label: track.NAME || track.LANGUAGE || 'Altyazı', language: track.LANGUAGE || '', kind })));
    return { token, audio, subtitles, dubAvailable: available.some((value) => value.kind === 'dub') };
  }

  async function writeResource(url, headers, destination, range = '') {
    const response = await request(url, headers, range);
    if (!response.body) throw new Error('Kaynak verisi boş.');
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(destination));
  }

  async function downloadPlaylist(url, headers, folder, prefix, tick) {
    const text = await readText(url, headers);
    if (!/#EXT-X-ENDLIST/.test(text)) throw new Error('Bu yayın canlı veya tamamlanmamış; çevrimdışı indirilemez.');
    if (/#EXT-X-BYTERANGE|BYTERANGE=/.test(text)) throw new Error('Bu yayının parça biçimi çevrimdışı indirmeyi desteklemiyor.');
    if (/METHOD=(?:SAMPLE-AES|SAMPLE-AES-CTR|SAMPLE-AES-CENC)/.test(text)) throw new Error('Korumalı yayın çevrimdışı indirilemez.');
    const lines = mediaLines(text);
    let count = 0;
    const tasks = [];
    const output = lines.map((line) => {
      if (line.startsWith('#EXT-X-KEY:') || line.startsWith('#EXT-X-MAP:')) {
        return line.replace(/URI="([^"]+)"/, (_all, uri) => {
          const resolved = new URL(uri, url).toString();
          const name = `${prefix}-asset-${count++}${extension(resolved, '.bin')}`;
          tasks.push({ url: resolved, name });
          return `URI="${name}"`;
        });
      }
      if (line.startsWith('#')) return line;
      const resolved = new URL(line, url).toString();
      const discovered = extension(resolved, prefix === 'audio' ? '.aac' : prefix === 'subtitle' ? '.vtt' : '.ts');
      const suffix = ['.html', '.php'].includes(discovered) ? (prefix === 'audio' ? '.aac' : prefix === 'subtitle' ? '.vtt' : '.ts') : discovered;
      const name = `${prefix}-segment-${count++}${suffix}`;
      tasks.push({ url: resolved, name });
      return name;
    });
    if (!tasks.length) throw new Error('Yayında indirilebilir parça bulunamadı.');
    let cursor = 0;
    const workers = Array.from({ length: Math.min(4, tasks.length) }, async () => {
      while (cursor < tasks.length) {
        const task = tasks[cursor++];
        await writeResource(task.url, headers, path.join(folder, task.name));
        tick();
      }
    });
    await Promise.all(workers);
    const name = `${prefix}.m3u8`;
    await fsp.writeFile(path.join(folder, name), `${output.join('\n')}\n`);
    return { name, count: tasks.length };
  }

  async function run(entry, source, info, selectedAudio, selectedSubtitle) {
    const folder = path.join(directory, entry.id);
    try {
      await fsp.mkdir(folder, { recursive: true });
      if (info.kind === 'file') {
        const name = `video${extension(source.streamUrl, '.mp4')}`;
        await writeResource(source.streamUrl, source.headers, path.join(folder, name));
        entry.file = name;
        entry.progress = 100;
      } else {
        const variant = [...info.variants].sort((a, b) => Number(b.BANDWIDTH || 0) - Number(a.BANDWIDTH || 0))[0];
        const videoUrl = variant?.url || source.streamUrl;
        const audioTrack = info.audio.find((track) => track.id === selectedAudio);
        const subtitleTrack = info.subtitles.find((track) => track.id === selectedSubtitle);
        const tick = () => { entry.downloadedParts = (entry.downloadedParts || 0) + 1; };
        const videoList = await downloadPlaylist(videoUrl, source.headers, folder, 'video', tick);
        const audioList = audioTrack ? await downloadPlaylist(audioTrack.url, source.headers, folder, 'audio', tick) : null;
        const subtitleList = subtitleTrack ? await downloadPlaylist(subtitleTrack.url, source.headers, folder, 'subtitle', tick) : null;
        const codec = variant?.CODECS ? `,CODECS="${variant.CODECS}"` : '';
        const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];
        if (audioList) lines.push(`#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="offline-audio",NAME="${(audioTrack.NAME || 'Ses').replace(/"/g, '')}",LANGUAGE="${audioTrack.LANGUAGE || 'und'}",DEFAULT=YES,AUTOSELECT=YES,URI="${audioList.name}"`);
        if (subtitleList) lines.push(`#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="offline-subtitles",NAME="${(subtitleTrack.NAME || 'Altyazı').replace(/"/g, '')}",LANGUAGE="${subtitleTrack.LANGUAGE || 'und'}",DEFAULT=YES,AUTOSELECT=YES,FORCED=NO,URI="${subtitleList.name}"`);
        lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${variant?.BANDWIDTH || 1500000}${codec}${audioList ? ',AUDIO="offline-audio"' : ''}${subtitleList ? ',SUBTITLES="offline-subtitles"' : ''}`, videoList.name);
        await fsp.writeFile(path.join(folder, 'master.m3u8'), `${lines.join('\n')}\n`);
        entry.file = 'master.m3u8';
        entry.progress = 100;
      }
      entry.status = 'complete';
      entry.completedAt = Date.now();
    } catch (error) {
      entry.status = 'failed';
      entry.error = error.message || String(error);
      await fsp.rm(folder, { recursive: true, force: true });
    }
    save();
  }

  function start({ token, audioId, subtitleId = '', item, season = 1, episode = 1 }) {
    const session = sessions.get(token);
    if (!session || session.expires < Date.now()) throw new Error('Ses seçenekleri eskidi. İndirme penceresini yeniden açın.');
    const [kind, trackId] = String(audioId || '').split(':');
    const selected = session.available.find((value) => value.kind === kind);
    if (!selected || !(selected.info.audio.some((track) => track.id === trackId) || (trackId === 'default' && !selected.info.audio.length))) throw new Error('İndirmeden önce bir ses seçmelisiniz.');
    const subtitleTrackId = subtitleId ? String(subtitleId).split(':')[1] : '';
    if (subtitleId && (!String(subtitleId).startsWith(`${kind}:`) || !selected.info.subtitles.some((track) => track.id === subtitleTrackId))) throw new Error('Seçilen altyazı bu ses yayınına ait değil.');
    if (!item || !['tv', 'movie'].includes(item.type) || !Number.isSafeInteger(Number(item.id))) throw new Error('İçerik bilgisi geçersiz.');
    if (String(item.id) !== String(session.params.tmdbId) || item.type !== session.params.type || Number(season) !== Number(session.params.season || 1) || Number(episode) !== Number(session.params.episode || 1)) throw new Error('İçerik seçimi değişti. İndirme penceresini yeniden açın.');
    const audioTrack = selected.info.audio.find((track) => track.id === trackId);
    const subtitleTrack = selected.info.subtitles.find((track) => track.id === subtitleTrackId);
    const entry = { id: randomUUID(), item: { id: item.id, type: item.type, title: String(item.title || ''), originalLanguage: item.originalLanguage || '', year: item.year || '', poster: item.poster || '' }, season: Number(season), episode: Number(episode), audioLabel: audioTrack?.NAME || (kind === 'dub' ? 'Türkçe dublaj' : 'Orijinal ses'), subtitleLabel: subtitleTrack?.NAME || '', status: 'downloading', progress: 0, createdAt: Date.now() };
    entries.unshift(entry); save(); sessions.delete(token);
    void run(entry, selected.source, selected.info, trackId, subtitleTrackId);
    return entry;
  }

  function list() { return entries.map((entry) => ({ ...entry })); }
  async function servePoster(req, res, id) {
    const entry = entries.find((value) => value.id === id && value.status === 'complete');
    let posterUrl;
    try { posterUrl = new URL(entry?.item?.poster || ''); } catch {}
    if (!entry || !posterUrl || posterUrl.protocol !== 'https:' || posterUrl.hostname !== 'image.tmdb.org' || !posterUrl.pathname.startsWith('/t/p/')) { res.writeHead(404); res.end(); return; }
    const ext = ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(posterUrl.pathname).toLowerCase()) ? path.extname(posterUrl.pathname).toLowerCase() : '.jpg';
    const file = path.join(directory, id, `poster${ext}`);
    try {
      if (!fs.existsSync(file)) {
        if (!posterRequests.has(id)) {
          const request = (async () => { const temp = `${file}.tmp`; try { await fsp.mkdir(path.dirname(file), { recursive: true }); await writeResource(posterUrl.toString(), {}, temp); await fsp.rename(temp, file); } finally { await fsp.rm(temp, { force: true }); } })();
          posterRequests.set(id, request);
          request.finally(() => posterRequests.delete(id)).catch(() => {});
        }
        await posterRequests.get(id);
      }
      const stat = await fsp.stat(file);
      res.writeHead(200, { 'Content-Type': ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg', 'Content-Length': stat.size, 'Cache-Control': 'private, max-age=86400' });
      if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
    } catch { res.writeHead(404); res.end(); }
  }
  async function remove(id) {
    const index = entries.findIndex((entry) => entry.id === id);
    if (index < 0) throw new Error('İndirme bulunamadı.');
    if (entries[index].status === 'downloading') throw new Error('Devam eden indirme bitmeden silinemez.');
    await fsp.rm(path.join(directory, id), { recursive: true, force: true });
    entries.splice(index, 1);
    save();
  }
  function serve(req, res, id, name) {
    const entry = entries.find((value) => value.id === id && value.status === 'complete');
    if (!entry || !/^[a-zA-Z0-9._-]+$/.test(name)) { res.writeHead(404); res.end(); return; }
    const file = path.join(directory, id, name);
    let stat;
    try { stat = fs.statSync(file); } catch { res.writeHead(404); res.end(); return; }
    if (!stat.isFile()) { res.writeHead(404); res.end(); return; }
    const mime = { '.m3u8': 'application/vnd.apple.mpegurl', '.vtt': 'text/vtt', '.ts': 'video/mp2t', '.mp4': 'video/mp4', '.m4s': 'video/iso.segment', '.aac': 'audio/aac', '.key': 'application/octet-stream' }[path.extname(name).toLowerCase()] || 'application/octet-stream';
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
    const start = range ? Number(range[1]) : 0;
    const end = range && range[2] ? Number(range[2]) : stat.size - 1;
    if (start >= stat.size || end < start || end >= stat.size) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); res.end(); return; }
    res.writeHead(range ? 206 : 200, { 'Content-Type': mime, 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*', ...(range ? { 'Content-Range': `bytes ${start}-${end}/${stat.size}` } : {}) });
    fs.createReadStream(file, { start, end }).pipe(res);
  }
  return { options, start, list, remove, serve, servePoster, masterInfo };
}

module.exports = { createDownloadManager, masterInfo, attributes };
