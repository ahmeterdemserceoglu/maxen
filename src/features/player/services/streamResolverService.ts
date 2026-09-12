import { Platform } from 'react-native';
import { streamSessionManager } from './StreamSessionManager';

export interface ResolverParams {
  tmdbId: string;
  isMovie: boolean;
  seasonNum: number;
  episodeNum: number;
  cleanBaseUrl?: string;
  timeoutMs?: number;
  audioLang?: string;
}

export interface ResolvedStreamResult {
  streamUrl: string;
  provider: string;
  headers?: Record<string, string>;
  subtitles?: any[];
  isEmbed?: boolean;
  audioLanguage?: string;
}

export const STREAM_AUDIO_LANGUAGES = ['tr', 'en', 'it', 'de', 'fr', 'es', 'pt', 'ru', 'ja', 'ko'] as const;

export function isDirectStream(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('.m3u8') ||
    lower.includes('.mp4') ||
    lower.includes('/playlist/') ||
    lower.includes('manifest')
  );
}

export function promiseAny<T>(promises: Promise<T>[]): Promise<T> {
  if (typeof Promise.any === 'function') {
    return Promise.any(promises);
  }
  return new Promise((resolve, reject) => {
    let rejectionCount = 0;
    const errors: any[] = [];
    if (promises.length === 0) {
      return reject(new Error('All promises were rejected (empty array)'));
    }
    promises.forEach((p, idx) => {
      Promise.resolve(p)
        .then(resolve)
        .catch((err) => {
          errors[idx] = err;
          rejectionCount++;
          if (rejectionCount === promises.length) {
            reject(new Error('All promises were rejected: ' + errors.map(e => e?.message || e).join(', ')));
          }
        });
    });
  });
}

/**
 * Single backend endpoint resolver with strict timeout
 */
