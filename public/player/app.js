const searchForm = document.querySelector('#searchForm');
const results = document.querySelector('#results');
const episodePicker = document.querySelector('#episodePicker');
const setup = document.querySelector('#setup');
const player = document.querySelector('#player');
const video = document.querySelector('#video');
const status = document.querySelector('#status');
let hls;

async function api(path) {
  try {
    const response = await fetch(path);
    const data = await response.json();
    if (!response.ok) return { ok: false, error: data.error || `Sunucu hatası: ${response.status}` };
    return data;
  } catch (error) {
    return { ok: false, error: `Sunucuya bağlanılamadı: ${error.message}` };
  }
}

function searchApi(query) {
  if (location.hostname === '127.0.0.1') return `/api/search?q=${encodeURIComponent(query)}`;
  return `/api/tmdb?path=/search/multi&query=${encodeURIComponent(query)}&language=tr-TR&include_adult=false`;
}

function normalizeSearchResponse(response) {
  if (response.ok === false) return response;
  if (response.results?.[0]?.type) return response;
  return {
    ok: true,
    results: (response.results || []).filter((item) => ['movie', 'tv'].includes(item.media_type)).slice(0, 18).map((item) => ({
      id: item.id, type: item.media_type, title: item.title || item.name,
      year: (item.release_date || item.first_air_date || '').slice(0, 4),
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
    })),
  };
}

async function play(params) {
  status.textContent = 'Video kaynağı çözülüyor…'; status.className = '';
  const endpoint = location.hostname === '127.0.0.1'
    ? `/api/resolve?${new URLSearchParams(params)}`
    : `/api/stream?${new URLSearchParams({ tmdbId: params.tmdbId, type: params.type, season: params.season, episode: params.episode, direct: 1 })}`;
  const result = await api(endpoint);
  if (result.success && result.streamUrl) result.ok = true;
  if (!result.ok) { status.textContent = result.error; status.className = 'error'; return; }
  if (hls) hls.destroy();
  hls = new Hls({ enableWorker: true, backBufferLength: 90 });
  hls.loadSource(result.streamUrl);
  hls.attachMedia(video);
  hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (data.fatal) status.textContent = `Oynatma hatası: ${data.details}`;
  });
  setup.hidden = true; player.hidden = false;
}

searchForm.addEventListener('submit', async (event) => {
  event.preventDefault(); results.innerHTML = ''; episodePicker.hidden = true;
  status.textContent = 'Aranıyor…'; status.className = '';
  const response = normalizeSearchResponse(await api(searchApi(document.querySelector('#query').value.trim())));
  if (!response.ok) { status.textContent = response.error; status.className = 'error'; return; }
  status.textContent = response.results.length ? `${response.results.length} sonuç` : 'Sonuç bulunamadı';
  response.results.forEach((item) => {
    const card = document.createElement('button'); card.className = 'card';
    const poster = item.poster ? `<img src="${item.poster}" alt="">` : '<div class="posterPlaceholder">MAXEN</div>';
    card.innerHTML = `${poster}<div>${item.title}<small>${item.type === 'movie' ? 'Film' : 'Dizi'} · ${item.year || '—'}</small></div>`;
    card.addEventListener('click', async () => {
      if (item.type === 'movie') return play({ tmdbId: item.id, type: 'movie', season: 1, episode: 1 });
      status.textContent = 'Sezonlar alınıyor…';
      const details = location.hostname === '127.0.0.1'
        ? await api(`/api/tv?id=${item.id}`)
        : await api(`/api/tmdb?path=/tv/${item.id}&language=tr-TR`);
      if (details.ok !== false && !details.ok) details.ok = true;
      if (!details.ok) { status.textContent = details.error; status.className = 'error'; return; }
      document.querySelector('#selectedTitle').textContent = item.title;
      const seasonSelect = document.querySelector('#season'); seasonSelect.innerHTML = '';
      details.seasons.forEach((season) => seasonSelect.add(new Option(`${season.season_number}. Sezon`, season.season_number)));
      const episodeSelect = document.querySelector('#episode');
      const fillEpisodes = () => { const selected = details.seasons.find((s) => s.season_number === Number(seasonSelect.value)); episodeSelect.innerHTML = ''; for(let i=1;i<=selected.episode_count;i++) episodeSelect.add(new Option(`${i}. Bölüm`, i)); };
      seasonSelect.onchange = fillEpisodes; fillEpisodes(); episodePicker.hidden = false; status.textContent = '';
      document.querySelector('#playEpisode').onclick = () => play({ tmdbId: item.id, type: 'tv', season: Number(seasonSelect.value), episode: Number(episodeSelect.value) });
    });
    results.appendChild(card);
  });
});

document.querySelector('#back').addEventListener('click', () => {
  video.pause(); if (hls) hls.destroy(); hls = null; video.removeAttribute('src');
  player.hidden = true; setup.hidden = false; status.textContent = '';
});
