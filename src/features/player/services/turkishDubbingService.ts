import { Platform } from 'react-native';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface AlternatifItem {
  id: number;
  baslik: string;
  kalite?: number;
}

export interface TurkishDubbedResult {
  streamUrl: string;
  provider: string;
  headers?: Record<string, string>;
  isDubbed: boolean;
  language: string;
  label: string;
}

export interface ResolveTurkishParams {
  imdbId?: string;
  tmdbId?: string | number;
  title?: string;
  season?: number;
  episode?: number;
  isMovie?: boolean;
  timeoutMs?: number;
  cleanBaseUrl?: string;
}

/**
 * Parses bolum id (data-id) from SezonlukDizi episode page HTML
 */
export function extractBolumIdFromHtml(html: string): string | null {
  if (!html || typeof html !== 'string') return null;
  const match = html.match(/data-id=[\"'](\d+)[\"']/);
  return match ? match[1] : null;
}

/**
 * Parses JSON response from dataAlternatif22.asp
 */
export function parseAlternatifEmbeds(jsonStr: string): AlternatifItem[] {
  if (!jsonStr || typeof jsonStr !== 'string') return [];
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.data)) {
      return parsed.data;
    }
  } catch {
    // Ignore parse error
  }
  return [];
}

export interface ExtractedStream {
  streamUrl: string;
  headers?: Record<string, string>;
}

/**
 * Extracts m3u8 URL from VidMoly embed HTML
 */
