import { parseHlsManifest } from '../src/features/player/services/hlsQualityParser';

describe('HLS Quality Manifest Parser Unit Tests', () => {
  const sampleMasterManifest = `
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=6000000,RESOLUTION=1920x1080,CODECS="avc1.640028,mp4a.40.2"
1080p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720,CODECS="avc1.64001f,mp4a.40.2"
720p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480,CODECS="avc1.4d401f,mp4a.40.2"
480p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,CODECS="avc1.4d401e,mp4a.40.2"
360p/index.m3u8
`;

  it('should parse master playlist and extract variants correctly', () => {
    const masterUrl = 'https://stream.example.com/hls/master.m3u8';
    const parsed = parseHlsManifest(sampleMasterManifest, masterUrl);

    expect(parsed.isMaster).toBe(true);
    expect(parsed.variants.length).toBe(4);
    expect(parsed.qualityMap['1080p']).toBe('https://stream.example.com/hls/1080p/index.m3u8');
    expect(parsed.qualityMap['720p']).toBe('https://stream.example.com/hls/720p/index.m3u8');
    expect(parsed.qualityMap['480p']).toBe('https://stream.example.com/hls/480p/index.m3u8');
    expect(parsed.qualityMap['360p']).toBe('https://stream.example.com/hls/360p/index.m3u8');
  });

  it('should handle non-master playlists (single stream)', () => {
    const mediaManifest = `
#EXTM3U
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
segment0.ts
#EXTINF:10.0,
segment1.ts
#EXT-X-ENDLIST
`;
    const masterUrl = 'https://stream.example.com/hls/stream.m3u8';
    const parsed = parseHlsManifest(mediaManifest, masterUrl);

    expect(parsed.isMaster).toBe(false);
    expect(parsed.variants.length).toBe(0);
    expect(Object.keys(parsed.qualityMap).length).toBe(0);
  });
});
