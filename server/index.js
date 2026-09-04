const http = require('http');

const PORT = 3000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function extractVixSrcStream(embedUrl) {
  try {
    const res = await fetch(embedUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: 'https://vixsrc.to/',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // 1. Try masterPlaylist extraction
    const urlM = html.match(/url:\s*['"]([^'"]+)['"]/);
    const tokenM = html.match(/['"]token['"]:\s*['"]([^'"]+)['"]/);
    const expM = html.match(/['"]expires['"]:\s*['"]([^'"]+)['"]/);
    if (urlM) {
      const token = tokenM ? tokenM[1] : '';
      const expires = expM ? expM[1] : '';
      const streamUrl = `${urlM[1]}.m3u8?token=${token}&expires=${expires}&h=1&lang=en`;
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
  } catch (e) {}
  return null;
}

async function getVixSrcUrl(id, type, s, e) {
  try {
    const apiUrl =
      type === 'tv'
        ? `https://vixsrc.to/api/tv/${id}/${s}/${e}`
        : `https://vixsrc.to/api/movie/${id}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: 'https://vixsrc.to/',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data?.src) {
        const embedUrl = `https://vixsrc.to${data.src}`;
        const directHls = await extractVixSrcStream(embedUrl);
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
    }
  } catch (err) {}
  return null;
}

const SOURCES = [
  {
    name: 'VixSrc',
    resolve: getVixSrcUrl,
  },
  {
    name: 'VidSrc.in',
    resolve: async (id, type, s, e) =>
      type === 'tv'
        ? `https://vidsrc.in/embed/tv/${id}/${s}/${e}`
        : `https://vidsrc.in/embed/movie/${id}`,
  },
  {
    name: 'VidLink',
    resolve: async (id, type, s, e) =>
      type === 'tv'
        ? `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=e50914&autoplay=true`
        : `https://vidlink.pro/movie/${id}?primaryColor=e50914&autoplay=true`,
  },
  {
    name: '2Embed',
    resolve: async (id, type, s, e) =>
      type === 'tv'
        ? `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`
        : `https://www.2embed.cc/embed/${id}`,
  },
];

async function extractStreamFromUrl(targetUrl) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: targetUrl,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) return null;

    const text = await res.text();
    const matches = text.match(
      /https?:\/\/[^"'\s\\]+?\.(?:m3u8|mp4)(?:\?[^"'\s\\]*)?/gi
    );
    if (matches && matches.length > 0) {
      return {
        streamUrl: matches[0].replace(/\\/g, ''),
        referer: targetUrl,
      };
    }
  } catch (e) {}
  return null;
}

async function resolveStream(tmdbId, type, season, episode) {
  // Try VixSrc first
  const vixResult = await getVixSrcUrl(tmdbId, type, season, episode);
  if (vixResult) {
    return {
      provider: vixResult.provider,
      streamUrl: vixResult.streamUrl,
      referer: 'https://vixsrc.to/',
      isEmbed: vixResult.isEmbed,
    };
  }

  // Fallback to VidSrc.in
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

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host}`);

  if (reqUrl.pathname === '/api/stream') {
    const tmdbId = reqUrl.searchParams.get('tmdbId');
    const type = reqUrl.searchParams.get('type') || 'movie';
    const season = parseInt(reqUrl.searchParams.get('season') || '1', 10);
    const episode = parseInt(reqUrl.searchParams.get('episode') || '1', 10);

    if (!tmdbId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'tmdbId parameter is required' }));
      return;
    }

    console.log(
      `[Server] Stream request: tmdbId=${tmdbId}, type=${type}, S${season}E${episode}`
    );

    const result = await resolveStream(tmdbId, type, season, episode);

    console.log(
      `[Server SUCCESS] Provider: ${result.provider} | Stream: ${result.streamUrl}`
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        provider: result.provider,
        streamUrl: result.streamUrl,
        isEmbed: result.isEmbed,
        headers: {
          Referer: result.referer,
          'User-Agent': USER_AGENT,
        },
      })
    );
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Maxen Stream Server] Running on http://0.0.0.0:${PORT}`);
});
