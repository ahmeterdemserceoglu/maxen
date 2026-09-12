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

function extractBolumId(html) {
  if (!html) return null;
  const match = html.match(/data-id=[\"'](\d+)[\"']/);
  return match ? match[1] : null;
}

function parseAlternatif(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.data)) {
      return parsed.data;
    }
  } catch {}
  return [];
}

function extractVidmolyM3u8(html) {
  if (!html) return null;
  const normalized = html.replace(/\\\//g, '/');
  const fileMatch = normalized.match(/(?:file|src)\s*[:=]\s*['\"]([^'\"]+\.m3u8[^'\"]*)['\"]/i);
  if (fileMatch) return fileMatch[1];
  const directMatch = normalized.match(/https?:\/\/[^'"\s<>]+\.m3u8[^'"\s<>]*/i);
  return directMatch ? directMatch[0] : null;
}

function hasTurkishDubMarker(html) {
  return /data-dil\s*=\s*["']0["']/i.test(html || '') && /dublaj/i.test(html || '');
}

async function resolveSezonlukDiziSeries(imdbId, season, episode, timeoutMs = 8000) {
  try {
    const defaultHeaders = {
      'User-Agent': USER_AGENT,
      Referer: 'https://sezonlukdizi.cc/',
      'X-Requested-With': 'XMLHttpRequest',
    };

    // 1. Search series by IMDb ID
    const searchRes = await fetchWithTimeout(
      'https://sezonlukdizi.cc/ajax/arama.asp',
      {
        method: 'POST',
        headers: {
          ...defaultHeaders,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `q=${encodeURIComponent(imdbId)}`,
      },
      timeoutMs
    );

    if (!searchRes.ok) return null;
    const searchData = await searchRes.json().catch(() => null);
    const seriesList = searchData?.results?.diziler?.results;
    if (!Array.isArray(seriesList) || seriesList.length === 0) return null;

    const seriesUrl = seriesList[0]?.url;
    if (!seriesUrl) return null;

    const slugMatch = seriesUrl.match(/\/diziler\/([a-zA-Z0-9_-]+)\.html/);
    const slug = slugMatch ? slugMatch[1] : seriesUrl.replace(/^\/diziler\/|\.html$/g, '');
    if (!slug) return null;

    // 2. Fetch Dublaj episode page
    const episodePageUrl = `https://sezonlukdizi.cc/${slug}/dublaj/${season}-sezon-${episode}-bolum.html`;
    const epPageRes = await fetchWithTimeout(
      episodePageUrl,
      { headers: { 'User-Agent': USER_AGENT, Referer: 'https://sezonlukdizi.cc/' } },
      timeoutMs
    );

    if (!epPageRes.ok || !epPageRes.url.includes('/dublaj/')) return null;
    const epHtml = await epPageRes.text();
    if (!hasTurkishDubMarker(epHtml)) return null;
    const bolumId = extractBolumId(epHtml);
    if (!bolumId) return null;

    // 3. Fetch alternatives for dil=0 (Dublaj)
    const altRes = await fetchWithTimeout(
      'https://sezonlukdizi.cc/ajax/dataAlternatif22.asp',
      {
        method: 'POST',
        headers: {
          ...defaultHeaders,
          Referer: episodePageUrl,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `bid=${bolumId}&dil=0`,
      },
      timeoutMs
    );

    if (!altRes.ok) return null;
    const altText = await altRes.text();
    const alternatives = parseAlternatif(altText);
    if (alternatives.length === 0) return null;

    const settled = await Promise.allSettled(alternatives.map(async (targetAlt) => {
      const embedRes = await fetchWithTimeout(
        'https://sezonlukdizi.cc/ajax/dataEmbed22.asp',
        {
          method: 'POST',
          headers: {
            ...defaultHeaders,
            Referer: episodePageUrl,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `id=${targetAlt.id}`,
        },
        timeoutMs
      );
      if (!embedRes.ok) return null;
      const embedHtml = await embedRes.text();
      const iframeSrcMatch = embedHtml.match(/src=[\"']([^\"']+)[\"']/);
      if (!iframeSrcMatch) return null;

      let iframeUrl = iframeSrcMatch[1];
      if (iframeUrl.startsWith('//')) iframeUrl = `https:${iframeUrl}`;
      if (!iframeUrl.startsWith('http')) iframeUrl = `https://sezonlukdizi.cc${iframeUrl}`;

      const providerRes = await fetchWithTimeout(iframeUrl, {
        headers: { 'User-Agent': USER_AGENT, Referer: episodePageUrl },
      }, timeoutMs);
      if (!providerRes.ok) return null;
      const m3u8Url = extractVidmolyM3u8(await providerRes.text());
      if (!m3u8Url) return null;

      let origin = 'https://sezonlukdizi.cc';
      try { origin = new URL(providerRes.url || iframeUrl).origin; } catch {}
      return {
        streamUrl: m3u8Url,
        provider: `Türkçe Dublaj (${targetAlt.baslik || 'Kaynak'})`,
        headers: { Referer: `${origin}/`, Origin: origin, 'User-Agent': USER_AGENT },
        isDubbed: true,
        language: 'tr',
        label: 'Türkçe',
      };
    }));

    const results = settled.flatMap((item) => item.status === 'fulfilled' && item.value ? [item.value] : []);
    return results.filter((item, index) => results.findIndex((candidate) => candidate.streamUrl === item.streamUrl) === index);
  } catch (err) {
    console.error('[api/turkish-dub] error:', err);
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const imdbId = req.query?.imdbId;
  const season = parseInt(req.query?.season || '1', 10);
  const episode = parseInt(req.query?.episode || '1', 10);
  const type = req.query?.type || 'tv';

  if (!imdbId) {
    return res.status(400).json({ success: false, error: 'imdbId is required' });
  }

  if (type === 'tv') {
    const result = await resolveSezonlukDiziSeries(imdbId, season, episode);
    if (result && result.length > 0) {
      return res.status(200).json({ success: true, results: result, ...result[0] });
    }
  }

  return res.status(404).json({ success: false, error: 'Turkish dubbing stream not found' });
}
