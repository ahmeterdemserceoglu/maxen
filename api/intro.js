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
    const url = new URL(req.url, `http://${req.headers.host}`);
    const imdbId = url.searchParams.get('imdb_id');
    const season = url.searchParams.get('season');
    const episode = url.searchParams.get('episode');

    if (!imdbId || !season || !episode) {
      return res.status(400).json({ error: 'Missing imdb_id, season, or episode query parameters.' });
    }

    const INTRODB_API_KEY = process.env.INTRODB_API_KEY;
    const targetUrl = `https://api.introdb.app/intro?imdb_id=${imdbId}&season=${season}&episode=${episode}`;

    const headers = {
      'Accept': 'application/json',
    };
    if (INTRODB_API_KEY) {
      headers['x-api-key'] = INTRODB_API_KEY;
    }

    const response = await fetch(targetUrl, { headers });

    if (!response.ok) {
      return res.status(200).json({ success: false, hasIntro: false, intro: null });
    }

    const data = await response.json();
    res.status(200).json(data);

  } catch (error) {
    console.error('IntroDB Proxy Error:', error);
    res.status(500).json({ error: error.message });
  }
}
