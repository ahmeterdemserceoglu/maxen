const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');
const { createDownloadManager } = require('./downloads');

const PORT = Number(process.env.MAXEN_PLAYER_PORT || 47831);
const ROOT = path.join(__dirname, 'renderer');
const HOT_RELOAD = process.env.MAXEN_HOT_RELOAD === '1';
const hotClients = new Set();
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36';
const CACHE_DIR = process.env.MAXEN_CACHE_DIR || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Maxen', 'cache');
const SOURCE_CACHE_FILE = path.join(CACHE_DIR, 'sources.json');
const DOWNLOAD_DIR = process.env.MAXEN_DOWNLOAD_DIR || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Maxen', 'downloads');
let sourceCache = {};
try { sourceCache = JSON.parse(fs.readFileSync(SOURCE_CACHE_FILE, 'utf8')); } catch { sourceCache = {}; }

function sourceKey(kind, { tmdbId, type, season = 1, episode = 1 }) { return `${kind}:${type}:${tmdbId}:${season}:${episode}`; }
function cachedSourceUsable(entry) {
  if (!entry?.streamUrl || !entry.savedAt) return false;
  try {
    const expires = Number(new URL(entry.streamUrl).searchParams.get('expires'));
    if (expires) return expires * (expires < 1e12 ? 1000 : 1) > Date.now() + 60_000;
  } catch {}
  const ttl = entry.kind === 'dub' ? 7 * 24 * 60 * 60_000 : 12 * 60 * 60_000;
  return Date.now() - entry.savedAt < ttl;
}
function rememberSource(key, kind, result) {
  sourceCache[key] = { kind, streamUrl: result.streamUrl, headers: result.headers || {}, providerId: result.providerId || '', isDubbed: Boolean(result.isDubbed), savedAt: Date.now() };
  try { fs.mkdirSync(CACHE_DIR, { recursive: true }); fs.writeFileSync(SOURCE_CACHE_FILE, JSON.stringify(sourceCache, null, 2)); } catch {}
}
async function resolveCached(kind, params, forceRefresh = false) {
  const key = sourceKey(kind, params); const cached = sourceCache[key];
  if (!forceRefresh && cachedSourceUsable(cached)) return { streamUrl: playbackUrl(kind, cached), isDubbed: cached.isDubbed, cached: true };
  const result = kind === 'dub' ? await resolveDub(params, forceRefresh ? cached?.providerId : '') : await resolveStream(params);
  rememberSource(key, kind, result);
  return { streamUrl: playbackUrl(kind, result), isDubbed: Boolean(result.isDubbed), cached: false };
}
const downloads = createDownloadManager({
  directory: DOWNLOAD_DIR,
  resolveSource: async (kind, params) => {
    await resolveCached(kind, params);
    const entry = sourceCache[sourceKey(kind, params)];
    return { streamUrl: entry.streamUrl, headers: inferredHeaders(entry.streamUrl, entry.headers) };
  },
  fetchSource: (url, options) => fetchWithTimeout(url, options, 30000),
});

