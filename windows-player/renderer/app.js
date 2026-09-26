const $ = (selector) => document.querySelector(selector);
const app = $('#app'); const detail = $('#detail'); const video = $('#video'); const player = $('#player');
const seek = $('#seek'); const volume = $('#volume'); const playToggle = $('#playToggle'); const centerPlay = $('#centerPlay');
const store = { get: (key, fallback = {}) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }, set: (key, value) => localStorage.setItem(key, JSON.stringify(value)) };
let hls; let current; let activeDetail; let resumeApplied = false; let toastTimer; let controlsTimer; let playbackGeneration = 0; let activeSource = 'original'; let detailReturnScroll = 0; let playerReturn = 'app'; let streamRecoveryAttempted = false; let activeMediaKey = ''; let originalAudioTracks = []; let dubAvailable = false; let pendingAudioLanguage = '';

async function api(path) {
  try { const response = await fetch(path); const data = await response.json(); return response.ok ? data : { ok: false, error: data.error || `Sunucu hatası ${response.status}` }; }
  catch (error) { return { ok: false, error: `Bağlantı kurulamadı: ${error.message}` }; }
}
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2300); }
function meta(item) { return `<span class="rating">★ ${item.rating || '—'}</span><span>${item.year || '—'}</span><span>${item.type === 'tv' ? 'Dizi' : 'Film'}</span>`; }
function card(item, resume = false) { return `<button class="card" data-resume="${resume}" data-item='${escapeHtml(JSON.stringify(item))}'>${item.poster ? `<img loading="lazy" src="${item.poster}" alt="${escapeHtml(item.title)}">` : '<div class="placeholder"><span>M</span></div>'}<div class="cardShade"></div><div class="cardText"><div class="cardTitle">${escapeHtml(item.title)}</div><div class="cardMeta"><span>${item.year || '—'}</span><i></i><span>${item.type === 'tv' ? 'Dizi' : 'Film'}</span>${item.rating ? `<span class="cardRating">★ ${item.rating}</span>` : ''}</div>${progressBar(item)}</div><span class="cardPlay">▶</span></button>`; }
function progressBar(item) { const entries = store.get('progress'); const entry = Object.values(entries).filter(Boolean).find((x) => x.id === item.id && x.type === item.type); return entry?.duration ? `<div class="progress"><b style="width:${Math.min(100, entry.time / entry.duration * 100)}%"></b></div>` : ''; }
function bindCards(root = document) { root.querySelectorAll('[data-item]').forEach((el) => el.onclick = () => { const item = JSON.parse(el.dataset.item); el.dataset.resume === 'true' ? resumeFrom(item) : openDetail(item); }); }

async function home() {
  app.innerHTML = '<div class="loading"><i></i><span>Ana sayfa hazırlanıyor</span></div>';
  const data = await api('/api/home'); if (!data.ok) return showError(data.error);
  const continueItems = Object.values(store.get('progress')).filter((x) => x && x.duration && x.time / x.duration < .95).sort((a, b) => b.updated - a.updated);
  app.innerHTML = `<section class="hero" style="background-image:url('${data.hero.backdrop || ''}')"><div class="heroContent"><span class="eyebrow"><i></i> MAXEN SEÇKİSİ</span><h1>${escapeHtml(data.hero.title)}</h1><div class="meta">${meta(data.hero)}<span class="ageBadge">13+</span></div><p>${escapeHtml(data.hero.overview)}</p><div class="actions"><button class="primary" id="heroPlay"><span>▶</span> Şimdi İzle</button><button class="secondary" id="heroInfo"><span>ⓘ</span> Detaylar</button></div></div><div class="heroIndex"><span>BUGÜN</span><strong>01</strong></div><div class="scrollCue">KEŞFET <b>↓</b></div></section><div class="catalog">${continueItems.length ? row('İzlemeye Devam Et', continueItems, 'Kaldığın yerden', true) : ''}${data.sections.map((s, index) => row(s.title, s.items, index === 0 ? 'Şu an en çok izlenenler' : '')).join('')}</div>`;
  $('#heroInfo').onclick = () => openDetail(data.hero); $('#heroPlay').onclick = () => quickPlay(data.hero); bindCards();
}
function row(title, items, subtitle = '', resume = false) { return `<section class="row"><div class="rowHead"><div><h2>${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div><span>${items.length} içerik</span></div><div class="cards">${items.map((item) => card(item, resume)).join('')}</div></section>`; }
function showError(message) { app.innerHTML = `<div class="loading"><strong>Bir şeyler ters gitti</strong><span>${escapeHtml(message)}</span><button class="primary" onclick="location.reload()">Tekrar dene</button></div>`; }

