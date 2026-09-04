const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

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
    console.log(`[extractVixSrcStream] embed status: ${res.status} for ${embedUrl}`);
    if (!res.ok) return null;
    const html = await res.text();
    console.log(`[extractVixSrcStream] html length: ${html.length}`);

    // 1. Try masterPlaylist block first
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
        const q = [];
        if (token) q.push(`token=${token}`);
        if (expires) q.push(`expires=${expires}`);
        q.push('h=1');
        if (lang) q.push(`lang=${encodeURIComponent(lang)}`);
        const sep = cleanBase.includes('?') ? '&' : '?';
        return `${cleanBase}${sep}${q.join('&')}#master.m3u8`;
      }
    }

    // 2. Fallback: general regex search
    const urlM = html.match(/url:\s*['"]([^'"]+)['"]/);
    const tokenM = html.match(/['"]token['"]:\s*['"]([^'"]+)['"]/);
    const expM = html.match(/['"]expires['"]:\s*['"]([^'"]+)['"]/);
    if (urlM && urlM[1]) {
      const cleanBase = urlM[1].replace(/\\/g, '');
      const token = tokenM ? tokenM[1] : '';
      const expires = expM ? expM[1] : '';
      const q = [];
      if (token) q.push(`token=${token}`);
      if (expires) q.push(`expires=${expires}`);
      q.push('h=1');
      if (lang) q.push(`lang=${encodeURIComponent(lang)}`);
      const sep = cleanBase.includes('?') ? '&' : '?';
      return `${cleanBase}${sep}${q.join('&')}#master.m3u8`;
    }

    const streamsM = html.match(/window\.streams\s*=\s*(\[[\s\S]*?\]);/);
    if (streamsM) {
      const matchUrl = streamsM[1].match(/https?:\\?\/\\?[^"' ]+/);
      if (matchUrl) {
        return matchUrl[0].replace(/\\/g, '') + '#.m3u8';
      }
    }
  } catch (e) {}
  return null;
}

async function getVixSrcUrl(id, type, s, e, lang = '') {
  try {
    const query = lang ? `?lang=${encodeURIComponent(lang)}` : '';
    const apiUrl =
      type === 'tv'
        ? `https://vixsrc.to/api/tv/${id}/${s}/${e}${query}`
        : `https://vixsrc.to/api/movie/${id}${query}`;

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

    console.log(`[getVixSrcUrl] status: ${res.status} for ${apiUrl}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`[getVixSrcUrl] data.src: ${data?.src}`);
      if (data?.src) {
        const embedUrl = `https://vixsrc.to${data.src}`;
        const directHls = await extractVixSrcStream(embedUrl, lang);
        console.log(`[getVixSrcUrl] directHls: ${directHls}`);
        if (directHls) {
          return {
            streamUrl: directHls,
            isEmbed: false,
            provider: 'VixSrc Direct',
          };
        }
        return {
          streamUrl: embedUrl,
          isEmbed: true,
          provider: 'VixSrc',
        };
      }
    } else {
      const body = await res.text().catch(() => '');
      console.log(`[getVixSrcUrl] error body (first 200 chars): ${body.substring(0, 200)}`);
    }
  } catch (err) {
    console.error(`[getVixSrcUrl] error:`, err);
  }
  return null;
}

async function extractDirectStream(targetUrl, referer, providerName, timeoutMs = 8000) {
  try {
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
  } catch (e) {}
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
  // 1. Try VixSrc Direct HLS extraction (with preferred/detected audio language)
  const vixResult = await getVixSrcUrl(tmdbId, type, season, episode, lang);
  if (vixResult && vixResult.streamUrl) {
    return {
      provider: vixResult.provider,
      streamUrl: vixResult.streamUrl,
      referer: 'https://vixsrc.to/',
      isEmbed: vixResult.isEmbed,
    };
  }

  // 2. Try SuperEmbed Direct extraction probe
  const superEmbedResult = await getSuperEmbedStream(tmdbId, type, season, episode);
  if (superEmbedResult && superEmbedResult.streamUrl) {
    return {
      provider: superEmbedResult.provider,
      streamUrl: superEmbedResult.streamUrl,
      referer: superEmbedResult.referer || 'https://multiembed.mov/',
      isEmbed: superEmbedResult.isEmbed,
    };
  }

  // 3. Try SmashyStream Direct extraction probe
  const smashyResult = await getSmashyStream(tmdbId, type, season, episode);
  if (smashyResult && smashyResult.streamUrl) {
    return {
      provider: smashyResult.provider,
      streamUrl: smashyResult.streamUrl,
      referer: smashyResult.referer || 'https://embed.smashystream.com/',
      isEmbed: smashyResult.isEmbed,
    };
  }

  // 4. Fallback to VidSrc.in
  const vidSrcInUrl =
    type === 'tv'
      ? `https://vidsrc.in/embed/tv/${tmdbId}/${season}/${episode}`
      : `https://vidsrc.in/embed/movie/${tmdbId}`;

  return {
    provider: 'VidSrc.in',
    streamUrl: vidSrcInUrl,
    referer: 'https://vidsrc.in/',
    isEmbed: true,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const rawTmdbId = req.query?.tmdbId;
  const rawType = req.query?.type || 'movie';
  const rawSeason = req.query?.season || '1';
  const rawEpisode = req.query?.episode || '1';
  const rawLang = req.query?.lang || '';

  if (!rawTmdbId || typeof rawTmdbId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(rawTmdbId.trim())) {
    return res.status(400).json({ success: false, error: 'Valid tmdbId parameter is required' });
  }
  const tmdbId = rawTmdbId.trim();

  const type = String(rawType).toLowerCase().trim();
  if (type !== 'movie' && type !== 'tv') {
    return res.status(400).json({ success: false, error: "Invalid type parameter: must be 'movie' or 'tv'" });
  }

  const season = parseInt(String(rawSeason), 10);
  if (Number.isNaN(season) || season < 1) {
    return res.status(400).json({ success: false, error: 'Invalid season parameter: must be a positive integer (>= 1)' });
  }

  const episode = parseInt(String(rawEpisode), 10);
  if (Number.isNaN(episode) || episode < 1) {
    return res.status(400).json({ success: false, error: 'Invalid episode parameter: must be a positive integer (>= 1)' });
  }

  const lang = typeof rawLang === 'string' ? rawLang.trim().toLowerCase() : '';

  try {
    const result = await resolveStream(tmdbId, type, season, episode, lang);
    if (!result || !result.streamUrl) {
      return res.status(404).json({ success: false, error: 'No stream available' });
    }

    return res.status(200).json({
      success: true,
      provider: result.provider,
      streamUrl: result.streamUrl,
      isEmbed: result.isEmbed || false,
      headers: {
        Referer: result.referer || 'https://vixsrc.to/',
        'User-Agent': USER_AGENT,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}