export function extractVidmolyM3u8FromHtml(html: string): string | null {
  if (!html || typeof html !== 'string') return null;
  const normalized = html.replace(/\\\//g, '/');
  const fileMatch = normalized.match(/(?:file|src)\s*[:=]\s*['\"]([^'\"]+\.m3u8[^'\"]*)['\"]/i);
  if (fileMatch) return fileMatch[1];
  const directMatch = normalized.match(/https?:\/\/[^'"\s<>]+\.m3u8[^'"\s<>]*/i);
  return directMatch ? directMatch[0] : null;
}

/**
 * Universally extracts direct HLS (m3u8) or MP4 stream from alternative embed HTML.
 * Supports VidMoly, Sibnet, Dzen, Filemoon, etc.
 */
export function extractStreamFromAlternativeHtml(html: string, iframeUrl: string = ''): ExtractedStream | null {
  if (!html || typeof html !== 'string') return null;

  // 1. Sibnet (video.sibnet.ru) -> Doğrudan MP4 akışı
  if (iframeUrl.includes('sibnet.ru') || html.includes('video.sibnet.ru') || html.includes('sibnet')) {
    const sibMatch =
      html.match(/player\.src\(\[\s*\{\s*src:\s*["']([^"']+)["']/i) ||
      html.match(/src:\s*["']([^"']+\.mp4[^"']*)["']/i) ||
      html.match(/["'](\/v\/[a-zA-Z0-9_\-]+\/\d+\.mp4)["']/i);
    if (sibMatch) {
      const path = sibMatch[1];
      const fullUrl = path.startsWith('http') ? path : `https://video.sibnet.ru${path}`;
      return {
        streamUrl: fullUrl,
        headers: {
          Referer: 'https://video.sibnet.ru/',
          'User-Agent': USER_AGENT,
        },
      };
    }
  }

  // 2. Dzen (dzen.ru) -> Doğrudan HLS m3u8 akışı
  if (iframeUrl.includes('dzen.ru') || html.includes('dzen.ru')) {
    const dzenMatch =
      html.match(/"type"\s*:\s*"hls"[^}]*"url"\s*:\s*"([^"]+)"/i) ||
      html.match(/"url"\s*:\s*"([^"]+\.m3u8[^"]*)"/i);
    if (dzenMatch) {
      return {
        streamUrl: dzenMatch[1].replace(/\\/g, ''),
        headers: {
          Referer: 'https://dzen.ru/',
          'User-Agent': USER_AGENT,
        },
      };
    }
  }

  // 3. VidMoly / Standart JWPlayer / Video.js m3u8 kaynakları
  const normalized = html.replace(/\\\//g, '/');
  const fileMatch = normalized.match(/(?:file|src)\s*[:=]\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i);
  if (fileMatch) {
    let origin = 'https://sezonlukdizi.cc';
    try {
      origin = new URL(iframeUrl).origin;
    } catch { }
    return {
      streamUrl: fileMatch[1],
      headers: {
        Referer: `${origin}/`,
        Origin: origin,
        'User-Agent': USER_AGENT,
      },
    };
  }

  // 4. Genel Doğrudan HLS veya MP4 Akış URL'si
  const directMatch = normalized.match(/https?:\/\/[^'"\s<>]+\.(?:m3u8|mp4)(?:\?[^'"\s<>]*)?/i);
  if (directMatch) {
    let origin = 'https://sezonlukdizi.cc';
    try {
      origin = new URL(iframeUrl).origin;
    } catch { }
    return {
      streamUrl: directMatch[0],
      headers: {
        Referer: `${origin}/`,
        Origin: origin,
        'User-Agent': USER_AGENT,
      },
    };
  }

  return null;
}

export function normalizeSeriesTitle(value: string | undefined | null): string {
  return (value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\(\d{4}\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^(the|a|an)\s+/, '')
    .trim();
}

export function isLikelySeriesMatch(candidateTitle: string, requestedTitle?: string): boolean {
  const candidate = normalizeSeriesTitle(candidateTitle);
  const requested = normalizeSeriesTitle(requestedTitle);
  if (!candidate || !requested) return false;
  if (candidate === requested) return true;
  const requestedTokens = new Set(requested.split(' ').filter(Boolean));
  const candidateTokens = new Set(candidate.split(' ').filter(Boolean));
  const common = [...requestedTokens].filter((token) => candidateTokens.has(token)).length;
  return common / Math.max(requestedTokens.size, candidateTokens.size) >= 0.8;
}

export function hasTurkishDubMarker(html: string): boolean {
  return /data-dil\s*=\s*["']0["']/i.test(html) && /dublaj/i.test(html);
}

/**
 * Resolves a Turkish dubbed TV series stream from SezonlukDizi + VidMoly
 */
async function resolveSezonlukDiziSeries(
  query: { imdbId?: string; title?: string; originalTitle?: string },
  season: number,
  episode: number,
  timeoutMs: number = 8000
): Promise<TurkishDubbedResult[] | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const defaultHeaders = {
      'User-Agent': USER_AGENT,
      Referer: 'https://sezonlukdizi.cc/',
      'X-Requested-With': 'XMLHttpRequest',
    };

    // 1. Dizi araması: Önce IMDb ID ile dene, yoksa veya sonuç çıkmazsa başlıkla dene
    let seriesUrl: string | null = null;
    const searchTerms: string[] = [];
    if (query.imdbId && query.imdbId.startsWith('tt')) {
      searchTerms.push(query.imdbId);
    }
    if (query.originalTitle) {
      const cleanOrig = query.originalTitle.replace(/\s*\(\d{4}\)/g, '').trim();
      if (!searchTerms.includes(cleanOrig)) searchTerms.push(cleanOrig);
    }
    if (query.title) {
      const cleanTitle = query.title.replace(/\s*\(\d{4}\)/g, '').trim();
      if (!searchTerms.includes(cleanTitle)) searchTerms.push(cleanTitle);
    }

    console.log(`[TurkishDub] 🔍 SezonlukDizi arama terimleri:`, searchTerms);

    for (const term of searchTerms) {
      try {
        const searchRes = await fetch('https://sezonlukdizi.cc/ajax/arama.asp', {
          method: 'POST',
          headers: {
            ...defaultHeaders,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `q=${encodeURIComponent(term)}`,
          signal: controller.signal,
        });

        if (!searchRes.ok) continue;

        const searchData = await searchRes.json().catch(() => null);
        const seriesList = searchData?.results?.diziler?.results;

        if (Array.isArray(seriesList) && seriesList.length > 0) {
          // Eğer IMDb ID ile arandıysa veya tek sonuç varsa ilk sonuç kesin eşleşmedir!
          let matchedSeries: any = null;
          if (term.startsWith('tt')) {
            matchedSeries = seriesList[0];
          } else if (query.originalTitle) {
            matchedSeries =
              seriesList.find((item: any) => isLikelySeriesMatch(item?.title || item?.name || '', query.originalTitle)) ||
              seriesList[0];
          } else if (query.title) {
            matchedSeries =
              seriesList.find((item: any) => isLikelySeriesMatch(item?.title || item?.name || '', query.title)) ||
              seriesList[0];
          } else {
            matchedSeries = seriesList[0];
          }

          seriesUrl = matchedSeries?.url || null;
          if (!seriesUrl) continue;
          break;
        }
      } catch (searchErr) {
      }
    }

    if (!seriesUrl) {
      console.warn(`[TurkishDub] ⚠️ SezonlukDizi'de dizi bulunamadı.`);
      return null;
    }

    const slugMatch = seriesUrl.match(/\/diziler\/([a-zA-Z0-9_-]+)\.html/);
    const slug = slugMatch ? slugMatch[1] : seriesUrl.replace(/^\/diziler\/|\.html$/g, '');
    if (!slug) {
      return null;
    }

    // 2. Bölüm sayfasını çek (Önce /dublaj/ URL'si, olmazsa normal URL)
    const dublajUrl = `https://sezonlukdizi.cc/${slug}/dublaj/${season}-sezon-${episode}-bolum.html`;
    const normalUrl = `https://sezonlukdizi.cc/${slug}/${season}-sezon-${episode}-bolum.html`;

    let epHtml = '';
    let bolumId: string | null = null;
    let usedUrl = dublajUrl;

    try {
      const epPageRes = await fetch(dublajUrl, {
        headers: { 'User-Agent': USER_AGENT, Referer: 'https://sezonlukdizi.cc/' },
        signal: controller.signal,
      });

      if (epPageRes.ok) {
        epHtml = await epPageRes.text();
        if (hasTurkishDubMarker(epHtml)) {
          bolumId = extractBolumIdFromHtml(epHtml);
        }
      }
    } catch { }

    // /dublaj/ sayfasından dublaj bulunamadıysa standart bölüm sayfasını kontrol et
    if (!bolumId) {
      try {
        const normalRes = await fetch(normalUrl, {
          headers: { 'User-Agent': USER_AGENT, Referer: 'https://sezonlukdizi.cc/' },
          signal: controller.signal,
        });
        if (normalRes.ok) {
          const normalHtml = await normalRes.text();
          if (hasTurkishDubMarker(normalHtml)) {
            bolumId = extractBolumIdFromHtml(normalHtml);
            usedUrl = normalUrl;
          }
        }
      } catch { }
    }

    if (!bolumId) {
      return null;
    }

    // 3. dil=0 (Dublaj) alternatiflerini çek
    const altRes = await fetch('https://sezonlukdizi.cc/ajax/dataAlternatif22.asp', {
      method: 'POST',
      headers: {
        ...defaultHeaders,
        Referer: usedUrl,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `bid=${bolumId}&dil=0`,
      signal: controller.signal,
    });

    // console.log(`[TurkishDub] 📡 dataAlternatif22 HTTP Durumu: ${altRes.status}`);
    if (!altRes.ok) {
      // console.warn(`[TurkishDub] ❌ dataAlternatif22 başarısız: HTTP ${altRes.status}`);
      return null;
    }

    const altText = await altRes.text();
    const alternatives = parseAlternatifEmbeds(altText);

    if (alternatives.length === 0) {
      return null;
    }

    // Alternatifleri öncelik sırasına göre sırala: VidMoly > Sibnet > Dzen > Filemoon > Diğerleri
    const providerPriority: Record<string, number> = {
      vidmoly: 1,
      sibnet: 2,
      dzen: 3,
      filemoon: 4,
      pixel: 5,
    };
    alternatives.sort((a, b) => {
      const pA = providerPriority[(a.baslik || '').toLowerCase().trim()] || 99;
      const pB = providerPriority[(b.baslik || '').toLowerCase().trim()] || 99;
      return pA - pB;
    });

    // 4. Bütün alternatifleri paralel çöz ve başarılı doğrudan HLS/MP4 kaynaklarını topla
    const settled = await Promise.allSettled(alternatives.map(async (targetAlt) => {
      if (!targetAlt || !targetAlt.id) return null;
      try {
        const embedRes = await fetch('https://sezonlukdizi.cc/ajax/dataEmbed22.asp', {
          method: 'POST',
          headers: {
            ...defaultHeaders,
            Referer: usedUrl,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `id=${targetAlt.id}`,
          signal: controller.signal,
        });

        if (!embedRes.ok) return null;

        const embedHtml = await embedRes.text();
        const iframeSrcMatch = embedHtml.match(/src=[\"']([^\"']+)[\"']/);
        if (!iframeSrcMatch) return null;

        let iframeUrl = iframeSrcMatch[1];
        if (iframeUrl.startsWith('//')) iframeUrl = `https:${iframeUrl}`;
        if (!iframeUrl.startsWith('http')) iframeUrl = `https://sezonlukdizi.cc${iframeUrl}`;
        if (iframeUrl.includes('vidmoly.net')) {
          iframeUrl = iframeUrl.replace('vidmoly.net', 'vidmoly.biz');
        }

        // reCAPTCHA / Turnstile gerektiren alternatifleri atla
        if (iframeUrl.includes('reCAPTCHA') || iframeUrl.includes('turnstile')) {
          return null;
        }

        const providerRes = await fetch(iframeUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            Referer: usedUrl,
          },
          signal: controller.signal,
        });

        if (!providerRes.ok) return null;

        const providerHtml = await providerRes.text();
        const extracted = extractStreamFromAlternativeHtml(providerHtml, providerRes.url || iframeUrl);

        if (extracted && extracted.streamUrl) {
          return {
            streamUrl: extracted.streamUrl,
            provider: `Türkçe Dublaj (${targetAlt.baslik || 'Alternatif'})`,
            headers: extracted.headers || {
              Referer: usedUrl,
              'User-Agent': USER_AGENT,
            },
            isDubbed: true,
            language: 'tr',
            label: 'Türkçe',
          } satisfies TurkishDubbedResult;
        }
      } catch (e) {
      }
      return null;
    }));

    const results = settled
      .flatMap((result) => result.status === 'fulfilled' && result.value ? [result.value] : [])
      .filter((result, index, list) => list.findIndex((candidate) => candidate.streamUrl === result.streamUrl) === index);

    if (results.length > 0) {
      return results;
    }

    return null;
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Main function to resolve Turkish Dubbed streams.
 * Handles both TV series and movies with client-side & serverless fallback.
 */
export async function resolveTurkishDubbedStream({
  imdbId,
  tmdbId,
  title,
  season = 1,
  episode = 1,
  isMovie = false,
  timeoutMs = 8000,
  cleanBaseUrl,
}: ResolveTurkishParams): Promise<TurkishDubbedResult[] | null> {
  const isBrowser = Platform.OS === 'web' && typeof window !== 'undefined' && !process.env.JEST_WORKER_ID;

  // Web ortamında CORS kısıtlaması nedeniyle doğrudan backend proxy endpoint'ine git
  if (isBrowser) {
    try {
      const base = cleanBaseUrl || 'https://maxen.sbs';
      const cleanBase = base.replace(/\/api\/?$/, '').replace(/\/$/, '');
      const q = new URLSearchParams();
      if (imdbId) q.append('imdbId', imdbId);
      if (tmdbId) q.append('tmdbId', String(tmdbId));
      if (title) q.append('title', title);
      q.append('season', String(season));
      q.append('episode', String(episode));
      q.append('type', isMovie ? 'movie' : 'tv');

      const res = await fetch(`${cleanBase}/api/turkish-dub?${q.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      const isJson = res.headers.get('content-type')?.includes('application/json');
      if (res.ok && isJson) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.results)) {
          return data.results
            .filter((item: any) => item?.streamUrl)
            .map((item: any) => ({
              streamUrl: item.streamUrl,
              provider: item.provider || 'Türkçe Dublaj',
              headers: item.headers || {},
              isDubbed: true,
              language: 'tr',
              label: 'Türkçe',
            }));
        }
        if (data?.success && data?.streamUrl) {
          return [{
            streamUrl: data.streamUrl,
            provider: data.provider || 'Türkçe Dublaj',
            headers: data.headers || {},
            isDubbed: true,
            language: 'tr',
            label: 'Türkçe',
          }];
        }
      }
    } catch (e) {
    }
  }

  // Native (Android / TV / iOS) veya test ortamında doğrudan yerel çözümleme
  let activeImdbId = imdbId;
  let activeOriginalTitle: string | undefined = undefined;

  if (tmdbId) {
    const tmdbType = isMovie ? 'movie' : 'tv';
    const base = cleanBaseUrl || 'https://maxen.sbs';
    const cleanBase = base.replace(/\/api\/?$/, '').replace(/\/$/, '');

    // 1. IMDb ID sorgula
    if (!activeImdbId) {
      try {
        const extRes = await fetch(`${cleanBase}/api/tmdb/${tmdbType}/${tmdbId}/external_ids`);
        if (extRes.ok) {
          const ext = await extRes.json();
          if (ext?.imdb_id) activeImdbId = ext.imdb_id;
        } else {
          const fallbackRes = await fetch(`${cleanBase}/api/tmdb?path=/${tmdbType}/${tmdbId}/external_ids`);
          if (fallbackRes.ok) {
            const ext = await fallbackRes.json();
            if (ext?.imdb_id) activeImdbId = ext.imdb_id;
          }
        }
      } catch (tmdbErr) { }
    }

    // 2. Orijinal başlığı TMDB detaylarından al
    try {
      const detailsRes = await fetch(`${cleanBase}/api/tmdb/${tmdbType}/${tmdbId}?language=tr-TR`);
      if (detailsRes.ok) {
        const details = await detailsRes.json();
        activeOriginalTitle = details?.original_name || details?.original_title || details?.name || details?.title;
      }
    } catch { }
  }

  if (!isMovie) {
    console.log(`[TurkishDub] 📺 SezonlukDizi araması başlatılıyor: IMDb: ${activeImdbId || 'yok'}, Orijinal Başlık: "${activeOriginalTitle || 'yok'}", Başlık: "${title}", S${season}E${episode}...`);
    const result = await resolveSezonlukDiziSeries(
      { imdbId: activeImdbId, title, originalTitle: activeOriginalTitle },
      season,
      episode,
      timeoutMs
    );
    if (result && result.length > 0) {
      console.log(`[TurkishDub] 🎉 ${result.length} adet Dublaj akışı bulundu:`, result.map((r) => r.provider));
      return result;
    } else {
      console.warn(`[TurkishDub] ⚠️ SezonlukDizi'den dublaj akışı alınamadı.`);
    }
  } else {
    console.log(`[TurkishDub] 🎬 Filmler için yerel Türkçe dublaj servisi henüz bağlanmadı.`);
  }

  return null;
}

