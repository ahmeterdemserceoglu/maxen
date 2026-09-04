// Cloudflare Worker - Maxen Stream API
// Domain: maxen.sbs / maxen-stream-api

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function extractVixSrcStream(embedUrl, lang = '') {
  try {
    console.log('[Worker] Fetching embedUrl:', embedUrl);
    const res = await fetchWithTimeout(
      embedUrl,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Referer: 'https://vixsrc.to/',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      },
      8000
    );

    console.log('[Worker] embedRes status:', res.status);
    if (!res.ok) return null;
    const html = await res.text();
    console.log('[Worker] embedHtml length:', html.length);

    // 1. Try masterPlaylist extraction
    const urlM = html.match(/url:\s*['"]([^'"]+)['"]/);
    const tokenM = html.match(/['"]token['"]:\s*['"]([^'"]+)['"]/);
    const expM = html.match(/['"]expires['"]:\s*['"]([^'"]+)['"]/);
    console.log('[Worker] urlM:', urlM ? urlM[1] : null);

    if (urlM) {
      const token = tokenM ? tokenM[1] : '';
      const expires = expM ? expM[1] : '';

      const rawUrl = urlM[1].startsWith('http') ? urlM[1] : `https://vixsrc.to${urlM[1]}`;
      let pathname = rawUrl;
      let existingQuery = '';

      if (rawUrl.includes('?')) {
        const parts = rawUrl.split('?');
        pathname = parts[0];
        existingQuery = parts[1];
      }

      if (!pathname.endsWith('.m3u8')) {
        pathname = `${pathname}.m3u8`;
      }

      const queryParts = [];
      if (existingQuery) queryParts.push(existingQuery);
      if (token) queryParts.push(`token=${token}`);
      if (expires) queryParts.push(`expires=${expires}`);
      queryParts.push('h=1');
      if (lang) queryParts.push(`lang=${encodeURIComponent(lang)}`);

      const streamUrl = `${pathname}?${queryParts.join('&')}`;
      return streamUrl;
    }

    // 2. Try window.streams extraction fallback
    const streamsM = html.match(/window\.streams\s*=\s*(\[[\s\S]*?\]);/);
    if (streamsM) {
      const matchUrl = streamsM[1].match(/https?:\\?\/\\?[^"' ]+/);
      if (matchUrl) {
        return matchUrl[0].replace(/\\/g, '') + '#.m3u8';
      }
    }
  } catch (e) {
    console.error('[Worker] extractVixSrcStream error:', e);
  }
  return null;
}

async function getVixSrcUrl(id, type, s, e, lang = '') {
  try {
    const query = lang ? `?lang=${encodeURIComponent(lang)}` : '';
    const apiUrl =
      type === 'tv'
        ? `https://vixsrc.to/api/tv/${id}/${s}/${e}${query}`
        : `https://vixsrc.to/api/movie/${id}${query}`;

    console.log('[Worker] Fetching VixSrc API:', apiUrl);
    const res = await fetchWithTimeout(
      apiUrl,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Referer: 'https://vixsrc.to/',
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': lang === 'tr' ? 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7' : 'en-US,en;q=0.9',
        },
      },
      8000
    );

    console.log('[Worker] VixSrc API status:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log('[Worker] VixSrc API data:', JSON.stringify(data));
      if (data?.src) {
        const embedUrl = `https://vixsrc.to${data.src}`;
        const directHls = await extractVixSrcStream(embedUrl, lang);
        if (directHls) {
          return {
            streamUrl: directHls,
            isEmbed: false,
            provider: 'VixSrc Direct',
          };
        }
      }
    }
  } catch (err) {
    console.error('[Worker] getVixSrcUrl error:', err);
  }
  return null;
}

async function extractDirectStream(targetUrl, referer, providerName, timeoutMs = 8000) {
  try {
    console.log(`[Worker] Fetching probe for ${providerName}:`, targetUrl);
    const res = await fetchWithTimeout(
      targetUrl,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Referer: referer,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      },
      timeoutMs
    );
    if (!res.ok) return null;
    const html = await res.text();
    const directMatches = html.match(/https?:\/\/[^"'\s\\]+?\.(?:m3u8|mp4)(?:\?[^"'\s\\]*)?/gi);
    if (directMatches && directMatches.length > 0) {
      return {
        streamUrl: directMatches[0],
        provider: providerName,
        referer: referer,
        isEmbed: false,
      };
    }
  } catch (err) {
    console.error(`[Worker] ${providerName} probe error:`, err);
  }
  return null;
}

async function getSuperEmbedStream(id, type, s, e) {
  const targetUrl =
    type === 'tv'
      ? `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1&s=${s}&e=${e}`
      : `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1`;
  return extractDirectStream(targetUrl, 'https://multiembed.mov/', 'SuperEmbed Direct');
}

async function getSmashyStream(id, type, s, e) {
  const targetUrl =
    type === 'tv'
      ? `https://embed.smashystream.com/playere.php?tmdb=${id}&season=${s}&episode=${e}`
      : `https://embed.smashystream.com/playere.php?tmdb=${id}`;
  return extractDirectStream(targetUrl, 'https://embed.smashystream.com/', 'SmashyStream Direct');
}

async function resolveStream(tmdbId, type, season, episode, lang = '') {
  // 1. Try VixSrc Direct HLS extraction (with lang preference)
  const vixResult = await getVixSrcUrl(tmdbId, type, season, episode, lang);
  if (vixResult && vixResult.streamUrl) {
    return {
      provider: vixResult.provider,
      streamUrl: vixResult.streamUrl,
      referer: 'https://vixsrc.to/',
      isEmbed: false,
    };
  }

  // 2. Try SuperEmbed Direct extraction probe
  const superEmbedResult = await getSuperEmbedStream(tmdbId, type, season, episode);
  if (superEmbedResult && superEmbedResult.streamUrl) {
    return {
      provider: superEmbedResult.provider,
      streamUrl: superEmbedResult.streamUrl,
      referer: superEmbedResult.referer || 'https://multiembed.mov/',
      isEmbed: false,
    };
  }

  // 3. Try SmashyStream Direct extraction probe
  const smashyResult = await getSmashyStream(tmdbId, type, season, episode);
  if (smashyResult && smashyResult.streamUrl) {
    return {
      provider: smashyResult.provider,
      streamUrl: smashyResult.streamUrl,
      referer: smashyResult.referer || 'https://embed.smashystream.com/',
      isEmbed: false,
    };
  }

  return {
    provider: 'None',
    streamUrl: null,
    isEmbed: false,
    error: 'No direct HLS stream available',
  };
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === '/api/stream' || pathname === '/stream') {
      const rawTmdbId = url.searchParams.get('tmdbId');
      const rawType = url.searchParams.get('type') || 'movie';
      const rawSeason = url.searchParams.get('season') || '1';
      const rawEpisode = url.searchParams.get('episode') || '1';
      const rawLang = url.searchParams.get('lang') || '';

      if (!rawTmdbId || typeof rawTmdbId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(rawTmdbId.trim())) {
        return jsonResponse(
          { success: false, error: 'Valid tmdbId parameter is required' },
          400
        );
      }
      const tmdbId = rawTmdbId.trim();

      const type = rawType.toLowerCase().trim();
      if (type !== 'movie' && type !== 'tv') {
        return jsonResponse(
          { success: false, error: "Invalid type parameter: must be 'movie' or 'tv'" },
          400
        );
      }

      const season = parseInt(rawSeason, 10);
      if (Number.isNaN(season) || season < 1) {
        return jsonResponse(
          { success: false, error: 'Invalid season parameter: must be a positive integer (>= 1)' },
          400
        );
      }

      const episode = parseInt(rawEpisode, 10);
      if (Number.isNaN(episode) || episode < 1) {
        return jsonResponse(
          { success: false, error: 'Invalid episode parameter: must be a positive integer (>= 1)' },
          400
        );
      }

      const lang = typeof rawLang === 'string' ? rawLang.trim().toLowerCase() : '';

      try {
        const result = await resolveStream(tmdbId, type, season, episode, lang);
        if (!result.streamUrl) {
          return jsonResponse(
            { success: false, error: result.error || 'Stream not found' },
            404
          );
        }

        return jsonResponse(
          {
            success: true,
            provider: result.provider,
            streamUrl: result.streamUrl,
            isEmbed: false,
            headers: {
              Referer: result.referer || 'https://vixsrc.to/',
              'User-Agent': USER_AGENT,
            },
          },
          200
        );
      } catch (error) {
        console.error('[Worker] Handler error:', error);
        return jsonResponse(
          { success: false, error: error.message || 'Internal Server Error' },
          500
        );
      }
    }

    return jsonResponse(
      { success: false, error: 'Endpoint not found' },
      404
    );
  },
};