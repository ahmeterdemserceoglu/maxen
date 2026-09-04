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

async function extractStreamFromUrl(targetUrl) {
  try {
    console.log(`[Extraction] Trying to extract from: ${targetUrl}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: targetUrl,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) {
      console.log(`[Extraction] Failed to fetch: ${res.status}`);
      return null;
    }

    const text = await res.text();
    console.log(`[Extraction] Page length: ${text.length}`);

    // Try multiple patterns to find stream URLs
    const patterns = [
      // Direct m3u8/mp4 URLs
      /https?:\/\/[^"'\s\\]+?\.(?:m3u8|mp4)(?:\?[^"'\s\\]*)?/gi,
      // URLs in quotes
      /["']((https?:\/\/[^"'\s\\]+?\.(?:m3u8|mp4)(?:\?[^"'\s\\]*)?))["']/gi,
      // JSON-like patterns
      /url["']?\s*:\s*["']([^"']+)["']/gi,
      /src["']?\s*:\s*["']([^"']+)["']/gi,
      /file["']?\s*:\s*["']([^"']+)["']/gi,
      /source["']?\s*:\s*["']([^"']+)["']/gi,
      /data["']?\s*:\s*["']([^"']+)["']/gi,
      // Common streaming patterns
      /https?:\/\/[^\s"']+\.(?:m3u8|mp4)[^\s"']*/gi,
      // Iframe src patterns (for nested iframes)
      /iframe[^>]+src=["']([^"']+)["']/gi,
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        console.log(`[Extraction] Pattern matched: ${pattern.toString()}, found ${matches.length} matches`);
        for (const match of matches) {
          let url = match;
          // Extract URL from pattern groups if needed
          const urlMatch = match.match(/https?:\/\/[^\s"']+/i);
          if (urlMatch) {
            url = urlMatch[0];
          }
          url = url.replace(/\\/g, '').replace(/['"]/g, '');

          // Only return if it's a video file
          if (url.includes('.m3u8') || url.includes('.mp4')) {
            console.log(`[Extraction] Found stream URL: ${url}`);
            return {
              streamUrl: url,
              referer: targetUrl,
            };
          }
        }
      }
    }

    console.log('[Extraction] No stream URL found in any pattern');
  } catch (e) {
    console.log('[Extraction] Error:', e);
  }
  return null;
}

async function resolveStream(tmdbId, type, season, episode) {
  // Try VixSrc first
  const vixResult = await getVixSrcUrl(tmdbId, type, season, episode);
  if (vixResult && !vixResult.isEmbed) {
    return {
      provider: vixResult.provider,
      streamUrl: vixResult.streamUrl,
      referer: 'https://vixsrc.to/',
      isEmbed: false,
    };
  }

  // Try to extract direct stream from VidSrc.in
  const vidSrcInUrl =
    type === 'tv'
      ? `https://vidsrc.in/embed/tv/${tmdbId}/${season}/${episode}`
      : `https://vidsrc.in/embed/movie/${tmdbId}`;

  const vidSrcResult = await extractStreamFromUrl(vidSrcInUrl);
  if (vidSrcResult) {
    return {
      provider: 'VidSrc.in',
      streamUrl: vidSrcResult.streamUrl,
      referer: vidSrcResult.referer || 'https://vidsrc.in/',
      isEmbed: false,
    };
  }

  // Try VidLink
  const vidLinkUrl =
    type === 'tv'
      ? `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}?primaryColor=e50914&autoplay=true`
      : `https://vidlink.pro/movie/${tmdbId}?primaryColor=e50914&autoplay=true`;

  const vidLinkResult = await extractStreamFromUrl(vidLinkUrl);
  if (vidLinkResult) {
    return {
      provider: 'VidLink',
      streamUrl: vidLinkResult.streamUrl,
      referer: vidLinkResult.referer || 'https://vidlink.pro/',
      isEmbed: false,
    };
  }

  // Try 2Embed
  const twoEmbedUrl =
    type === 'tv'
      ? `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`
      : `https://www.2embed.cc/embed/${tmdbId}`;

  const twoEmbedResult = await extractStreamFromUrl(twoEmbedUrl);
  if (twoEmbedResult) {
    return {
      provider: '2Embed',
      streamUrl: twoEmbedResult.streamUrl,
      referer: twoEmbedResult.referer || 'https://www.2embed.cc/',
      isEmbed: false,
    };
  }

  // Final fallback - return embed URL (should not happen with native player)
  return {
    provider: 'VidSrc.in',
    streamUrl: vidSrcInUrl,
    referer: 'https://vidsrc.in/',
    isEmbed: true,
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS request
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (url.pathname === '/api/stream' && request.method === 'GET') {
      const tmdbId = url.searchParams.get('tmdbId');
      const type = url.searchParams.get('type') || 'movie';
      const season = parseInt(url.searchParams.get('season') || '1', 10);
      const episode = parseInt(url.searchParams.get('episode') || '1', 10);

      if (!tmdbId) {
        return new Response(
          JSON.stringify({ error: 'tmdbId parameter is required' }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      console.log(
        `[Server] Stream request: tmdbId=${tmdbId}, type=${type}, S${season}E${episode}`
      );

      const result = await resolveStream(tmdbId, type, season, episode);

      console.log(
        `[Server SUCCESS] Provider: ${result.provider} | Stream: ${result.streamUrl}`
      );

      return new Response(
        JSON.stringify({
          success: true,
          provider: result.provider,
          streamUrl: result.streamUrl,
          isEmbed: result.isEmbed,
          headers: {
            Referer: result.referer,
            'User-Agent': USER_AGENT,
          },
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  },
};