export interface OfflineAsset {
  url: string;
  file: string;
  range?: { start: number; length: number };
  key?: boolean;
}

export interface OfflineHlsPlan {
  playlists: Record<string, string>;
  assets: OfflineAsset[];
  entry: string;
}

const attribute = (line: string, name: string) =>
  line.match(new RegExp(`(?:^|[:,])${name}="([^"]*)"`))?.[1];

export function isHlsUrl(url: string): boolean {
  return /\.m3u8(?:$|[?#])|\/playlist\//i.test(url);
}

/** Resolve actual master tags; a segment URI containing '/' is never a playlist. */
export async function buildOfflineHlsPlan(
  url: string,
  read: (url: string) => Promise<{ text: string; url: string }>,
): Promise<OfflineHlsPlan> {
  const plan: OfflineHlsPlan = { playlists: {}, assets: [], entry: 'local_playlist.m3u8' };
  const assetIds = new Map<string, string>();
  const addAsset = (asset: Omit<OfflineAsset, 'file'>, extension: string) => {
    const identity = JSON.stringify(asset);
    let file = assetIds.get(identity);
    if (!file) {
      file = `asset_${plan.assets.length}.${extension}`;
      assetIds.set(identity, file);
      plan.assets.push({ ...asset, file });
    }
    return file;
  };

  async function resolve(address: string, name: string, depth: number): Promise<void> {
    if (depth > 4) throw new Error('HLS oynatma listesi çok fazla iç içe geçmiş.');
    const loaded = await read(address);
    const base = loaded.url;
    const lines = loaded.text.replace(/^\uFEFF/, '').split(/\r?\n/).map(l => l.trim());
    if (lines[0] !== '#EXTM3U') throw new Error('Geçerli bir HLS oynatma listesi alınamadı.');
    if (lines.some(l => l.startsWith('#EXT-X-SESSION-KEY:'))) {
      throw new Error('Bu korumalı HLS kaynağı çevrimdışı indirmeyi desteklemiyor.');
    }
    const variant = lines.findIndex(l => l.startsWith('#EXT-X-STREAM-INF:'));
    if (variant >= 0) {
      const uri = lines.slice(variant + 1).find(l => l && !l.startsWith('#'));
      if (!uri) throw new Error('HLS video akışı bulunamadı.');
      const group = attribute(lines[variant], 'AUDIO');
      const audio = lines.filter(l => l.startsWith('#EXT-X-MEDIA:') && /TYPE=AUDIO(?:,|$)/.test(l)
        && attribute(l, 'GROUP-ID') === group);
      const selected = audio.find(l => /DEFAULT=YES(?:,|$)/.test(l)) || audio[0];
      const prefix = `track_${Object.keys(plan.playlists).length}_${depth}`;
      const videoName = `${prefix}_video.m3u8`;
      let streamTag = lines[variant].replace(/,?CLOSED-CAPTIONS=(?:"[^"]*"|NONE)/g, '');
      const master = ['#EXTM3U', '#EXT-X-VERSION:6'];
      if (selected) {
        const audioUri = attribute(selected, 'URI');
        if (audioUri) {
          const audioName = `${prefix}_audio.m3u8`;
          await resolve(new URL(audioUri, base).toString(), audioName, depth + 1);
          master.push(selected.replace(`URI="${audioUri}"`, `URI="${audioName}"`));
        } else {
          master.push(selected);
        }
      } else {
        streamTag = streamTag.replace(/,?AUDIO="[^"]*"/g, '');
      }
      const subtitleGroup = attribute(lines[variant], 'SUBTITLES');
      const subtitles = lines.filter(l => l.startsWith('#EXT-X-MEDIA:') && /TYPE=SUBTITLES(?:,|$)/.test(l)
        && attribute(l, 'GROUP-ID') === subtitleGroup && attribute(l, 'URI'));
      const subtitle = subtitles.find(l => attribute(l, 'LANGUAGE') === 'tr')
        || subtitles.find(l => /DEFAULT=YES(?:,|$)/.test(l)) || subtitles[0];
      if (subtitle) {
        const raw = attribute(subtitle, 'URI')!;
        const subtitleName = `${prefix}_subtitles.m3u8`;
        await resolve(new URL(raw, base).toString(), subtitleName, depth + 1);
        master.push(subtitle.replace(`URI="${raw}"`, `URI="${subtitleName}"`));
      } else {
        streamTag = streamTag.replace(/,?SUBTITLES="[^"]*"/g, '');
      }
      await resolve(new URL(uri, base).toString(), videoName, depth + 1);
      master.push(streamTag, videoName);
      plan.playlists[name] = master.join('\n');
      return;
    }
    if (!lines.includes('#EXT-X-ENDLIST')) {
      throw new Error('Canlı veya tamamlanmamış yayın çevrimdışı indirilemez.');
    }
    let pendingRange: string | undefined;
    let previousRange: { url: string; end: number } | undefined;
    const local: string[] = [];
    const parseRange = (value: string, uri: string) => {
      const match = /^(\d+)(?:@(\d+))?$/.exec(value);
      if (!match || Number(match[1]) <= 0) throw new Error('HLS parça aralığı geçersiz.');
      const start = match[2] === undefined ? (previousRange?.url === uri ? previousRange.end : NaN) : Number(match[2]);
      if (!Number.isFinite(start)) throw new Error('HLS parça başlangıcı bulunamadı.');
      const range = { start, length: Number(match[1]) };
      previousRange = { url: uri, end: start + range.length };
      return range;
    };
    let segments = 0;
    for (const line of lines) {
      if (line.startsWith('#EXT-X-BYTERANGE:')) {
        pendingRange = line.slice('#EXT-X-BYTERANGE:'.length);
        continue;
      }
      if (line.startsWith('#EXT-X-KEY:') || line.startsWith('#EXT-X-MAP:')) {
        const raw = attribute(line, 'URI');
        if (line.startsWith('#EXT-X-KEY:') && !/METHOD=(NONE|AES-128)(?:,|$)/.test(line)) {
          throw new Error('Bu şifreleme yöntemi çevrimdışı indirmeyi desteklemiyor.');
        }
        if (raw) {
          const key = line.startsWith('#EXT-X-KEY:');
          const assetUrl = new URL(raw, base).toString();
          const rangeText = attribute(line, 'BYTERANGE');
          const range = rangeText ? parseRange(rangeText, assetUrl) : undefined;
          const file = addAsset({ url: assetUrl, range, key }, key ? 'key' : 'mp4');
          local.push(line.replace(`URI="${raw}"`, `URI="${file}"`).replace(/,?BYTERANGE="[^"]*"/g, ''));
          continue;
        }
      }
      if (line && !line.startsWith('#')) {
        const assetUrl = new URL(line, base).toString();
        const range = pendingRange ? parseRange(pendingRange, assetUrl) : undefined;
        pendingRange = undefined;
        const extension = /\.(m4s|mp4|aac|vtt)(?:[?#]|$)/i.exec(assetUrl)?.[1]?.toLowerCase() || 'ts';
        local.push(addAsset({ url: assetUrl, range }, extension));
        segments++;
      } else {
        local.push(line);
      }
    }
    if (!segments || pendingRange) throw new Error('HLS video parçaları eksik.');
    plan.playlists[name] = local.join('\n');
  }
  await resolve(url, plan.entry, 0);
  return plan;
}