function inferredHeaders(streamUrl, headers = {}) {
  if (Object.keys(headers).length) return headers;
  if (/sibnet\.ru/i.test(streamUrl)) return { Referer: 'https://video.sibnet.ru/', 'User-Agent': USER_AGENT };
  if (/dzen\.ru/i.test(streamUrl)) return { Referer: 'https://dzen.ru/', 'User-Agent': USER_AGENT };
  return { 'User-Agent': USER_AGENT };
}
function proxyUrl(streamUrl, headers = {}) {
  const params = new URLSearchParams({ url: streamUrl }); const activeHeaders = inferredHeaders(streamUrl, headers);
  if (activeHeaders.Referer) params.set('referer', activeHeaders.Referer); if (activeHeaders.Origin) params.set('origin', activeHeaders.Origin);
  return `/api/stream?${params}`;
}
function playbackUrl(_kind, result) { return proxyUrl(result.streamUrl, result.headers); }
function rewriteHlsManifest(manifest, manifestUrl, headers) {
  const wrap = (value) => proxyUrl(new URL(value, manifestUrl).toString(), headers);
  return manifest.split(/\r?\n/).map((line) => {
    if (!line) return line;
    if (line.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_match, uri) => `URI="${wrap(uri)}"`);
    return wrap(line.trim());
  }).join('\n');
}
async function proxyStream(req, res, targetUrl, referer, origin) {
  const headers = { 'User-Agent': USER_AGENT, Accept: req.headers.accept || '*/*' };
  if (referer) headers.Referer = referer;
  if (origin) headers.Origin = origin;
  if (req.headers.range) headers.Range = req.headers.range;

  let response;
  try {
    response = await fetchWithTimeout(targetUrl, { headers }, 20000);
  } catch (error) {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: false, error: 'Kaynak sunucusuna erişilemedi: ' + (error?.message || '') }));
    }
    return;
  }

  const contentType = response.headers.get('content-type') || '';
  if (/mpegurl|m3u8/i.test(contentType) || /\.m3u8(?:$|[?#])/i.test(targetUrl)) {
    const manifest = await response.text();
    const rewritten = rewriteHlsManifest(manifest, response.url || targetUrl, { Referer: referer, Origin: origin, 'User-Agent': USER_AGENT });
    res.writeHead(response.ok ? 200 : response.status, { 'Content-Type': 'application/vnd.apple.mpegurl', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
    return res.end(rewritten);
  }

  const outputHeaders = { 'Content-Type': contentType || 'application/octet-stream', 'Access-Control-Allow-Origin': '*', 'Accept-Ranges': response.headers.get('accept-ranges') || 'bytes', 'Cache-Control': 'no-store' };
  for (const name of ['content-length', 'content-range']) {
    const value = response.headers.get(name);
    if (value) outputHeaders[name] = value;
  }
  res.writeHead(response.status, outputHeaders);
  if (!response.body) return res.end();

  const stream = Readable.fromWeb(response.body);
  stream.on('error', () => { try { res.destroy(); } catch {} });
  res.on('close', () => { try { stream.destroy(); } catch {} });
  stream.pipe(res);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 14000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function tmdb(pathname, params = {}) {
  const url = new URL('https://maxen.sbs/api/tmdb');
  url.searchParams.set('path', pathname);
  Object.entries(params).forEach(([key, value]) => value != null && url.searchParams.set(key, String(value)));
  const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Katalog yanıtı: ${response.status}`);
  return response.json();
}

function media(item, forcedType) {
  const type = forcedType || item.media_type || (item.title ? 'movie' : 'tv');
  return {
    id: item.id, type, title: item.title || item.name, originalTitle: item.original_title || item.original_name,
    originalLanguage: item.original_language || '',
    overview: item.overview || '', year: (item.release_date || item.first_air_date || '').slice(0, 4),
    rating: Number(item.vote_average || 0).toFixed(1),
    genre_ids: item.genre_ids || [],
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
  };
}

async function resolveStream({ tmdbId, type, season = 1, episode = 1 }) {
  const apiUrl = type === 'tv' ? `https://vixsrc.to/api/tv/${tmdbId}/${season}/${episode}` : `https://vixsrc.to/api/movie/${tmdbId}`;
  const apiResponse = await fetchWithTimeout(apiUrl, { headers: { 'User-Agent': USER_AGENT, Referer: 'https://vixsrc.to/' } });
  if (!apiResponse.ok) throw new Error(`Kaynak API yanıtı: ${apiResponse.status}`);
  const data = await apiResponse.json();
  if (!data?.src) throw new Error('Kaynak bağlantısı bulunamadı');
  const embedUrl = new URL(data.src, 'https://vixsrc.to').toString();
  const embedResponse = await fetchWithTimeout(embedUrl, { headers: { 'User-Agent': USER_AGENT, Referer: 'https://vixsrc.to/' } });
  const html = await embedResponse.text();
  const block = html.match(/window\.masterPlaylist\s*=\s*(\{[\s\S]*?\});/)?.[1] || html;
  const rawUrl = block.match(/url:\s*['"]([^'"]+)['"]/)?.[1];
  const token = block.match(/['"]token['"]:\s*['"]([^'"]+)['"]/)?.[1];
  const expires = block.match(/['"]expires['"]:\s*['"]([^'"]+)['"]/)?.[1];
  if (!rawUrl) throw new Error('Doğrudan video akışı çözülemedi');
  const streamUrl = new URL(rawUrl.replace(/\\/g, ''), embedUrl);
  if (token) streamUrl.searchParams.set('token', token);
  if (expires) streamUrl.searchParams.set('expires', expires);
  streamUrl.searchParams.set('h', '1'); streamUrl.hash = 'master.m3u8';
  return { streamUrl: streamUrl.toString(), headers: { Referer: embedUrl, Origin: 'https://vixsrc.to', 'User-Agent': USER_AGENT } };
}

function normalizeSeriesTitle(value) {
  return String(value || '').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\(\d{4}\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/^(the|a|an)\s+/, '').trim();
}
function isLikelySeriesMatch(candidateTitle, requestedTitle) {
  const candidate = normalizeSeriesTitle(candidateTitle); const requested = normalizeSeriesTitle(requestedTitle);
  if (!candidate || !requested) return false; if (candidate === requested) return true;
  const wanted = new Set(requested.split(' ').filter(Boolean)); const found = new Set(candidate.split(' ').filter(Boolean));
  const common = [...wanted].filter((token) => found.has(token)).length;
  return common / Math.max(wanted.size, found.size) >= .8;
}
function extractStream(html, iframeUrl = '') {
  const normalized = String(html || '').replace(/\\\//g, '/');
  if (/sibnet\.ru/i.test(iframeUrl) || /video\.sibnet\.ru/i.test(normalized)) {
    const match = normalized.match(/player\.src\(\[\s*\{\s*src:\s*["']([^"']+)["']/i) || normalized.match(/src:\s*["']([^"']+\.mp4[^"']*)["']/i) || normalized.match(/["'](\/v\/[a-zA-Z0-9_-]+\/\d+\.mp4)["']/i);
    if (match) return { streamUrl: match[1].startsWith('http') ? match[1] : `https://video.sibnet.ru${match[1]}`, headers: { Referer: 'https://video.sibnet.ru/', 'User-Agent': USER_AGENT } };
  }
  if (/dzen\.ru/i.test(iframeUrl) || /dzen\.ru/i.test(normalized)) {
    const match = normalized.match(/"type"\s*:\s*"hls"[^}]*"url"\s*:\s*"([^"]+)"/i) || normalized.match(/"url"\s*:\s*"([^"]+\.m3u8[^"]*)"/i);
    if (match) return { streamUrl: match[1].replace(/\\/g, ''), headers: { Referer: 'https://dzen.ru/', 'User-Agent': USER_AGENT } };
  }
  const streamUrl = normalized.match(/(?:file|src)\s*[:=]\s*['"]([^'"]+\.(?:m3u8|mp4)[^'"]*)['"]/i)?.[1] || normalized.match(/https?:\/\/[^'"\s<>]+\.(?:m3u8|mp4)[^'"\s<>]*/i)?.[0];
  if (!streamUrl) return null; let providerOrigin = 'https://sezonlukdizi.cc'; try { providerOrigin = new URL(iframeUrl).origin; } catch {}
  return { streamUrl, headers: { Referer: `${providerOrigin}/`, Origin: providerOrigin, 'User-Agent': USER_AGENT } };
}

async function checkDubAvailability({ tmdbId, title, season = 1, episode = 1 }) {
  const details = await tmdb(`/tv/${tmdbId}`, { language: 'tr-TR', append_to_response: 'external_ids' });
  const requestedTitles = [details.original_name, title, details.name].filter(Boolean);
  const terms = [details.external_ids?.imdb_id, ...requestedTitles].filter((value, index, list) => value && list.indexOf(value) === index);
  const headers = { 'User-Agent': USER_AGENT, Referer: 'https://sezonlukdizi.cc/', 'X-Requested-With': 'XMLHttpRequest' };
  const searches = await Promise.allSettled(terms.map(async (term) => {
    const response = await fetchWithTimeout('https://sezonlukdizi.cc/ajax/arama.asp', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' }, body: `q=${encodeURIComponent(term)}` }, 5000);
    const found = response.ok ? await response.json().catch(() => null) : null;
    const list = found?.results?.diziler?.results || [];
    if (!Array.isArray(list) || !list.length) return null;
    const exact = list.find((item) => requestedTitles.some((requested) => isLikelySeriesMatch(item?.title || item?.name || '', requested)));
    return (String(term).startsWith('tt') ? list[0] : exact)?.url || null;
  }));
  const seriesUrl = searches.find((result) => result.status === 'fulfilled' && result.value)?.value;
  if (!seriesUrl) return { available: false };
  const slug = seriesUrl.match(/\/diziler\/([a-zA-Z0-9_-]+)\.html/)?.[1] || seriesUrl.replace(/^\/diziler\/|\.html$/g, '');
  const candidate = `https://sezonlukdizi.cc/${slug}/dublaj/${season}-sezon-${episode}-bolum.html`;
  try {
    const response = await fetchWithTimeout(candidate, { headers: { 'User-Agent': USER_AGENT, Referer: 'https://sezonlukdizi.cc/' } }, 5000);
    const html = response.ok ? await response.text() : '';
    const hasDub = /data-dil\s*=\s*["']0["']/i.test(html) && /dublaj/i.test(html);
    return { available: Boolean(hasDub) };
  } catch {
    return { available: false };
  }
}

async function resolveDub({ tmdbId, title, season = 1, episode = 1 }, excludeProvider = '') {
  const details = await tmdb(`/tv/${tmdbId}`, { language: 'tr-TR', append_to_response: 'external_ids' });
  const requestedTitles = [details.original_name, title, details.name].filter(Boolean);
  const terms = [details.external_ids?.imdb_id, ...requestedTitles].filter((value, index, list) => value && list.indexOf(value) === index);
  const headers = { 'User-Agent': USER_AGENT, Referer: 'https://sezonlukdizi.cc/', 'X-Requested-With': 'XMLHttpRequest' };
  const searches = await Promise.allSettled(terms.map(async (term) => {
    const response = await fetchWithTimeout('https://sezonlukdizi.cc/ajax/arama.asp', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' }, body: `q=${encodeURIComponent(term)}` }, 6500);
    const found = response.ok ? await response.json().catch(() => null) : null;
    const list = found?.results?.diziler?.results || [];
    if (!Array.isArray(list) || !list.length) return null;
    const exact = list.find((item) => requestedTitles.some((requested) => isLikelySeriesMatch(item?.title || item?.name || '', requested)));
    return (String(term).startsWith('tt') ? list[0] : exact)?.url || null;
  }));
  const seriesUrl = searches.find((result) => result.status === 'fulfilled' && result.value)?.value;
  if (!seriesUrl) throw new Error('Bu dizi için Türkçe dublaj bulunamadı');
  const slug = seriesUrl.match(/\/diziler\/([a-zA-Z0-9_-]+)\.html/)?.[1] || seriesUrl.replace(/^\/diziler\/|\.html$/g, '');
  const candidates = [`https://sezonlukdizi.cc/${slug}/dublaj/${season}-sezon-${episode}-bolum.html`, `https://sezonlukdizi.cc/${slug}/${season}-sezon-${episode}-bolum.html`];
  const episodePages = await Promise.allSettled(candidates.map(async (candidate) => {
    const response = await fetchWithTimeout(candidate, { headers: { 'User-Agent': USER_AGENT, Referer: 'https://sezonlukdizi.cc/' } }, 6500);
    const html = response.ok ? await response.text() : '';
    const bolumId = /data-dil\s*=\s*["']0["']/i.test(html) && /dublaj/i.test(html) ? html.match(/data-id=["'](\d+)["']/)?.[1] : null;
    return bolumId ? { bolumId, episodeUrl: candidate } : null;
  }));
  const episodeMatch = episodePages.find((result) => result.status === 'fulfilled' && result.value)?.value;
  const bolumId = episodeMatch?.bolumId; const episodeUrl = episodeMatch?.episodeUrl;
  if (!bolumId) throw new Error('Bu bölüm için Türkçe dublaj bulunamadı');
  const alternativesResponse = await fetchWithTimeout('https://sezonlukdizi.cc/ajax/dataAlternatif22.asp', { method: 'POST', headers: { ...headers, Referer: episodeUrl, 'Content-Type': 'application/x-www-form-urlencoded' }, body: `bid=${bolumId}&dil=0` }, 6500);
  const alternatives = alternativesResponse.ok ? (await alternativesResponse.json().catch(() => null))?.data || [] : [];
  const priority = { vidmoly: 1, sibnet: 2, dzen: 3, filemoon: 4, pixel: 5 };
  alternatives.sort((a, b) => (priority[String(a.baslik).toLowerCase()] || 99) - (priority[String(b.baslik).toLowerCase()] || 99));
  const untried = alternatives.filter((alternative) => String(alternative.id) !== String(excludeProvider));
  const attempts = (untried.length ? untried : alternatives).map(async (alternative) => {
    try {
      const embedResponse = await fetchWithTimeout('https://sezonlukdizi.cc/ajax/dataEmbed22.asp', { method: 'POST', headers: { ...headers, Referer: episodeUrl, 'Content-Type': 'application/x-www-form-urlencoded' }, body: `id=${alternative.id}` }, 7000);
      const iframe = (await embedResponse.text()).match(/src=["']([^"']+)["']/)?.[1];
      if (!iframe) throw new Error('Embed yok');
      let iframeUrl = iframe.startsWith('//') ? `https:${iframe}` : new URL(iframe, 'https://sezonlukdizi.cc').toString();
      iframeUrl = iframeUrl.replace('vidmoly.net', 'vidmoly.biz');
      const providerResponse = await fetchWithTimeout(iframeUrl, { headers: { 'User-Agent': USER_AGENT, Referer: episodeUrl } }, 7000);
      const extracted = providerResponse.ok ? extractStream(await providerResponse.text(), providerResponse.url || iframeUrl) : null;
      if (!extracted?.streamUrl) throw new Error('Akış yok');
      return { ...extracted, providerId: String(alternative.id), isDubbed: true };
    } catch (error) { throw error; }
  });
  if (!attempts.length) throw new Error('Türkçe dublaj alternatifi bulunamadı');
  try { return await Promise.any(attempts); }
  catch { throw new Error('Türkçe dublaj kaynakları çözülemedi'); }
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  try {
    if (url.pathname === '/__hot_reload' && HOT_RELOAD) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
      res.write('event: connected\ndata: ready\n\n'); hotClients.add(res);
      req.on('close', () => hotClients.delete(res)); return;
    }
    if (url.pathname === '/api/home') {
      try {
        const paths = ['/trending/all/day', '/movie/popular', '/tv/popular', '/movie/top_rated', '/tv/top_rated'];
        const data = await Promise.all(paths.map((p) => tmdb(p, { language: 'tr-TR', region: 'TR' })));
        const names = ['Gündemdekiler', 'Popüler Filmler', 'Popüler Diziler', 'En İyi Filmler', 'En İyi Diziler'];
        return json(res, 200, { ok: true, hero: media(data[0].results.find((x) => x.backdrop_path) || data[0].results[0]), sections: data.map((d, i) => ({ title: names[i], items: (d.results || []).filter((x) => x.poster_path).map((x) => media(x, i === 1 || i === 3 ? 'movie' : i === 2 || i === 4 ? 'tv' : undefined)) })) });
      } catch {
        return json(res, 200, { ok: true, offline: true, downloads: downloads.list() });
      }
    }
    if (url.pathname === '/api/catalog') {
      const type = url.searchParams.get('type') === 'tv' ? 'tv' : 'movie';
      try {
        if (type === 'tv') {
          const paths = ['/trending/tv/week', '/tv/popular', '/tv/top_rated', '/tv/on_the_air'];
          const data = await Promise.all(paths.map((p) => tmdb(p, { language: 'tr-TR', region: 'TR' })));
          const names = [
            { title: 'Gündemdeki Diziler', subtitle: 'Haftanın en çok konuşulan ve izlenen popüler dizileri' },
            { title: 'Popüler Diziler', subtitle: 'Geniş izleyici kitlesine sahip favori diziler' },
            { title: 'Başyapıt Diziler', subtitle: 'Tüm zamanların en yüksek puanlı kült serileri' },
            { title: 'Yeni Sezonlar & Yayındakiler', subtitle: 'Şu an devam eden ve yeni bölümleri yayınlanan diziler' }
          ];
          const heroItem = media(data[0].results.find((x) => x.backdrop_path) || data[0].results[0], 'tv');
          return json(res, 200, {
            ok: true,
            type: 'tv',
            title: 'Diziler',
            hero: heroItem,
            sections: data.map((d, i) => ({
              title: names[i].title,
              subtitle: names[i].subtitle,
              items: (d.results || []).filter((x) => x.poster_path).map((x) => media(x, 'tv'))
            }))
          });
        } else {
          const paths = ['/trending/movie/week', '/movie/popular', '/movie/top_rated', '/movie/now_playing'];
          const data = await Promise.all(paths.map((p) => tmdb(p, { language: 'tr-TR', region: 'TR' })));
          const names = [
            { title: 'Gündemdeki Filmler', subtitle: 'Haftanın en çok izlenen ve aranan sinema filmleri' },
            { title: 'Popüler Filmler', subtitle: 'Dünya çapında en çok ilgi gören sinema yapımları' },
            { title: 'Eleştirmenlerden Tam Not Alanlar', subtitle: 'En yüksek puanlı unutulmaz sinema başyapıtları' },
            { title: 'Vizyondaki Filmler', subtitle: 'Sinemalarda ve dijital platformlarda yeni gösterime girenler' }
          ];
          const heroItem = media(data[0].results.find((x) => x.backdrop_path) || data[0].results[0], 'movie');
          return json(res, 200, {
            ok: true,
            type: 'movie',
            title: 'Filmler',
            hero: heroItem,
            sections: data.map((d, i) => ({
              title: names[i].title,
              subtitle: names[i].subtitle,
              items: (d.results || []).filter((x) => x.poster_path).map((x) => media(x, 'movie'))
            }))
          });
        }
      } catch (err) {
        return json(res, 500, { ok: false, error: `Katalog alınamadı: ${err.message}` });
      }
    }
    if (url.pathname === '/api/discover') {
      const type = url.searchParams.get('type') === 'tv' ? 'tv' : 'movie';
      const page = Math.max(1, Number(url.searchParams.get('page') || 1));
      const genre = url.searchParams.get('genre') || '';
      const sortBy = url.searchParams.get('sort_by') || 'popularity.desc';
      const params = { language: 'tr-TR', region: 'TR', sort_by: sortBy, page };
      if (sortBy.startsWith('vote_average')) {
        params['vote_count.gte'] = '60';
      }
      if (genre) params.with_genres = genre;
      const data = await tmdb(`/discover/${type}`, params);
      const results = (data.results || []).filter((x) => x.poster_path).map((x) => media(x, type));
      const hero = results.find((x) => x.backdrop) || results[0] || null;
      return json(res, 200, {
        ok: true,
        title: type === 'tv' ? 'Diziler' : 'Filmler',
        page,
        totalPages: Math.min(500, data.total_pages || 1),
        hero,
        results
      });
    }
    if (url.pathname === '/api/trailer') {
      const type = url.searchParams.get('type') === 'tv' ? 'tv' : 'movie';
      const id = url.searchParams.get('id');
      if (!id) return json(res, 400, { ok: false, error: 'ID eksik' });
      try {
        let data = await tmdb(`/${type}/${id}/videos`, { language: 'tr-TR' });
        let list = (data.results || []).filter((v) => v.site === 'YouTube');
        if (!list.length) {
          data = await tmdb(`/${type}/${id}/videos`, { language: 'en-US' });
          list = (data.results || []).filter((v) => v.site === 'YouTube');
        }
        const trailer = list.find((v) => v.type === 'Trailer') || list.find((v) => v.type === 'Teaser') || list[0];
        if (trailer && trailer.key) {
          return json(res, 200, { ok: true, key: trailer.key, name: trailer.name });
        }
        return json(res, 404, { ok: false, error: 'Bu içerik için YouTube fragmanı bulunamadı.' });
      } catch (err) {
        return json(res, 500, { ok: false, error: `Fragman alınamadı: ${err.message}` });
      }
    }
    if (url.pathname === '/api/search') {
      const data = await tmdb('/search/multi', { query: url.searchParams.get('q') || '', language: 'tr-TR', include_adult: false });
      return json(res, 200, { ok: true, results: (data.results || []).filter((x) => ['movie', 'tv'].includes(x.media_type) && x.poster_path).slice(0, 30).map((x) => media(x)) });
    }
    if (url.pathname === '/api/details') {
      const type = url.searchParams.get('type') === 'tv' ? 'tv' : 'movie';
      const data = await tmdb(`/${type}/${url.searchParams.get('id')}`, { language: 'tr-TR', append_to_response: 'credits,external_ids' });
      return json(res, 200, { ok: true, item: { ...media(data, type), runtime: data.runtime || data.episode_run_time?.[0], genres: (data.genres || []).map((x) => x.name), seasons: (data.seasons || []).filter((x) => x.season_number > 0 && x.episode_count > 0), cast: (data.credits?.cast || []).slice(0, 8).map((x) => x.name) } });
    }
    if (url.pathname === '/api/season') {
      const data = await tmdb(`/tv/${url.searchParams.get('id')}/season/${url.searchParams.get('season')}`, { language: 'tr-TR' });
      return json(res, 200, { ok: true, episodes: (data.episodes || []).map((x) => ({ number: x.episode_number, title: x.name, overview: x.overview, runtime: x.runtime, airDate: x.air_date, still: x.still_path ? `https://image.tmdb.org/t/p/w500${x.still_path}` : null })) });
    }
    if (url.pathname === '/api/dub/check') {
      const params = Object.fromEntries(url.searchParams);
      try {
        const result = await checkDubAvailability(params);
        return json(res, 200, { ok: true, ...result });
      } catch {
        return json(res, 200, { ok: true, available: false });
      }
    }
    if (url.pathname === '/api/resolve' || url.pathname === '/api/dub') {
      const params = Object.fromEntries(url.searchParams); const kind = url.pathname === '/api/dub' ? 'dub' : 'original';
      return json(res, 200, { ok: true, ...(await resolveCached(kind, params, params.refresh === '1')) });
    }
    if (url.pathname === '/api/download/options') {
      const params = Object.fromEntries(url.searchParams);
      return json(res, 200, { ok: true, ...(await downloads.options(params)) });
    }
    if (url.pathname === '/api/downloads' && req.method === 'GET') return json(res, 200, { ok: true, downloads: downloads.list(), directory: downloads.directory });
    if (url.pathname === '/api/download/start' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 100_000) throw new Error('İstek çok büyük.'); }
      return json(res, 200, { ok: true, download: downloads.start(JSON.parse(body)) });
    }
    if (url.pathname === '/api/download/cancel' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 10_000) throw new Error('İstek çok büyük.'); }
      await downloads.cancel(JSON.parse(body).id);
      return json(res, 200, { ok: true });
    }
    if (url.pathname === '/api/download/clear-failed' && req.method === 'POST') {
      const result = await downloads.clearFailed();
      return json(res, 200, { ok: true, removed: result.removed });
    }
    if (url.pathname === '/api/download/delete' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 10_000) throw new Error('İstek çok büyük.'); }
      await downloads.remove(JSON.parse(body).id);
      return json(res, 200, { ok: true });
    }
    if (url.pathname.startsWith('/api/download/poster/') && ['GET', 'HEAD'].includes(req.method)) {
      return downloads.servePoster(req, res, url.pathname.split('/')[4]);
    }
    if (url.pathname.startsWith('/api/download/file/')) {
      const parts = url.pathname.split('/');
      return downloads.serve(req, res, parts[4], parts[5]);
    }
    if (url.pathname === '/api/stream') return proxyStream(req, res, url.searchParams.get('url'), url.searchParams.get('referer') || '', url.searchParams.get('origin') || '');
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const safePath = path.normalize(path.join(ROOT, file));
    if (!safePath.startsWith(ROOT) || !fs.existsSync(safePath)) { res.writeHead(404); return res.end('Not found'); }
    const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': contentTypes[path.extname(safePath)] || 'application/octet-stream' });
    fs.createReadStream(safePath).pipe(res);
  } catch (error) { json(res, 500, { ok: false, error: error?.name === 'AbortError' ? 'Kaynak zaman aşımına uğradı' : error?.message || 'İşlem başarısız' }); }
});

function startServer(preferredPort = PORT) {
  if (server.listening) return Promise.resolve(server.address());
  return new Promise((resolve, reject) => {
    const tryListen = (portToTry, allowFallback = true) => {
      const onError = (err) => {
        server.removeListener('listening', onListening);
        if (err.code === 'EADDRINUSE' && allowFallback && portToTry !== 0) {
          console.warn(`[Maxen Server] Port ${portToTry} meşgul, boş bir port deneniyor...`);
          tryListen(0, false);
        } else {
          reject(err);
        }
      };
      const onListening = () => {
        server.removeListener('error', onError);
        resolve(server.address());
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(portToTry, '127.0.0.1');
    };
    tryListen(preferredPort, true);
  });
}

if (require.main === module) startServer();

if (HOT_RELOAD) {
  let reloadTimer;
  fs.watch(ROOT, (_event, filename) => {
    if (!filename || !/\.(?:css|js|html)$/i.test(filename)) return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      for (const client of hotClients) client.write(`event: reload\ndata: ${filename}\n\n`);
    }, 80);
  });
  console.log(`[Maxen Dev] Hot reload aktif: http://127.0.0.1:${PORT}`);
}

module.exports = { server, startServer };
