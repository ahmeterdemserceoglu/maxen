const INVIDIOUS_INSTANCES = [
  'https://invidious.privacydev.net',
  'https://yt.drgnz.club',
  'https://vid.puffyan.us',
  'https://invidious.nerdvpn.de',
  'https://inv.nadeko.net',
];

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.privacydev.net',
  'https://pipedapi.tokhmi.xyz',
];

export async function resolveYouTubeCleanStream(videoId: string): Promise<string | null> {
  if (!videoId) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  // 1. Try Piped API Instances in parallel
  const pipedPromises = PIPED_INSTANCES.map(async (baseUrl) => {
    try {
      const res = await fetch(`${baseUrl}/streams/${videoId}`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return null;
      const data = await res.json();

      // Check HLS first
      if (data.hls) return data.hls as string;

      // Check videoStreams with audio (prefer 1080p, 720p, 480p)
      if (Array.isArray(data.videoStreams)) {
        const streamWithAudio = data.videoStreams.find(
          (s: any) => !s.videoOnly && s.url && (s.quality === '1080p' || s.quality === '720p' || s.quality === '480p')
        );
        if (streamWithAudio?.url) return streamWithAudio.url as string;
      }
      return null;
    } catch {
      return null;
    }
  });

  // 2. Try Invidious API Instances in parallel
  const invidiousPromises = INVIDIOUS_INSTANCES.map(async (baseUrl) => {
    try {
      const res = await fetch(`${baseUrl}/api/v1/videos/${videoId}?fields=formatStreams,hlsUrl`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return null;
      const data = await res.json();

      if (data.hlsUrl) return data.hlsUrl as string;

      if (Array.isArray(data.formatStreams)) {
        const p720 = data.formatStreams.find((s: any) => s.resolution === '720p' || s.qualityLabel === '720p');
        const p1080 = data.formatStreams.find((s: any) => s.resolution === '1080p' || s.qualityLabel === '1080p');
        const anyMp4 = data.formatStreams.find((s: any) => s.type?.includes('mp4') || s.url?.includes('.mp4'));
        const best = p1080 || p720 || anyMp4 || data.formatStreams[0];
        if (best?.url) return best.url as string;
      }
      return null;
    } catch {
      return null;
    }
  });

  try {
    // Race to find the first valid direct clean stream
    const allProbes = [...pipedPromises, ...invidiousPromises];
    const results = await Promise.allSettled(allProbes);
    clearTimeout(timeoutId);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        return result.value;
      }
    }
    return null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}
