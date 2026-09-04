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
    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    if (!TMDB_API_KEY) {
      return res.status(500).json({ error: 'TMDB_API_KEY is not configured.' });
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const targetPath = url.searchParams.get('path');
    
    if (!targetPath) {
      return res.status(400).json({ error: 'Missing "path" query parameter.' });
    }

    url.searchParams.delete('path');
    
    const tmdbUrl = new URL(`https://api.themoviedb.org/3${targetPath}`);
    tmdbUrl.searchParams.append('api_key', TMDB_API_KEY);
    
    for (const [key, value] of url.searchParams.entries()) {
      tmdbUrl.searchParams.append(key, value);
    }

    const response = await fetch(tmdbUrl.toString(), {
      headers: {
        'Accept': 'application/json',
      }
    });

    const data = await response.json();
    res.status(response.status).json(data);

  } catch (error) {
    console.error('TMDB Proxy Error:', error);
    res.status(500).json({ error: error.message });
  }
}