async function browse(type) {
  app.innerHTML = '<div class="loading"><i></i><span>Katalog yükleniyor</span></div>'; const data = await api(`/api/discover?type=${type}`);
  if (!data.ok) return showError(data.error); app.innerHTML = `<section class="gridPage"><h1 class="pageTitle">${data.title}</h1><div class="grid">${data.results.map((item) => card(item)).join('')}</div></section>`; bindCards();
}
function listPage() {
  const items = Object.values(store.get('myList')); app.innerHTML = `<section class="gridPage"><h1 class="pageTitle">Listem</h1>${items.length ? `<div class="grid">${items.map((item) => card(item)).join('')}</div>` : '<div class="loading"><span>Listen henüz boş. Beğendiğin içerikleri detay ekranından ekleyebilirsin.</span></div>'}</section>`; bindCards();
}
async function search(query) {
  app.innerHTML = '<div class="loading"><i></i><span>Aranıyor</span></div>'; const data = await api(`/api/search?q=${encodeURIComponent(query)}`);
  if (!data.ok) return showError(data.error); app.innerHTML = `<section class="gridPage"><h1 class="pageTitle">“${escapeHtml(query)}” sonuçları</h1>${data.results.length ? `<div class="grid">${data.results.map((item) => card(item)).join('')}</div>` : '<div class="loading"><span>Sonuç bulunamadı.</span></div>'}</section>`; bindCards();
}

async function openDetail(summary) {
  detailReturnScroll = window.scrollY; app.hidden = true; detail.hidden = false; window.scrollTo(0, 0); $('#detailBody').innerHTML = '<div class="loading"><i></i><span>Detaylar yükleniyor</span></div>';
  const data = await api(`/api/details?id=${summary.id}&type=${summary.type}`); if (!data.ok) { closeDetail(); return toast(data.error); }
  activeDetail = data.item; renderDetail();
}
function renderDetail() {
  const item = activeDetail; const list = store.get('myList'); const saved = Boolean(list[`${item.type}-${item.id}`]);
  $('#detailBody').innerHTML = `<section class="detailHero" style="background-image:url('${item.backdrop || item.poster || ''}')"><div class="detailInfo"><span class="detailKicker">${item.type === 'tv' ? 'MAXEN DİZİ' : 'MAXEN FİLM'}</span><h1>${escapeHtml(item.title)}</h1><div class="meta">${meta(item)}${item.runtime ? `<span>${item.runtime} dk</span>` : ''}<span class="ageBadge">13+</span></div><p>${escapeHtml(item.overview || 'Açıklama bulunmuyor.')}</p><div class="actions"><button class="primary" id="detailPlay"><span>▶</span> ${resumeLabel(item)}</button><button class="secondary iconButton" id="toggleList">${saved ? '✓' : '+'}<em>${saved ? 'Listemde' : 'Listeme Ekle'}</em></button></div><div class="extra"><b>Türler</b> ${escapeHtml((item.genres || []).join(', '))}${item.cast?.length ? `<br><b>Oyuncular</b> ${escapeHtml(item.cast.join(', '))}` : ''}</div></div></section>${item.type === 'tv' ? `<section class="episodes"><div class="seasonBar"><div><span>BÖLÜM REHBERİ</span><h2>${escapeHtml(item.title)}</h2></div><select id="seasonSelect">${item.seasons.map((s) => `<option value="${s.season_number}">${s.name}</option>`).join('')}</select></div><div id="episodeList"><div class="loading"><i></i></div></div></section>` : ''}`;
  $('#detailPlay').onclick = () => playFromDetail(item); $('#toggleList').onclick = toggleList;
  if (item.type === 'tv') { $('#seasonSelect').onchange = loadEpisodes; loadEpisodes(); }
}
function resumeLabel(item) { const entries = Object.values(store.get('progress')); const entry = entries.find((x) => x.id === item.id && x.type === item.type); return entry?.time > 30 ? 'Devam Et' : 'Oynat'; }
function closeDetail() { detail.hidden = true; app.hidden = false; requestAnimationFrame(() => window.scrollTo(0, detailReturnScroll)); }
function resumeFrom(entry) { const { season = 1, episode = 1, time = 0, duration: _duration, updated: _updated, ...item } = entry; play({ item, season, episode }, 'original', time); }
function playFromDetail(item) { const entry = Object.values(store.get('progress')).filter(Boolean).find((value) => value.id === item.id && value.type === item.type); if (entry?.time > 10) return resumeFrom({ ...entry, ...item, season: entry.season, episode: entry.episode, time: entry.time }); play({ item, season: 1, episode: 1 }); }
function toggleList() { const list = store.get('myList'); const key = `${activeDetail.type}-${activeDetail.id}`; if (list[key]) { delete list[key]; toast('Listemden çıkarıldı'); } else { list[key] = activeDetail; toast('Listeme eklendi'); } store.set('myList', list); renderDetail(); }
async function loadEpisodes() {
  const season = Number($('#seasonSelect').value); const target = $('#episodeList'); target.innerHTML = '<div class="loading"><i></i></div>';
  const data = await api(`/api/season?id=${activeDetail.id}&season=${season}`); if (!data.ok) return target.innerHTML = escapeHtml(data.error);
  target.innerHTML = data.episodes.map((ep) => `<button class="episode" data-episode="${ep.number}"><b>${ep.number}</b>${ep.still ? `<img loading="lazy" src="${ep.still}" alt="">` : '<span class="episodeStill"></span>'}<span><h3>${escapeHtml(ep.title || `${ep.number}. Bölüm`)}</h3><p>${escapeHtml(ep.overview || 'Bölüm açıklaması bulunmuyor.')}</p>${episodeProgress(activeDetail.id, season, ep.number)}</span></button>`).join('');
  target.querySelectorAll('[data-episode]').forEach((el) => el.onclick = () => play({ item: activeDetail, season, episode: Number(el.dataset.episode) }));
}
function episodeProgress(id, season, episode) { const entry = store.get('progress')[`tv-${id}-${season}-${episode}`]; return entry?.duration ? `<div class="progress"><b style="width:${Math.min(100, entry.time / entry.duration * 100)}%"></b></div>` : ''; }
function quickPlay(item) { if (item.type === 'movie') return play({ item, season: 1, episode: 1 }); openDetail(item); }

