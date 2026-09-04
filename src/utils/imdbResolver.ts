export async function resolveIMDbStream(imdbId: string): Promise<string | null> {
  try {
    const response = await fetch(`https://www.imdb.com/video/embed/${imdbId}/?autoplay=true`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Referer': 'https://www.imdb.com/',
      }
    });

    if (!response.ok) {
      console.warn(`[IMDb Resolver] HTTP Error: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
    
    if (!nextDataMatch) {
      console.warn(`[IMDb Resolver] __NEXT_DATA__ not found in HTML`);
      return null;
    }

    const nextData = JSON.parse(nextDataMatch[1]);
    
    let foundUrls: any[] | null = null;
    
    // Recursively search for playbackURLs in the JSON
    function findPlayback(obj: any) {
      if (!obj || typeof obj !== 'object') return;
      if (obj.playbackURLs) {
        foundUrls = obj.playbackURLs;
        return;
      }
      Object.values(obj).forEach(findPlayback);
    }
    
    findPlayback(nextData);

    if (foundUrls && Array.isArray(foundUrls)) {
      const urls = foundUrls as any[];
      // Prioritize 1080p, then 720p, then AUTO, then anything MP4
      const p1080 = urls.find(u => u.videoDefinition === 'DEF_1080p' && u.videoMimeType === 'MP4');
      const p720 = urls.find(u => u.videoDefinition === 'DEF_720p' && u.videoMimeType === 'MP4');
      const auto = urls.find(u => u.videoDefinition === 'DEF_AUTO' && u.videoMimeType === 'M3U8');
      const fallback = urls.find(u => u.videoMimeType === 'MP4');

      const bestUrl = (p1080 || p720 || auto || fallback || urls[0])?.url;
      
      if (bestUrl) {
        console.log(`[IMDb Resolver] Successfully resolved stream for ${imdbId}`);
        return bestUrl;
      }
    }
    
    console.warn(`[IMDb Resolver] No valid playback URLs found for ${imdbId}`);
    return null;
  } catch (error) {
    console.error(`[IMDb Resolver] Error parsing stream for ${imdbId}:`, error);
    return null;
  }
}
