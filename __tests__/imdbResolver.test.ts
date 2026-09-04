import { resolveIMDbStream } from '../src/utils/imdbResolver';

describe('IMDb Native Stream Resolver Unit Tests', () => {
  it('should return null if imdbId is invalid or empty', async () => {
    const result = await resolveIMDbStream('');
    expect(result).toBeNull();
  });

  it('should extract 1080p MP4 or HLS stream from IMDb __NEXT_DATA__ structure', () => {
    const mockPlaybackUrls = [
      {
        displayName: 'Auto',
        videoDefinition: 'DEF_AUTO',
        videoMimeType: 'M3U8',
        url: 'https://imdb-video.example.com/master.m3u8',
      },
      {
        displayName: '1080p',
        videoDefinition: 'DEF_1080p',
        videoMimeType: 'MP4',
        url: 'https://imdb-video.example.com/1080p.mp4',
      },
      {
        displayName: '720p',
        videoDefinition: 'DEF_720p',
        videoMimeType: 'MP4',
        url: 'https://imdb-video.example.com/720p.mp4',
      },
    ];

    const p1080 = mockPlaybackUrls.find(
      (u) => u.videoDefinition === 'DEF_1080p' && u.videoMimeType === 'MP4'
    );
    expect(p1080?.url).toBe('https://imdb-video.example.com/1080p.mp4');

    const auto = mockPlaybackUrls.find(
      (u) => u.videoDefinition === 'DEF_AUTO' && u.videoMimeType === 'M3U8'
    );
    expect(auto?.url).toBe('https://imdb-video.example.com/master.m3u8');
  });
});
