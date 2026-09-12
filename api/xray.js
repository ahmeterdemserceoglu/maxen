export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const url = new URL(req.url, http://);
    const tmdbId = url.searchParams.get('tmdbId');
    const type = url.searchParams.get('type') || 'movie';
    const season = url.searchParams.get('season');
    const episode = url.searchParams.get('episode');

    if (!tmdbId) {
      return res.status(400).json({ error: 'Missing tmdbId query parameter.' });
    }

    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    if (!TMDB_API_KEY) {
      return res.status(200).json({ hasXRay: false, scenes: [] });
    }

    // 1. TMDB'den External IDs ve Credits çek
    const extUrl = https://api.themoviedb.org/3///external_ids?api_key=;
    const extRes = await fetch(extUrl);
    let imdbId = null;
    if (extRes.ok) {
      const extData = await extRes.json();
      imdbId = extData.imdb_id;
    }

    // Oyuncu kadrosu (credits)
    let creditsUrl = https://api.themoviedb.org/3///credits?api_key=&language=tr-TR;
    if (type === 'tv' && season && episode) {
      creditsUrl = https://api.themoviedb.org/3/tv//season//episode//credits?api_key=&language=tr-TR;
    }
    const creditsRes = await fetch(creditsUrl);
    let allCast = [];
    if (creditsRes.ok) {
      const credData = await creditsRes.json();
      allCast = (credData.cast || []).map((c) => ({
        id: c.id,
        name: c.name,
        character: c.character || '',
        profile_path: c.profile_path,
      }));
    }

    if (!imdbId) {
      return res.status(200).json({ hasXRay: false, scenes: [] });
    }

    // 2. What-Song / Açık Soundtrack veritabanı sorgusu
    let songsData = [];
    try {
      const whatSongUrl = type === 'tv' && season && episode
        ? https://api.what-song.com/v2/shows//episodes//
        : https://api.what-song.com/v2/movies/;
      
      const wsRes = await fetch(whatSongUrl, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(4000),
      });

      if (wsRes.ok) {
        const wsJson = await wsRes.json();
        songsData = wsJson.data?.songs || wsJson.songs || [];
      }
    } catch (e) {
      // API yanıt vermezse sessiz devam et
    }

    // Eğer şarkı / sahne verisi bulunamadıysa X-Ray'i tamamen devre dışı bırak
    if (!songsData || songsData.length === 0) {
      return res.status(200).json({ hasXRay: false, scenes: [] });
    }

    // 3. Sahne verilerini eşle ve aktörlerle zenginleştir
    const scenes = songsData.map((s, idx) => {
      const startTime = typeof s.startTime === 'number' ? s.startTime : (idx * 300 + 60);
      const endTime = typeof s.endTime === 'number' ? s.endTime : (startTime + 180);
      const sceneDesc = s.sceneDescription || s.description || '';

      // Açıklamadaki veya sahnedeki karakterleri allCast içinden eşleştir
      const matchedActors = allCast.filter((actor) => {
        if (!sceneDesc) return false;
        const charName = actor.character.toLowerCase();
        const actName = actor.name.toLowerCase();
        const desc = sceneDesc.toLowerCase();
        return charName.length > 2 && (desc.includes(charName) || desc.includes(actName));
      });

      // Eğer açıklamayla aktör eşleşmediyse en popüler 2 başrol oyuncusunu sahneye dahil et
      const sceneActors = matchedActors.length > 0 ? matchedActors.slice(0, 4) : allCast.slice(0, 3);

      return {
        id: scene-,
        startSeconds: startTime,
        endSeconds: endTime,
        description: sceneDesc,
        song: {
          title: s.title || s.name,
          artist: s.artist?.name || s.artist || 'Bilinmeyen Sanatçı',
          albumCover: s.album?.imageUrl || s.spotifyData?.albumArt || null,
          spotifyUrl: s.spotifyData?.spotifyUri || s.spotifyUrl || null,
          previewUrl: s.previewUrl || s.spotifyData?.previewUrl || null,
        },
        actors: sceneActors,
      };
    });

    return res.status(200).json({
      hasXRay: scenes.length > 0,
      tmdbId,
      imdbId,
      scenes,
    });

  } catch (error) {
    console.error('X-Ray API Error:', error);
    return res.status(200).json({ hasXRay: false, scenes: [], error: error.message });
  }
}
