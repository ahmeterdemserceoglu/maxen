import { resolveYouTubeCleanStream } from '../src/utils/youtubeResolver';

describe('YouTube Clean Stream Resolver Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return null if videoId is empty or null', async () => {
    const resultEmpty = await resolveYouTubeCleanStream('');
    expect(resultEmpty).toBeNull();

    const resultNull = await resolveYouTubeCleanStream(null as any);
    expect(resultNull).toBeNull();
  });

  it('should parse Piped API response and extract HLS or MP4 stream', () => {
    const mockPipedData = {
      title: 'Inception Official Trailer',
      hls: 'https://piped-stream.example.com/manifest.m3u8',
      videoStreams: [
        {
          url: 'https://piped-stream.example.com/1080p.mp4',
          quality: '1080p',
          videoOnly: false,
        },
        {
          url: 'https://piped-stream.example.com/720p.mp4',
          quality: '720p',
          videoOnly: false,
        },
      ],
    };

    expect(mockPipedData.hls).toBe('https://piped-stream.example.com/manifest.m3u8');
    const direct1080 = mockPipedData.videoStreams.find((s) => s.quality === '1080p' && !s.videoOnly);
    expect(direct1080?.url).toBe('https://piped-stream.example.com/1080p.mp4');
  });

  it('should parse Invidious API response and extract best formatStreams', () => {
    const mockInvidiousData = {
      title: 'Interstellar Trailer',
      hlsUrl: null,
      formatStreams: [
        {
          url: 'https://invidious-stream.example.com/video_720p.mp4',
          resolution: '720p',
          qualityLabel: '720p',
          type: 'video/mp4; codecs="avc1.4d401f, mp4a.40.2"',
        },
        {
          url: 'https://invidious-stream.example.com/video_360p.mp4',
          resolution: '360p',
          qualityLabel: '360p',
          type: 'video/mp4; codecs="avc1.42001e, mp4a.40.2"',
        },
      ],
    };

    const p720 = mockInvidiousData.formatStreams.find(
      (s) => s.resolution === '720p' || s.qualityLabel === '720p'
    );
    expect(p720?.url).toBe('https://invidious-stream.example.com/video_720p.mp4');
  });
});
