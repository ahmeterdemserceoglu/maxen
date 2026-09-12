export interface HlsTrackHeaders {
  [key: string]: string;
}

export interface HlsAudioTrack {
  id: string;
  label: string;
  language: string;
  url?: string;
  groupId?: string;
  headers?: HlsTrackHeaders;
  isFullStream: false;
}

export interface HlsSubtitleTrack {
  label: string;
  lang: string;
  url: string;
  headers?: HlsTrackHeaders;
}

function parseAttributeList(line: string): Record<string, string> {
  const colonIndex = line.indexOf(':');
  const input = colonIndex >= 0 ? line.slice(colonIndex + 1) : line;
  const attributes: Record<string, string> = {};
  const regex = /([A-Z0-9-]+)=((?:"[^"]*")|[^,]*)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    const key = match[1].toUpperCase();
    const value = match[2].trim().replace(/^"|"$/g, '');
    attributes[key] = value;
  }

  return attributes;
}

export function resolveHlsUri(uri: string, baseUrl: string): string {
  if (!uri) return '';
  try {
    return new URL(uri, baseUrl).href;
  } catch {
    return uri;
  }
}

export function parseHlsMediaTracks(
  manifest: string,
  masterUrl: string,
  headers: HlsTrackHeaders = {}
): { audioTracks: HlsAudioTrack[]; subtitleTracks: HlsSubtitleTrack[] } {
  const audioTracks: HlsAudioTrack[] = [];
  const subtitleTracks: HlsSubtitleTrack[] = [];

  for (const rawLine of manifest.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('#EXT-X-MEDIA:')) continue;

    const attrs = parseAttributeList(line);
    const type = (attrs.TYPE || '').toUpperCase();
    const language = attrs.LANGUAGE || attrs['ASSOC-LANGUAGE'] || '';
    const label = attrs.NAME || language || (type === 'AUDIO' ? 'Ses' : 'Altyazı');
    const url = attrs.URI ? resolveHlsUri(attrs.URI, masterUrl) : '';

    if (type === 'AUDIO') {
      audioTracks.push({
        id: url || `${attrs['GROUP-ID'] || 'audio'}-${language || label}`,
        label,
        language,
        url: url || undefined,
        groupId: attrs['GROUP-ID'],
        headers,
        isFullStream: false,
      });
    } else if (type === 'SUBTITLES' && url) {
      subtitleTracks.push({ label, lang: language, url, headers });
    }
  }

  return { audioTracks, subtitleTracks };
}

export function parseHlsSegmentUrls(manifest: string, playlistUrl: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of manifest.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const url = resolveHlsUri(line, playlistUrl);
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}