async function play(context, source = 'original', keepTime = 0, forceRefresh = false) {
  const generation = ++playbackGeneration; const openingPlayer = player.hidden; const mediaKey = `${context.item.type}:${context.item.id}:${context.season}:${context.episode}`;
  if (mediaKey !== activeMediaKey) { activeMediaKey = mediaKey; originalAudioTracks = []; dubAvailable = false; pendingAudioLanguage = ''; activeSource = 'original'; }
  current = context; resumeApplied = false; streamRecoveryAttempted = forceRefresh; if (openingPlayer) playerReturn = detail.hidden ? 'app' : 'detail'; detail.hidden = true; app.hidden = true; player.hidden = false; $('#episodePanel').hidden = true; $('#settingsPanel').hidden = true; showControls(); $('#playerTitle').textContent = context.item.title; $('#playerMeta').textContent = context.item.type === 'tv' ? `${context.season}. Sezon · ${context.episode}. Bölüm` : context.item.year || 'Film';
  renderAudioOptions(source); $('#nextEpisode').hidden = context.item.type !== 'tv'; $('#episodeMenu').hidden = context.item.type !== 'tv'; setPlayerStatus(source === 'dub' ? 'Türkçe ses hazırlanıyor…' : 'Video hazırlanıyor…');
  const params = new URLSearchParams({ tmdbId: context.item.id, type: context.item.type, title: context.item.title, season: context.season, episode: context.episode });
  if (forceRefresh) params.set('refresh', '1');
  const result = await api(`${source === 'dub' ? '/api/dub' : '/api/resolve'}?${params}`); if (generation !== playbackGeneration) return;
  if (!result.ok) { renderAudioOptions(activeSource); setPlayerStatus(result.error, 'error'); return; }
  if (source === 'dub') dubAvailable = true; activeSource = source; startStream(result.streamUrl, keepTime, source); if (source === 'original') discoverDub(context, generation);
}
function normalizeAudioLanguage(value = '') {
  const raw = String(value).toLocaleLowerCase('tr-TR').trim();
  if (/\b(tr|tur)\b|türk/.test(raw)) return 'tr'; if (/\b(en|eng)\b|english|ingiliz/.test(raw)) return 'en'; if (/\b(es|spa)\b|spanish|español|ispanyol/.test(raw)) return 'es'; if (/\b(it|ita)\b|italian|italy|italyan/.test(raw)) return 'it'; if (/\b(fr|fra|fre)\b|french|fransız/.test(raw)) return 'fr'; if (/\b(de|deu|ger)\b|german|almanca/.test(raw)) return 'de'; if (/\b(pt|por)\b|portugu/.test(raw)) return 'pt'; if (/\b(ja|jpn)\b|japan|japon/.test(raw)) return 'ja'; if (/\b(ko|kor)\b|korean|kore/.test(raw)) return 'ko'; if (/\b(ru|rus)\b|russian|rusça/.test(raw)) return 'ru'; return raw.length <= 3 ? raw : '';
}
function audioLanguageLabel(language, fallback = '') {
  const code = normalizeAudioLanguage(language) || normalizeAudioLanguage(fallback); const labels = { tr: 'Türkçe', en: 'İngilizce', es: 'İspanyolca', it: 'İtalyanca', fr: 'Fransızca', de: 'Almanca', pt: 'Portekizce', ja: 'Japonca', ko: 'Korece', ru: 'Rusça' };
  return labels[code] || String(language || fallback || 'Orijinal Ses').replace(/\s*\(?(dubbed|dub|dublaj|original|orijinal)\)?/gi, '').trim() || 'Orijinal Ses';
}
function trackLanguage(track, fallback = '') { return normalizeAudioLanguage(`${track.lang || track.language || ''} ${track.name || track.label || ''}`) || normalizeAudioLanguage(fallback); }
function renderAudioOptions(selected = activeSource) {
  const originalLanguage = current?.item?.originalLanguage || 'en'; const seen = new Set();
  const embedded = originalAudioTracks.filter((entry) => { const key = entry.language || entry.label.toLocaleLowerCase('tr-TR'); if (seen.has(key)) return false; seen.add(key); return true; });
  const internalOptions = embedded.length ? embedded.map((entry) => `<option value="audio:${entry.index}:${entry.language}">${escapeHtml(entry.label)}</option>`).join('') : `<option value="original">${escapeHtml(audioLanguageLabel(originalLanguage, 'Orijinal Ses'))}</option>`;
  const dubOption = current?.item?.type === 'tv' && (dubAvailable || selected === 'dub') ? '<optgroup label="Dublaj"><option value="dub">Türkçe Dublaj</option></optgroup>' : '';
  $('#source').innerHTML = `<optgroup label="Ses dilleri">${internalOptions}</optgroup>${dubOption}`; $('#source').disabled = false;
  if (selected === 'dub' && dubOption) $('#source').value = 'dub'; else if (String(selected).startsWith('audio:')) $('#source').value = selected; else if (activeSource === 'original' && hls && hls.audioTrack >= 0) { const active = originalAudioTracks.find((entry) => entry.index === hls.audioTrack); if (active) $('#source').value = `audio:${active.index}:${active.language}`; } else $('#source').value = embedded[0] ? `audio:${embedded[0].index}:${embedded[0].language}` : 'original';
}
function chooseEmbeddedAudio(tracks, selectedSource) {
  if (selectedSource !== 'original' || !tracks.length || !hls) { renderAudioOptions(selectedSource); return; }
  originalAudioTracks = tracks.map((track, index) => { const language = trackLanguage(track, tracks.length === 1 ? current?.item?.originalLanguage : ''); return { index, language, label: audioLanguageLabel(track.name || track.lang || track.language, language || current?.item?.originalLanguage) }; });
  const preferred = normalizeAudioLanguage(pendingAudioLanguage || store.get('preferredAudioLanguage', '') || current?.item?.originalLanguage || 'en'); const original = normalizeAudioLanguage(current?.item?.originalLanguage || 'en');
  const chosen = originalAudioTracks.find((entry) => entry.language === preferred) || originalAudioTracks.find((entry) => entry.language === original) || originalAudioTracks.find((entry) => entry.language === 'en') || originalAudioTracks.find((entry) => !['es', 'it'].includes(entry.language)) || originalAudioTracks[0];
  if (chosen) { hls.audioTrack = chosen.index; pendingAudioLanguage = ''; renderAudioOptions(`audio:${chosen.index}:${chosen.language}`); toast(`Ses: ${chosen.label}`); }
}
async function discoverDub(context, generation) {
  if (context.item.type !== 'tv') return; const params = new URLSearchParams({ tmdbId: context.item.id, type: context.item.type, title: context.item.title, season: context.season, episode: context.episode }); const result = await api(`/api/dub?${params}`);
  if (generation !== playbackGeneration || !result.ok) return; dubAvailable = true; renderAudioOptions();
  const preferred = normalizeAudioLanguage(store.get('preferredAudioLanguage', '')); if (preferred === 'tr' && activeSource === 'original') play(current, 'dub', video.currentTime);
}
function startStream(url, seekTime = 0, selectedSource = 'original') {
  if (hls) hls.destroy(); video.pause(); video.removeAttribute('src'); $('#quality').innerHTML = '<option value="-1">Otomatik</option>';
  const applySeek = () => { const stored = current ? store.get('progress')[progressKey()] : null; const target = seekTime || (!resumeApplied && stored?.time > 10 ? stored.time : 0); if (target > 0 && Number.isFinite(video.duration)) video.currentTime = Math.min(target, Math.max(0, video.duration - 2)); resumeApplied = true; };
  video.addEventListener('loadedmetadata', applySeek, { once: true });
  if (Hls.isSupported() && /m3u8/i.test(url)) {
    hls = new Hls({ enableWorker: true, backBufferLength: 90 }); hls.loadSource(url); hls.attachMedia(video);
    const syncAudioTracks = (tracks = hls.audioTracks) => chooseEmbeddedAudio(tracks || [], selectedSource);
    hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      hls.levels.forEach((level, i) => $('#quality').add(new Option(`${level.height}p`, i)));
      syncAudioTracks(data?.audioTracks || hls.audioTracks);
      applySeek(); video.play().catch(() => {});
    });
    hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data) => syncAudioTracks(data?.audioTracks || hls.audioTracks));
    hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_event, data) => { if (selectedSource !== 'original') return; const active = originalAudioTracks.find((entry) => entry.index === data.id); if (active) renderAudioOptions(`audio:${active.index}:${active.language}`); });
    hls.on(Hls.Events.ERROR, (_event, data) => { if (!data.fatal) return; if (!streamRecoveryAttempted && current) { streamRecoveryAttempted = true; const retryTime = video.currentTime; toast('Yayın yenileniyor…'); play(current, activeSource, retryTime, true); } else setPlayerStatus('Video oynatılamadı. Başka bir ses seçeneğini deneyebilirsin.', 'error'); });
  } else { renderAudioOptions(selectedSource); video.src = url; video.play().catch(() => {}); }
}
function progressKey() { return current.item.type === 'tv' ? `tv-${current.item.id}-${current.season}-${current.episode}` : `movie-${current.item.id}`; }
function saveProgress() { if (!current || !video.duration || video.currentTime < 5) return; const entries = store.get('progress'); entries[progressKey()] = { ...current.item, season: current.season, episode: current.episode, time: video.currentTime, duration: video.duration, updated: Date.now() }; if (video.currentTime / video.duration > .95) delete entries[progressKey()]; store.set('progress', entries); }
function formatTime(seconds) { if (!Number.isFinite(seconds)) return '00:00'; const h = Math.floor(seconds / 3600); const m = Math.floor(seconds % 3600 / 60); const s = Math.floor(seconds % 60); return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
function setPlayerStatus(message = '', kind = 'loading') { $('#playerStatus').textContent = message; player.classList.toggle('loading', Boolean(message) && kind === 'loading'); player.classList.toggle('hasError', Boolean(message) && kind === 'error'); }
function updateControls() { const ratio = video.duration ? video.currentTime / video.duration : 0; seek.value = Math.round(ratio * 1000); seek.style.setProperty('--value', `${ratio * 100}%`); $('#currentTime').textContent = formatTime(video.currentTime); $('#duration').textContent = formatTime(video.duration); }
function updatePlayState() { player.classList.toggle('isPlaying', !video.paused); playToggle.setAttribute('aria-label', video.paused ? 'Oynat' : 'Duraklat'); }
function togglePlayback() { if (!video.src && !hls) return; video.paused ? video.play().catch(() => {}) : video.pause(); showControls(); }
function showControls() { player.classList.add('controlsVisible'); clearTimeout(controlsTimer); if (!video.paused && $('#settingsPanel').hidden && $('#episodePanel').hidden) controlsTimer = setTimeout(() => player.classList.remove('controlsVisible'), 2800); }

async function loadPlayerEpisodes(season) {
  const list = $('#playerEpisodeList'); list.innerHTML = '<div class="panelLoading"><i></i><span>Bölümler hazırlanıyor</span></div>';
  const data = await api(`/api/season?id=${current.item.id}&season=${season}`); if (!data.ok) { list.innerHTML = `<div class="panelLoading"><span>${escapeHtml(data.error)}</span></div>`; return; }
  list.innerHTML = data.episodes.map((episode) => `<button class="playerEpisode${Number(season) === Number(current.season) && episode.number === Number(current.episode) ? ' active' : ''}" data-player-episode="${episode.number}">${episode.still ? `<img src="${episode.still}" alt="">` : '<span class="episodeStill"></span>'}<span><b>${episode.number}. ${escapeHtml(episode.title || 'Bölüm')}</b><small>${episode.runtime ? `${episode.runtime} dk` : ''}</small><em>${escapeHtml(episode.overview || '')}</em></span></button>`).join('');
  list.querySelectorAll('[data-player-episode]').forEach((button) => button.onclick = () => { $('#episodePanel').hidden = true; play({ item: current.item, season: Number(season), episode: Number(button.dataset.playerEpisode) }, activeSource, 0); });
}
async function openEpisodePanel() {
  if (!current || current.item.type !== 'tv') return; $('#settingsPanel').hidden = true; $('#episodePanel').hidden = false; $('#episodePanelTitle').textContent = current.item.title; showControls();
  const details = await api(`/api/details?id=${current.item.id}&type=tv`); if (!details.ok || $('#episodePanel').hidden) return;
  current.item = { ...current.item, ...details.item }; const seasons = details.item.seasons || []; $('#playerSeasonSelect').innerHTML = seasons.map((season) => `<option value="${season.season_number}">${escapeHtml(season.name)}</option>`).join(''); $('#playerSeasonSelect').value = String(current.season); await loadPlayerEpisodes(current.season);
}

document.querySelectorAll('[data-nav]').forEach((button) => button.onclick = () => { detail.hidden = true; app.hidden = false; window.scrollTo(0, 0); document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b.dataset.nav === button.dataset.nav)); if (button.dataset.nav === 'home') home(); else if (button.dataset.nav === 'list') listPage(); else browse(button.dataset.nav); });
$('#searchForm').onsubmit = (event) => { event.preventDefault(); const query = $('#query').value.trim(); if (query) { detail.hidden = true; app.hidden = false; window.scrollTo(0, 0); search(query); } };
window.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#query').focus(); $('#query').select(); } });
$('[data-close]').onclick = closeDetail; $('#back').onclick = async () => { playbackGeneration += 1; saveProgress(); video.pause(); if (hls) hls.destroy(); hls = null; video.removeAttribute('src'); $('#episodePanel').hidden = true; if (document.fullscreenElement) await document.exitFullscreen?.(); player.hidden = true; player.classList.remove('controlsVisible'); current = null; if (playerReturn === 'detail') { detail.hidden = false; app.hidden = true; } else { detail.hidden = true; app.hidden = false; } };
$('#source').onchange = () => { const value = $('#source').value; const label = $('#source').selectedOptions[0]?.textContent || ''; const keepTime = video.currentTime; $('#settingsPanel').hidden = true; if (value.startsWith('audio:')) { const [, index, language] = value.split(':'); store.set('preferredAudioLanguage', language || label); if (activeSource === 'original' && hls) { hls.audioTrack = Number(index); toast(`Ses: ${label}`); } else { pendingAudioLanguage = language || label; play(current, 'original', keepTime); } return; } if (value === 'dub') { store.set('preferredAudioLanguage', 'tr'); play(current, 'dub', keepTime); return; } store.set('preferredAudioLanguage', current?.item?.originalLanguage || 'en'); if (activeSource !== 'original') play(current, 'original', keepTime); }; $('#quality').onchange = () => { if (hls) hls.currentLevel = Number($('#quality').value); $('#settingsPanel').hidden = true; };
playToggle.onclick = togglePlayback; centerPlay.onclick = togglePlayback; video.onclick = togglePlayback; $('#rewind').onclick = () => { video.currentTime = Math.max(0, video.currentTime - 10); showControls(); }; $('#forward').onclick = () => { video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10); showControls(); };
seek.oninput = () => { if (video.duration) video.currentTime = Number(seek.value) / 1000 * video.duration; updateControls(); }; volume.oninput = () => { video.volume = Number(volume.value); video.muted = false; volume.style.setProperty('--value', `${video.volume * 100}%`); player.classList.toggle('isMuted', !video.volume); }; $('#mute').onclick = () => { video.muted = !video.muted; player.classList.toggle('isMuted', video.muted); };
$('#fullscreen').onclick = async () => { try { if (!document.fullscreenElement) await player.requestFullscreen?.({ navigationUI: 'hide' }); else await document.exitFullscreen?.(); } catch (error) { toast(`Tam ekran açılamadı: ${error.message}`); } showControls(); };
document.addEventListener('fullscreenchange', () => { const active = document.fullscreenElement === player; player.classList.toggle('isFullscreen', active); $('#fullscreen').setAttribute('aria-label', active ? 'Tam ekrandan çık' : 'Tam ekran'); showControls(); });
$('#settingsToggle').onclick = (event) => { event.stopPropagation(); $('#episodePanel').hidden = true; $('#settingsPanel').hidden = !$('#settingsPanel').hidden; showControls(); };
$('#nextEpisode').onclick = () => { if (current?.item.type === 'tv') play({ ...current, episode: current.episode + 1 }, activeSource, 0); };
$('#episodeMenu').onclick = openEpisodePanel; $('#closeEpisodePanel').onclick = () => { $('#episodePanel').hidden = true; showControls(); }; $('#playerSeasonSelect').onchange = () => loadPlayerEpisodes(Number($('#playerSeasonSelect').value));
player.onmousemove = showControls; player.onmouseleave = () => { if (!video.paused) player.classList.remove('controlsVisible'); };
video.addEventListener('playing', () => { setPlayerStatus(''); updatePlayState(); showControls(); }); video.addEventListener('play', updatePlayState); video.addEventListener('pause', () => { updatePlayState(); showControls(); }); video.addEventListener('timeupdate', updateControls); video.addEventListener('durationchange', updateControls);
video.addEventListener('pause', saveProgress); window.addEventListener('beforeunload', saveProgress); setInterval(saveProgress, 10000);
window.addEventListener('keydown', (event) => { if (player.hidden || ['INPUT', 'SELECT'].includes(document.activeElement?.tagName)) return; if (event.code === 'Space' || event.key === 'Enter') { event.preventDefault(); togglePlayback(); } else if (event.key === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 10); else if (event.key === 'ArrowRight') video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10); else if (event.key === 'ArrowUp') { event.preventDefault(); video.volume = Math.min(1, video.volume + .1); volume.value = video.volume; } else if (event.key === 'ArrowDown') { event.preventDefault(); video.volume = Math.max(0, video.volume - .1); volume.value = video.volume; } else if (event.key.toLowerCase() === 'm') $('#mute').click(); else if (event.key.toLowerCase() === 'f') $('#fullscreen').click(); showControls(); });
function enableHotReload() {
  if (!new URLSearchParams(location.search).has('dev')) return;
  let connected = false; let disconnected = false;
  const events = new EventSource('/__hot_reload');
  events.addEventListener('connected', () => { if (connected && disconnected) location.reload(); connected = true; disconnected = false; console.info('[Maxen Dev] Hot reload bağlı'); });
  events.addEventListener('reload', (event) => {
    if (String(event.data).endsWith('.css')) {
      const stylesheet = document.querySelector('link[href*="styles.css"]');
      if (stylesheet) stylesheet.href = `styles.css?t=${Date.now()}`;
    } else location.reload();
  });
  events.onerror = () => { if (connected) disconnected = true; };
}
enableHotReload();
home();