export async function fetchBackendEndpoint(
  apiUrl: string,
  providerName: string,
  timeoutMs: number = 3500
): Promise<ResolvedStreamResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[Fast-Fail Resolver] İstek atılıyor (${providerName}): ${apiUrl}`);
    const res = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP status ${res.status}`);
    }

    const data = await res.json();
    if (data?.success && data?.streamUrl) {
      if (!data.isEmbed && isDirectStream(data.streamUrl)) {
        console.log(`[Fast-Fail Resolver] ✅ ${providerName} BAŞARILI! Doğrudan Akış: ${data.streamUrl}`);
        return {
          streamUrl: data.streamUrl,
          provider: data.provider || providerName,
          headers: data.headers || {},
          subtitles: data.subtitles || [],
          isEmbed: false,
        };
      } else if (data.isEmbed) {
        console.log(`[Fast-Fail Resolver] ℹ️ ${providerName} Embed URL döndü: ${data.streamUrl}`);
        return {
          streamUrl: data.streamUrl,
          provider: data.provider || providerName,
          headers: data.headers || {},
          subtitles: data.subtitles || [],
          isEmbed: true,
        };
      }
    }
    throw new Error(`Invalid response or non-direct stream from ${providerName}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Direct Client-Side VixSrc resolver with strict timeout
 */
export async function resolveVixSrcDirect({
  tmdbId,
  isMovie,
  seasonNum,
  episodeNum,
  timeoutMs = 3500,
  audioLang,
}: Omit<ResolverParams, 'cleanBaseUrl'>): Promise<ResolvedStreamResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const query = audioLang ? `?lang=${encodeURIComponent(audioLang)}` : '';
    const apiUrl = !isMovie
      ? `https://vixsrc.to/api/tv/${tmdbId}/${seasonNum}/${episodeNum}${query}`
      : `https://vixsrc.to/api/movie/${tmdbId}${query}`;

    console.log(`[Fast-Fail Resolver] İstek atılıyor (VixSrc Direct): ${apiUrl}`);
    const res = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Referer: 'https://vixsrc.to/',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': audioLang === 'tr' ? 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7' : 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) throw new Error(`VixSrc API status ${res.status}`);
    const data = await res.json();
    if (!data?.src) throw new Error('VixSrc API src bulunamadı');

    const embedUrl = `https://vixsrc.to${data.src}`;
    const embedRes = await fetch(embedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Referer: 'https://vixsrc.to/',
      },
    });

    if (!embedRes.ok) throw new Error(`VixSrc embed status ${embedRes.status}`);
    const html = await embedRes.text();

    let directUrl: string | null = null;

    // 1. masterPlaylist bloğundan ayıkla
    const masterMatch = html.match(/window\.masterPlaylist\s*=\s*(\{[\s\S]*?\});/);
    if (masterMatch) {
      const block = masterMatch[1];
      const urlM = block.match(/url:\s*['"]([^'"]+)['"]/);
      const tokenM = block.match(/['"]token['"]:\s*['"]([^'"]+)['"]/);
      const expM = block.match(/['"]expires['"]:\s*['"]([^'"]+)['"]/);

      if (urlM && urlM[1]) {
        const cleanBase = urlM[1].replace(/\\/g, '');
        const token = tokenM ? tokenM[1] : '';
        const expires = expM ? expM[1] : '';
        const q: string[] = [];
        if (token) q.push(`token=${token}`);
        if (expires) q.push(`expires=${expires}`);
        q.push('h=1');
        if (audioLang) q.push(`lang=${encodeURIComponent(audioLang)}`);
        const sep = cleanBase.includes('?') ? '&' : '?';
        directUrl = `${cleanBase}${sep}${q.join('&')}#master.m3u8`;
      }
    }

    // 2. Fallback: Genel regex arama
    if (!directUrl) {
      const urlM = html.match(/url:\s*['"]([^'"]+)['"]/);
      const tokenM = html.match(/['"]token['"]:\s*['"]([^'"]+)['"]/);
      const expM = html.match(/['"]expires['"]:\s*['"]([^'"]+)['"]/);
      if (urlM) {
        const cleanBase = (urlM[1].startsWith('http') ? urlM[1] : `https://vixsrc.to${urlM[1]}`).replace(/\\/g, '');
        const token = tokenM ? tokenM[1] : '';
        const expires = expM ? expM[1] : '';
        const q: string[] = [];
        if (token) q.push(`token=${token}`);
        if (expires) q.push(`expires=${expires}`);
        q.push('h=1');
        if (audioLang) q.push(`lang=${encodeURIComponent(audioLang)}`);
        const sep = cleanBase.includes('?') ? '&' : '?';
        directUrl = `${cleanBase}${sep}${q.join('&')}#master.m3u8`;
      }
    }

    if (!directUrl) throw new Error('VixSrc m3u8 url pattern eşleşmedi');

    console.log(`[Fast-Fail Resolver] ✅ VixSrc Direct BAŞARILI! Akış: ${directUrl}`);
    return {
      streamUrl: directUrl,
      provider: audioLang ? `VixSrc Direct (${audioLang})` : 'VixSrc Direct',
      audioLanguage: audioLang,
      headers: {
        Referer: 'https://vixsrc.to/',
        Origin: 'https://vixsrc.to',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Resolves language streams. VixSrc master m3u8 playlists contain embedded audio tracks
 * directly (e.g. English, Italian). External VixSrc lang queries do not serve separate audio.
 */
export async function resolveVixSrcLanguageStreams(
  _params: Omit<ResolverParams, 'cleanBaseUrl' | 'audioLang'>,
  _languages: readonly string[] = STREAM_AUDIO_LANGUAGES
): Promise<ResolvedStreamResult[]> {
  return [];
}

/**
 * Single Direct HTTP probe with regex scanner and strict timeout
 */
export async function resolveDirectHttpSingle(
  targetUrl: string,
  providerLabel: string,
  timeoutMs: number = 3500
): Promise<ResolvedStreamResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: targetUrl,
      },
    });

    if (!res.ok) throw new Error(`HTTP status ${res.status}`);
    const htmlText = await res.text();

    const directStreamMatches = htmlText.match(/https?:\/\/[^"'\s\\]+?\.(?:m3u8|mp4)(?:\?[^"'\s\\]*)?/gi);
    if (directStreamMatches && directStreamMatches.length > 0) {
      const matchedUrl = directStreamMatches[0];
      console.log(`[Fast-Fail Resolver] ✅ Direct HTTP (${providerLabel}) BAŞARILI! Akış: ${matchedUrl}`);
      return {
        streamUrl: matchedUrl,
        provider: `Direct HTTP (${providerLabel})`,
        headers: {
          Referer: targetUrl,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        },
      };
    }
    throw new Error(`Direct stream match not found in ${providerLabel}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parallel Fast-Fail Resolver Result
 * Concurrently races all high-priority direct HLS stream sources (Backend API, Cloudflare Worker, VixSrc, Direct HTTP)
 * with a strict 3.5s timeout.
 * Resolves immediately with the fastest valid stream result or null on failure!
 */
export async function resolveParallelDirectStreamResult({
  tmdbId,
  isMovie,
  seasonNum,
  episodeNum,
  cleanBaseUrl,
  timeoutMs = 3500,
  audioLang,
}: ResolverParams): Promise<ResolvedStreamResult | null> {
  const startTime = Date.now();
  const type = isMovie ? 'movie' : 'tv';
  const effectiveBaseUrl = (
    cleanBaseUrl ||
    (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://maxen.sbs')
  ).replace(/\/api\/?$/, '').replace(/\/$/, '');

  const langQuery = audioLang ? `&lang=${encodeURIComponent(audioLang)}` : '';
  const mainBackendUrl = `${effectiveBaseUrl}/api/stream?tmdbId=${tmdbId}&type=${type}&season=${seasonNum}&episode=${episodeNum}${langQuery}`;
  const workerBackendUrl = `https://maxen-stream-api.ahmeterdemserceoglo.workers.dev/api/stream?tmdbId=${tmdbId}&type=${type}&season=${seasonNum}&episode=${episodeNum}${langQuery}`;

  console.log(`[Parallel Fast-Fail Resolver] 🚀 Paralel doğrudan akış çözümü başlatılıyor (${timeoutMs}ms limit)...`);

  const isBrowser = Platform.OS === 'web' && typeof window !== 'undefined' && !process.env.JEST_WORKER_ID;

  const parallelTasks: Promise<ResolvedStreamResult>[] = [];

  // Mobilde ve test ortamlarında doğrudan istemci VixSrc çağrılabilir
  if (!isBrowser) {
    parallelTasks.push(resolveVixSrcDirect({ tmdbId, isMovie, seasonNum, episodeNum, timeoutMs, audioLang }));
  }

  // Ana Backend API (Node.js / Vercel Serverless - CORS'suz sunucu taraflı çözümleme)
  parallelTasks.push(fetchBackendEndpoint(mainBackendUrl, 'Maxen Primary Backend', timeoutMs));

  // Cloudflare Worker API (Tarayıcı dışında yedek)
  if (!isBrowser) {
    parallelTasks.push(fetchBackendEndpoint(workerBackendUrl, 'Maxen Cloudflare Worker', timeoutMs));
  }

  try {
    const winner = await promiseAny(parallelTasks);
    const elapsed = Date.now() - startTime;
    console.log(`[Parallel Fast-Fail Resolver] 🎯 KAZANAN: [${winner.provider}] ${elapsed}ms içinde çözüldü -> ${winner.streamUrl}`);

    return winner;
  } catch (aggErr) {
    const elapsed = Date.now() - startTime;
    console.warn(`[Parallel Fast-Fail Resolver] ❌ Tüm direkt HLS kaynakları ${elapsed}ms içinde başarısız oldu veya zaman aşımına uğradı.`);
    return null;
  }
}

/**
 * Parallel Fast-Fail Resolver
 * Concurrently races all high-priority direct HLS stream sources (Backend API, Cloudflare Worker, VixSrc, Direct HTTP)
 * with a strict 3.5s timeout.
 * Resolves immediately with the fastest valid stream!
 */
export async function resolveParallelDirectStream(params: ResolverParams): Promise<boolean> {
  const result = await resolveParallelDirectStreamResult(params);
  return result !== null;
}

// ─── GERİYE DÖNÜK UYUMLULUK FONKSİYONLARI ────────────────────────

export async function fetchBackendStream({
  tmdbId,
  isMovie,
  seasonNum,
  episodeNum,
  cleanBaseUrl,
  timeoutMs = 3500,
  audioLang,
}: ResolverParams): Promise<boolean> {
  const type = isMovie ? 'movie' : 'tv';
  const effectiveBaseUrl = (cleanBaseUrl || 'https://maxen.sbs').replace(/\/api\/?$/, '').replace(/\/$/, '');
  const langQuery = audioLang ? `&lang=${encodeURIComponent(audioLang)}` : '';
  const urlsToTry = [
    { url: `${effectiveBaseUrl}/api/stream?tmdbId=${tmdbId}&type=${type}&season=${seasonNum}&episode=${episodeNum}${langQuery}`, name: 'Maxen Primary Backend' },
    { url: `https://maxen-stream-api.ahmeterdemserceoglo.workers.dev/api/stream?tmdbId=${tmdbId}&type=${type}&season=${seasonNum}&episode=${episodeNum}${langQuery}`, name: 'Maxen Cloudflare Worker' },
  ];

  try {
    const winner = await promiseAny(
      urlsToTry.map(u => fetchBackendEndpoint(u.url, u.name, timeoutMs))
    );
    streamSessionManager.setSession({
      streamUrl: winner.streamUrl,
      provider: winner.provider,
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
      headers: winner.headers || {},
    });
    return true;
  } catch {
    return false;
  }
}

export async function fetchVixSrcDirectClientSide({
  tmdbId,
  isMovie,
  seasonNum,
  episodeNum,
  timeoutMs = 3500,
  audioLang,
}: Omit<ResolverParams, 'cleanBaseUrl'>): Promise<boolean> {
  try {
    const result = await resolveVixSrcDirect({ tmdbId, isMovie, seasonNum, episodeNum, timeoutMs, audioLang });
    streamSessionManager.setSession({
      streamUrl: result.streamUrl,
      provider: result.provider,
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
      headers: result.headers || {},
    });
    return true;
  } catch {
    return false;
  }
}

export async function runDirectHttpResolver({
  tmdbId,
  isMovie,
  seasonNum,
  episodeNum,
  timeoutMs = 3500,
}: Omit<ResolverParams, 'cleanBaseUrl'>): Promise<boolean> {
  // Web tarayıcısında üçüncü taraf sitelerin kazınması CORS tarafından engellenir
  const isBrowser = Platform.OS === 'web' && typeof window !== 'undefined' && !process.env.JEST_WORKER_ID;
  if (isBrowser) return false;

  const targetUrls = [
    { name: 'Videasy', url: !isMovie ? `https://player.videasy.net/tv/${tmdbId}/${seasonNum}/${episodeNum}` : `https://player.videasy.net/movie/${tmdbId}` },
    { name: 'Rivestream', url: !isMovie ? `https://rivestream.live/embed?type=series&id=${tmdbId}&season=${seasonNum}&episode=${episodeNum}` : `https://rivestream.live/embed?type=movie&id=${tmdbId}` },
    { name: 'AnyEmbed', url: !isMovie ? `https://anyembed.xyz/embed/tv/${tmdbId}/${seasonNum}/${episodeNum}` : `https://anyembed.xyz/embed/movie/${tmdbId}` },
    { name: 'Vidsrc.to', url: !isMovie ? `https://vidsrc.to/embed/tv/${tmdbId}/${seasonNum}/${episodeNum}` : `https://vidsrc.to/embed/movie/${tmdbId}` },
    { name: 'Vidsrc.net', url: !isMovie ? `https://vidsrc.net/embed/tv/${tmdbId}/${seasonNum}/${episodeNum}` : `https://vidsrc.net/embed/movie/${tmdbId}` },
    { name: 'Vidsrc.icu', url: !isMovie ? `https://vidsrc.icu/embed/tv/${tmdbId}/${seasonNum}/${episodeNum}` : `https://vidsrc.icu/embed/movie/${tmdbId}` },
    { name: 'VidSrc.xyz', url: !isMovie ? `https://vidsrc.xyz/embed/tv/${tmdbId}/${seasonNum}/${episodeNum}` : `https://vidsrc.xyz/embed/movie/${tmdbId}` },
    { name: 'VidSrc.in', url: !isMovie ? `https://vidsrc.in/embed/tv/${tmdbId}/${seasonNum}/${episodeNum}` : `https://vidsrc.in/embed/movie/${tmdbId}` },
    { name: 'VidSrc.vip', url: !isMovie ? `https://vidsrc.vip/embed/tv/${tmdbId}/${seasonNum}/${episodeNum}` : `https://vidsrc.vip/embed/movie/${tmdbId}` },
    { name: 'AutoEmbed', url: !isMovie ? `https://player.autoembed.cc/embed/tv/${tmdbId}/${seasonNum}/${episodeNum}` : `https://player.autoembed.cc/embed/movie/${tmdbId}` },
    { name: 'MoviesAPI', url: !isMovie ? `https://moviesapi.club/tv/${tmdbId}-${seasonNum}-${episodeNum}` : `https://moviesapi.club/movie/${tmdbId}` },
    { name: 'SmashyStream', url: !isMovie ? `https://embed.smashystream.com/playere.php?tmdb=${tmdbId}&season=${seasonNum}&episode=${episodeNum}` : `https://embed.smashystream.com/playere.php?tmdb=${tmdbId}` },
    { name: 'VidSrc.pro', url: !isMovie ? `https://vidsrc.pro/embed/tv/${tmdbId}/${seasonNum}/${episodeNum}` : `https://vidsrc.pro/embed/movie/${tmdbId}` },
    { name: 'VidFast', url: !isMovie ? `https://vidfast.pro/embed/tv/${tmdbId}/${seasonNum}/${episodeNum}` : `https://vidfast.pro/embed/movie/${tmdbId}` },
  ];

  try {
    const winner = await promiseAny(
      targetUrls.map(t => resolveDirectHttpSingle(t.url, t.name, timeoutMs))
    );
    streamSessionManager.setSession({
      streamUrl: winner.streamUrl,
      provider: winner.provider,
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
      headers: winner.headers || {},
    });
    return true;
  } catch {
    return false;
  }
}
