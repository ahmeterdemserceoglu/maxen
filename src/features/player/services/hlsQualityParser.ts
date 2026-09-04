/**
 * HLS Quality & Variant Stream Parser
 * Parses master .m3u8 manifests to extract real resolution variant URLs
 */

export interface HlsQualityVariant {
  id: string; // '1080p' | '720p' | '480p' | '360p' | string
  label: string;
  badge: string;
  resolution: string; // e.g. '1920x1080'
  bandwidth: number;
  url: string;
}

export interface ParsedHlsManifest {
  isMaster: boolean;
  masterUrl: string;
  variants: HlsQualityVariant[];
  qualityMap: Record<string, string>; // { '1080p': 'https://...', '720p': 'https://...' }
}

/**
 * Parses raw .m3u8 playlist text to find all #EXT-X-STREAM-INF variants
 */
export function parseHlsManifest(manifestText: string, masterUrl: string): ParsedHlsManifest {
  const lines = manifestText.split(/\r?\n/);
  const variants: HlsQualityVariant[] = [];
  const qualityMap: Record<string, string> = {};

  let currentBandwidth = 0;
  let currentResolution = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      // Parse BANDWIDTH
      const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
      currentBandwidth = bwMatch ? parseInt(bwMatch[1], 10) : 0;

      // Parse RESOLUTION
      const resMatch = line.match(/RESOLUTION=(\d+x\d+)/i);
      currentResolution = resMatch ? resMatch[1] : '';
    } else if (line.length > 0 && !line.startsWith('#') && (currentResolution || currentBandwidth > 0)) {
      // This is the URI for the previous stream-inf
      let variantUrl = line;
      if (!variantUrl.startsWith('http://') && !variantUrl.startsWith('https://')) {
        try {
          variantUrl = new URL(variantUrl, masterUrl).href;
        } catch {
          const lastSlash = masterUrl.lastIndexOf('/');
          const baseUrl = lastSlash !== -1 ? masterUrl.substring(0, lastSlash + 1) : masterUrl + '/';
          variantUrl = baseUrl + variantUrl;
        }
      }

      const heightMatch = currentResolution.match(/x(\d+)/i);
      const height = heightMatch ? parseInt(heightMatch[1], 10) : 0;

      let qualityId = 'auto';
      let label = 'Otomatik';
      let badge = 'ABR';

      if (height >= 1000) {
        qualityId = '1080p';
        label = '1080p Full HD';
        badge = 'FHD';
      } else if (height >= 700) {
        qualityId = '720p';
        label = '720p HD';
        badge = 'HD';
      } else if (height >= 450) {
        qualityId = '480p';
        label = '480p SD';
        badge = 'SD';
      } else if (height >= 300) {
        qualityId = '360p';
        label = '360p Düşük';
        badge = 'ECO';
      } else if (currentBandwidth >= 4000000) {
        qualityId = '1080p';
        label = '1080p Full HD';
        badge = 'FHD';
      } else if (currentBandwidth >= 2000000) {
        qualityId = '720p';
        label = '720p HD';
        badge = 'HD';
      } else if (currentBandwidth >= 1000000) {
        qualityId = '480p';
        label = '480p SD';
        badge = 'SD';
      } else {
        qualityId = '360p';
        label = '360p Düşük';
        badge = 'ECO';
      }

      // Avoid duplicates
      if (!qualityMap[qualityId]) {
        qualityMap[qualityId] = variantUrl;
        variants.push({
          id: qualityId,
          label,
          badge,
          resolution: currentResolution || `${height}p`,
          bandwidth: currentBandwidth,
          url: variantUrl,
        });
      }

      currentBandwidth = 0;
      currentResolution = '';
    }
  }

  return {
    isMaster: variants.length > 0,
    masterUrl,
    variants,
    qualityMap,
  };
}

/**
 * Fetches and parses an HLS master playlist URL
 */
export async function fetchAndParseHlsQualities(
  masterUrl: string,
  headers: Record<string, string> = {}
): Promise<ParsedHlsManifest | null> {
  if (!masterUrl.includes('.m3u8') && !masterUrl.includes('/playlist/')) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(masterUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        ...headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return null;
    const text = await res.text();
    return parseHlsManifest(text, masterUrl);
  } catch (e) {
    console.warn('Error fetching HLS manifest for qualities:', e);
    return null;
  }
}
