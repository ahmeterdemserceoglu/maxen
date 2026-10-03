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
      if (!entry) entry = { id: folder.name, item: { id: folder.name, type: 'movie', title: 'Kayıtlı İçerik' }, season: 1, episode: 1, audioLabel: 'Orijinal Ses', subtitleLabel: '' };
      return [{ ...entry, id: folder.name, file, status: 'complete', progress: 100 }];
    });
  }
  let entries = readIndex(indexFile) ?? readIndex(backupFile) ?? recoverFolders();
  for (const entry of entries) if (entry.status === 'downloading') { entry.status = 'failed'; entry.error = 'Uygulama kapatıldı. İndirmeyi yeniden başlatabilirsiniz.'; }
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

  const activeControllers = new Map();

  async function request(url, headers = {}, range = '', signal = null) {
    const response = await fetchSource(url, { headers: { ...headers, ...(range ? { Range: range } : {}) }, ...(signal ? { signal } : {}) });
    if (!response.ok) throw new Error(`Kaynak yanıtı: ${response.status}`);
    return response;
  }
  async function readText(url, headers, signal = null) { return (await request(url, headers, '', signal)).text(); }

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

  async function writeResource(url, headers, destination, range = '', maxRetries = 3, signal = null) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (signal?.aborted) throw new Error('İndirme iptal edildi');
      try {
        const response = await request(url, headers, range, signal);
        if (!response.body) throw new Error('Kaynak verisi boş.');
        await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(destination), { signal: signal || undefined });
        return;
      } catch (err) {
        if (signal?.aborted || err.name === 'AbortError') {
          try { if (fs.existsSync(destination)) fs.unlinkSync(destination); } catch {}
          throw new Error('İndirme iptal edildi');
        }
        lastError = err;
        try { if (fs.existsSync(destination)) fs.unlinkSync(destination); } catch {}
        if (attempt < maxRetries) {
          const delay = attempt * 800;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError || new Error(`Kaynak indirilemedi (${maxRetries} deneme): ${url}`);
  }

  async function downloadPlaylist(url, headers, folder, prefix, tick, signal = null) {
    const text = await readText(url, headers, signal);
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
    tick?.(0, tasks.length, 0);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(4, tasks.length) }, async () => {
      while (cursor < tasks.length) {
        if (signal?.aborted) throw new Error('İndirme iptal edildi');
        const task = tasks[cursor++];
        const dest = path.join(folder, task.name);
        await writeResource(task.url, headers, dest, '', 3, signal);
        let bytes = 0;
        try { bytes = fs.statSync(dest).size; } catch {}
        tick?.(1, 0, bytes);
      }
    });
    await Promise.all(workers);
    const name = `${prefix}.m3u8`;
    await fsp.writeFile(path.join(folder, name), `${output.join('\n')}\n`);
    return { name, count: tasks.length };
  }

  async function run(entry, source, info, selectedAudio, selectedSubtitle) {
    const controller = new AbortController();
    activeControllers.set(entry.id, controller);
    const { signal } = controller;
    const folder = path.join(directory, entry.id);
    const startedAt = Date.now();
    let totalBytes = 0;
    entry.startedAt = startedAt;
    entry.downloadedParts = 0;
    entry.totalParts = 0;
    entry.downloadedBytes = 0;
    entry.speed = 0;
    entry.eta = null;

    const tick = (doneCount = 0, addedTotal = 0, bytes = 0) => {
      if (signal.aborted) return;
      if (addedTotal > 0) entry.totalParts = (entry.totalParts || 0) + addedTotal;
      if (doneCount > 0) entry.downloadedParts = (entry.downloadedParts || 0) + doneCount;
      if (bytes > 0) {
        totalBytes += bytes;
        entry.downloadedBytes = totalBytes;
      }
      const elapsedSec = (Date.now() - startedAt) / 1000;
      if (elapsedSec > 0.5 && totalBytes > 0) {
        entry.speed = Math.round(totalBytes / elapsedSec);
        if (entry.totalParts && entry.downloadedParts) {
          const partsRemaining = Math.max(0, entry.totalParts - entry.downloadedParts);
          const secPerPart = elapsedSec / entry.downloadedParts;
          entry.eta = Math.round(partsRemaining * secPerPart);
        }
      }
    };

    try {
      await fsp.mkdir(folder, { recursive: true });
      if (info.kind === 'file') {
        const name = `video${extension(source.streamUrl, '.mp4')}`;
        const dest = path.join(folder, name);
        entry.totalParts = 1;
        await writeResource(source.streamUrl, source.headers, dest, '', 3, signal);
        entry.downloadedParts = 1;
        try { entry.downloadedBytes = fs.statSync(dest).size; } catch {}
        entry.file = name;
        entry.progress = 100;
      } else {
        const variant = [...info.variants].sort((a, b) => Number(b.BANDWIDTH || 0) - Number(a.BANDWIDTH || 0))[0];
        const videoUrl = variant?.url || source.streamUrl;
        const audioTrack = info.audio.find((track) => track.id === selectedAudio);
        const subtitleTrack = info.subtitles.find((track) => track.id === selectedSubtitle);
        const videoList = await downloadPlaylist(videoUrl, source.headers, folder, 'video', tick, signal);
        const audioList = audioTrack ? await downloadPlaylist(audioTrack.url, source.headers, folder, 'audio', tick, signal) : null;
        const subtitleList = subtitleTrack ? await downloadPlaylist(subtitleTrack.url, source.headers, folder, 'subtitle', tick, signal) : null;
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
      entry.speed = 0;
      entry.eta = null;
      entry.completedAt = Date.now();
    } catch (error) {
      entry.status = 'failed';
      entry.speed = 0;
      entry.eta = null;
      entry.error = (signal.aborted || error.message?.includes('iptal edildi')) ? 'İndirme iptal edildi' : (error.message || String(error));
      await fsp.rm(folder, { recursive: true, force: true }).catch(() => {});
    } finally {
      activeControllers.delete(entry.id);
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

  function getFolderSize(dir) {
    let size = 0;
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const itemPath = path.join(dir, item.name);
        if (item.isFile()) {
          try { size += fs.statSync(itemPath).size; } catch {}
        }
      }
    } catch {}
    return size;
  }

  function list() {
    return entries.map((entry) => {
      let size = entry.downloadedBytes || 0;
      if (entry.status === 'complete' && !size) {
        size = getFolderSize(path.join(directory, entry.id));
        entry.downloadedBytes = size;
      }
      return { ...entry, size };
    });
  }
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

  async function cancel(id) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) throw new Error('İndirme bulunamadı.');
    if (entry.status === 'downloading') {
      const controller = activeControllers.get(id);
      if (controller) controller.abort();
      entry.status = 'failed';
      entry.error = 'İndirme iptal edildi';
      entry.speed = 0;
      entry.eta = null;
      await fsp.rm(path.join(directory, id), { recursive: true, force: true }).catch(() => {});
      save();
    }
    return entry;
  }

  async function remove(id) {
    const index = entries.findIndex((entry) => entry.id === id);
    if (index < 0) throw new Error('İndirme bulunamadı.');
    const entry = entries[index];
    if (entry.status === 'downloading') {
      const controller = activeControllers.get(id);
      if (controller) controller.abort();
    }
    await fsp.rm(path.join(directory, id), { recursive: true, force: true }).catch(() => {});
    entries.splice(index, 1);
    save();
  }

  async function clearFailed() {
    const failedList = entries.filter((entry) => entry.status === 'failed');
    for (const entry of failedList) {
      await fsp.rm(path.join(directory, entry.id), { recursive: true, force: true }).catch(() => {});
    }
    entries = entries.filter((entry) => entry.status !== 'failed');
    save();
    return { removed: failedList.length };
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
  return { directory, options, start, list, cancel, remove, clearFailed, serve, servePoster, masterInfo };
}

module.exports = { createDownloadManager, masterInfo };
