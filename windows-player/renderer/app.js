const $ = (selector) => document.querySelector(selector);
const app = $('#app'); const detail = $('#detail'); const video = $('#video'); const player = $('#player');
const seek = $('#seek'); const volume = $('#volume'); const playToggle = $('#playToggle');
const store = { get: (key, fallback = {}) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }, set: (key, value) => localStorage.setItem(key, JSON.stringify(value)) };
if (window.maxenDesktop) {
  document.body.classList.add('desktop');
  document.querySelectorAll('[data-window-action]').forEach((button) => button.onclick = () => window.maxenDesktop.windowAction(button.dataset.windowAction));
}
let hls; let current; let activeDetail; let resumeApplied = false; let toastTimer; let controlsTimer; let playbackGeneration = 0; let activeSource = 'original'; let detailReturnScroll = 0; let playerReturn = 'app'; let streamRecoveryAttempted = false; let activeMediaKey = ''; let originalAudioTracks = []; let dubAvailable = false; let pendingAudioLanguage = ''; let offlineAudioLabel = ''; let pendingSeekCleanup; let suppressProgressSave = false;
let offlineSeriesEntries = [];
let viewRequest = 0;
const playbackSpeeds = [0.75, 1, 1.25, 1.5, 2];
const positionedSubtitleCues = new WeakSet();
let playerFit = 'contain';

async function api(path) {
  try { const response = await fetch(path); const data = await response.json(); return response.ok ? data : { ok: false, error: data.error || `Sunucu hatası ${response.status}` }; }
  catch (error) { return { ok: false, error: `Bağlantı kurulamadı: ${error.message}` }; }
}
async function apiPost(path, body) {
  try { const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const data = await response.json(); return response.ok ? data : { ok: false, error: data.error || `Sunucu hatası ${response.status}` }; }
  catch (error) { return { ok: false, error: `Bağlantı kurulamadı: ${error.message}` }; }
}
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2300); }
function meta(item) { return `<span class="rating">★ ${item.rating || '—'}</span><span>${item.year || '—'}</span><span>${item.type === 'tv' ? 'Dizi' : 'Film'}</span>`; }
function card(item, resume = false) { return `<button class="card" data-resume="${resume}" data-item='${escapeHtml(JSON.stringify(item))}'>${item.poster ? `<img loading="lazy" src="${item.poster}" alt="${escapeHtml(item.title)}">` : '<div class="placeholder"><span>M</span></div>'}<div class="cardShade"></div><div class="cardText"><div class="cardTitle">${escapeHtml(item.title)}</div><div class="cardMeta"><span>${item.year || '—'}</span><i></i><span>${item.type === 'tv' ? 'Dizi' : 'Film'}</span>${item.rating ? `<span class="cardRating">★ ${item.rating}</span>` : ''}</div>${progressBar(item)}</div><span class="cardPlay">▶</span></button>`; }
function progressBar(item) { const entries = store.get('progress'); const entry = Object.values(entries).filter(Boolean).find((x) => x.id === item.id && x.type === item.type); return entry?.duration ? `<div class="progress"><b style="width:${Math.min(100, entry.time / entry.duration * 100)}%"></b></div>` : ''; }
function bindCards(root = document) { root.querySelectorAll('[data-item]').forEach((el) => el.onclick = () => { const item = JSON.parse(el.dataset.item); el.dataset.resume === 'true' ? resumeFrom(item) : openDetail(item); }); }

async function home() {
  const request = ++viewRequest;
  app.innerHTML = '<div class="loading"><i></i><span>Ana sayfa hazırlanıyor</span></div>';
  const data = await api('/api/home'); if (request !== viewRequest) return; if (!data.ok) return showError(data.error);
  if (data.offline) return offlineHome(data.downloads || []);
  const continueItems = Object.values(store.get('progress')).filter((x) => x && x.duration && x.time / x.duration < .95).sort((a, b) => b.updated - a.updated);
  app.innerHTML = `<section class="hero" style="background-image:url('${data.hero.backdrop || ''}')"><div class="heroContent"><span class="eyebrow"><i></i> MAXEN SEÇKİSİ</span><h1>${escapeHtml(data.hero.title)}</h1><div class="meta">${meta(data.hero)}<span class="ageBadge">13+</span></div><p>${escapeHtml(data.hero.overview)}</p><div class="actions"><button class="primary" id="heroPlay"><span>▶</span> Şimdi İzle</button><button class="secondary" id="heroInfo"><span>ⓘ</span> Detaylar</button></div></div><div class="heroIndex"><span>BUGÜN</span><strong>01</strong></div><div class="scrollCue">KEŞFET <b>↓</b></div></section><div class="catalog">${continueItems.length ? row('İzlemeye Devam Et', continueItems, 'Kaldığın yerden', true) : ''}${data.sections.map((s, index) => row(s.title, s.items, index === 0 ? 'Şu an en çok izlenenler' : '')).join('')}</div>`;
  $('#heroInfo').onclick = () => openDetail(data.hero); $('#heroPlay').onclick = () => quickPlay(data.hero); bindCards();
}
function offlineHome(entries) {
  const complete = entries.filter((entry) => entry.status === 'complete');
  app.innerHTML = `<section class="gridPage offlinePage"><div class="offlineIntro"><span class="eyebrow">ÇEVRİMDIŞI MOD</span><h1>İndirdiklerin hazır</h1><p>İnternet bağlantısı olmadan indirdiğin filmleri ve bölümleri izleyebilirsin.</p><div class="actions"><button class="primary" id="offlineDownloadsButton">İndirilenler</button><button class="secondary" id="retryHomeButton">Bağlantıyı yeniden dene</button></div></div><div id="offlineDownloads" class="downloadsList"></div></section>`;
  $('#offlineDownloadsButton').onclick = () => document.querySelector('[data-nav="downloads"]').click();
  $('#retryHomeButton').onclick = home;
  renderDownloadEntries($('#offlineDownloads'), complete, 'Bu bilgisayarda henüz tamamlanmış indirme yok.');
}
function row(title, items, subtitle = '', resume = false) { return `<section class="row"><div class="rowHead"><div><h2>${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div><span>${items.length} içerik</span></div><div class="cards">${items.map((item) => card(item, resume)).join('')}</div></section>`; }
function showError(message) { app.innerHTML = `<div class="loading"><strong>Bir şeyler ters gitti</strong><span>${escapeHtml(message)}</span><button class="primary" onclick="location.reload()">Tekrar dene</button></div>`; }

async function browse(type) {
  const request = ++viewRequest;
  app.innerHTML = '<div class="loading"><i></i><span>Katalog yükleniyor</span></div>'; const data = await api(`/api/discover?type=${type}`);
  if (request !== viewRequest) return;
  if (!data.ok) return showError(data.error); app.innerHTML = `<section class="gridPage"><h1 class="pageTitle">${data.title}</h1><div class="grid">${data.results.map((item) => card(item)).join('')}</div></section>`; bindCards();
}
function listPage() {
  ++viewRequest;
  const items = Object.values(store.get('myList')); app.innerHTML = `<section class="gridPage"><h1 class="pageTitle">Listem</h1>${items.length ? `<div class="grid">${items.map((item) => card(item)).join('')}</div>` : '<div class="loading"><span>Listen henüz boş. Beğendiğin içerikleri detay ekranından ekleyebilirsin.</span></div>'}</section>`; bindCards();
}
async function downloadsPage() {
  const request = ++viewRequest;
  app.innerHTML = '<section class="gridPage downloadsPage"><div class="downloadsHero"><div><span class="downloadsEyebrow">MAXEN KOLEKSİYONUM</span><h1>İndirilenler</h1><p>Sevdiğin yapımlar, istediğin zaman burada.</p></div><div id="downloadsSummary" class="downloadsSummary"></div></div><div class="downloadsSectionHeader"><h2>Bu cihazda</h2><span id="downloadsCount"></span></div><div id="downloadsContent" class="loading"><span>İndirmeler yükleniyor</span></div></section>';
  await refreshDownloads(request);
}
async function refreshDownloads(request) {
  const data = await api('/api/downloads');
  if (request !== viewRequest || app.hidden || !document.querySelector('[data-nav="downloads"].active')) return;
  if (!data.ok) return showError(data.error);
  const entries = data.downloads;
  $('#downloadsSummary').innerHTML = `<strong>${entries.filter((entry) => entry.status === 'complete').length}</strong><span>izlemeye hazır</span>${entries.some((entry) => entry.status === 'downloading') ? `<small>${entries.filter((entry) => entry.status === 'downloading').length} indirme sürüyor</small>` : ''}`;
  $('#downloadsCount').textContent = `${entries.length} içerik`;
  $('#downloadsContent').className = 'downloadsList';
  renderDownloadEntries($('#downloadsContent'), entries, 'Henüz indirilmiş film veya bölüm yok. Bir içeriğin detayından indirilebilir.');
  if (entries.some((entry) => entry.status === 'downloading')) setTimeout(() => refreshDownloads(request), 1500);
}
function renderDownloadEntries(target, entries, emptyMessage) {
  target.innerHTML = entries.length ? entries.map((entry) => {
    const title = escapeHtml(entry.item.title || 'İsimsiz içerik');
    const label = entry.item.type === 'tv' ? `${entry.season}. Sezon · ${entry.episode}. Bölüm` : escapeHtml(entry.item.year || 'Film');
    const state = entry.status === 'complete' ? 'İNDİRİLDİ' : entry.status === 'downloading' ? 'İNDİRİLİYOR' : 'İNDİRİLEMEDİ';
    return `<article class="downloadTile ${entry.status}"><div class="downloadTileVisual"><div class="downloadTileFallback"><span>MAXEN</span><strong>${title}</strong></div>${entry.item.poster ? `<img loading="lazy" src="/api/download/poster/${encodeURIComponent(entry.id)}" alt="${title} afişi">` : ''}<div class="downloadTileShade"></div><span class="downloadTileState">${state}</span>${entry.status === 'complete' ? `<button class="downloadTilePlay" data-offline-id="${escapeHtml(entry.id)}" aria-label="${title} içeriğini oynat"><svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7z"/></svg><span>Oynat</span></button>` : ''}${entry.status !== 'downloading' ? `<button class="downloadTileDelete" data-delete-id="${escapeHtml(entry.id)}" aria-label="${title} indirmesini sil" title="İndirmeyi sil"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5"/></svg></button>` : ''}</div><div class="downloadTileDetails"><span class="downloadTileKind">${entry.item.type === 'tv' ? 'DİZİ' : 'FİLM'}</span><strong>${title}</strong><span class="downloadTileEpisode">${label}</span><span class="downloadTileTracks">${escapeHtml(entry.audioLabel || 'Ses')} · ${entry.subtitleLabel ? `${escapeHtml(entry.subtitleLabel)} altyazı` : 'Altyazı yok'}</span>${entry.status === 'downloading' ? `<div class="downloadProgress active"><i></i></div><small>${entry.downloadedParts || 0} parça kaydedildi</small>` : ''}${entry.status === 'failed' ? `<small class="downloadError">${escapeHtml(entry.error || 'Bilinmeyen hata')}</small>` : ''}</div></article>`;
  }).join('') : `<div class="downloadsEmpty"><span>↓</span><strong>Henüz indirme yok</strong><p>${escapeHtml(emptyMessage)}</p></div>`;
  target.querySelectorAll('.downloadTileVisual img').forEach((image) => image.addEventListener('error', () => image.remove()));
  target.querySelectorAll('[data-offline-id]').forEach((button) => button.onclick = () => { const entry = entries.find((value) => value.id === button.dataset.offlineId); if (entry) playOffline(entry); });
  target.querySelectorAll('[data-delete-id]').forEach((button) => button.onclick = async () => {
    const entry = entries.find((value) => value.id === button.dataset.deleteId);
    if (!entry || !await askDelete(entry)) return;
    button.disabled = true;
    const result = await apiPost('/api/download/delete', { id: entry.id });
    if (!result.ok) { toast(result.error); button.disabled = false; return; }
    toast('İndirme ve dosyaları silindi.');
    if (document.querySelector('[data-nav="downloads"].active')) downloadsPage();
    else offlineHome(entries.filter((value) => value.id !== entry.id));
  });
}
function askDelete(entry) {
  const dialog = $('#deleteDialog');
  $('#deleteDescription').textContent = `“${entry.item.title}” ve indirilen dosyaları bu bilgisayardan kaldırılacak.`;
  dialog.hidden = false;
  return new Promise((resolve) => {
    const finish = (answer) => { dialog.hidden = true; $('#cancelDelete').onclick = null; $('#confirmDelete').onclick = null; dialog.onclick = null; resolve(answer); };
    $('#cancelDelete').onclick = () => finish(false);
    $('#confirmDelete').onclick = () => finish(true);
    dialog.onclick = (event) => { if (event.target === dialog) finish(false); };
    $('#cancelDelete').focus();
  });
}

let downloadContext = null; let downloadToken = '';
async function openDownload(context) {
  downloadContext = context; downloadToken = '';
  $('#downloadDialog').hidden = false;
  $('#downloadTitle').textContent = context.item.type === 'tv' ? 'Bölümü indir' : 'Filmi indir';
  $('#downloadMedia').textContent = context.item.type === 'tv' ? `${context.item.title} · ${context.season}. sezon ${context.episode}. bölüm` : context.item.title;
  $('#downloadAudio').innerHTML = '<option value="">Ses seçenekleri yükleniyor…</option>';
  $('#downloadSubtitle').innerHTML = '<option value="">Altyazı yok</option>';
  $('#downloadHint').textContent = 'Yayın ve ses seçenekleri aranıyor…';
  $('#confirmDownload').disabled = true;
  const params = new URLSearchParams({ tmdbId: context.item.id, type: context.item.type, title: context.item.title, season: context.season, episode: context.episode });
  const result = await api(`/api/download/options?${params}`);
  if (downloadContext !== context || $('#downloadDialog').hidden) return;
  if (!result.ok) { $('#downloadAudio').innerHTML = '<option value="">Ses bulunamadı</option>'; $('#downloadHint').textContent = result.error; return; }
  downloadToken = result.token;
  $('#downloadAudio').innerHTML = '<option value="">Ses / dublaj seçin</option>' + result.audio.map((audio) => `<option value="${escapeHtml(audio.id)}">${escapeHtml(audio.label)}${audio.kind === 'dub' ? ' · Dublaj' : ''}</option>`).join('');
  $('#downloadAudio').dataset.subtitles = JSON.stringify(result.subtitles);
  $('#downloadHint').textContent = 'Ses seçimi zorunludur. Altyazı olmadan da indirebilirsiniz.';
}
function updateDownloadChoices() {
  const kind = $('#downloadAudio').value.split(':')[0];
  const subtitles = JSON.parse($('#downloadAudio').dataset.subtitles || '[]').filter((entry) => entry.kind === kind);
  $('#downloadSubtitle').innerHTML = '<option value="">Altyazı yok</option>' + subtitles.map((entry) => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.label)}</option>`).join('');
  $('#confirmDownload').disabled = !$('#downloadAudio').value || !downloadToken;
}
async function playOffline(entry) {
  if (player.hidden) playerReturn = detail.hidden ? 'app' : 'detail';
  detail.hidden = true; app.hidden = true; player.hidden = false; enterPlayerFullscreen();
  if (current && !player.hidden) { saveProgress(); suppressProgressSave = true; video.pause(); suppressProgressSave = false; }
  const generation = ++playbackGeneration;
  current = { item: entry.item, season: entry.season, episode: entry.episode };
  activeSource = 'offline'; offlineAudioLabel = entry.audioLabel; originalAudioTracks = []; dubAvailable = false; resumeApplied = false;
  detail.hidden = true; app.hidden = true; player.hidden = false;
  $('#episodePanel').hidden = true; $('#settingsPanel').hidden = true;
  $('#playerTitle').textContent = entry.item.title;
  $('#playerMeta').textContent = entry.item.type === 'tv' ? `${entry.season}. Sezon · ${entry.episode}. Bölüm · Çevrimdışı` : 'Çevrimdışı film';
  $('#playerTopTitle').textContent = $('#playerTitle').textContent; $('#playerTopMeta').textContent = $('#playerMeta').textContent;
  $('#nextEpisode').hidden = true; $('#episodeMenu').hidden = true;
  renderAudioOptions('offline');
  setPlayerStatus('İndirilen video açılıyor…'); showControls();
  const url = `/api/download/file/${encodeURIComponent(entry.id)}/${encodeURIComponent(entry.file)}`;
  startStream(url, 0, 'offline');
  if (generation !== playbackGeneration) return;
  if (entry.item.type === 'tv') {
    const data = await api('/api/downloads');
    if (generation !== playbackGeneration) return;
    offlineSeriesEntries = data.ok ? data.downloads.filter((value) => value.status === 'complete' && value.item.type === 'tv' && String(value.item.id) === String(entry.item.id)).sort((a, b) => Number(a.season) - Number(b.season) || Number(a.episode) - Number(b.episode)) : [];
    $('#episodeMenu').hidden = offlineSeriesEntries.length < 2;
    $('#nextEpisode').hidden = !offlineSeriesEntries.some((value) => Number(value.season) === Number(entry.season) && Number(value.episode) === Number(entry.episode) + 1);
  } else offlineSeriesEntries = [];
}
async function search(query) {
  const request = ++viewRequest;
  app.innerHTML = '<div class="loading"><i></i><span>Aranıyor</span></div>'; const data = await api(`/api/search?q=${encodeURIComponent(query)}`);
  if (request !== viewRequest) return;
  if (!data.ok) return showError(data.error); app.innerHTML = `<section class="gridPage"><h1 class="pageTitle">“${escapeHtml(query)}” sonuçları</h1>${data.results.length ? `<div class="grid">${data.results.map((item) => card(item)).join('')}</div>` : '<div class="loading"><span>Sonuç bulunamadı.</span></div>'}</section>`; bindCards();
}

async function openDetail(summary) {
  detailReturnScroll = window.scrollY; app.hidden = true; detail.hidden = false; window.scrollTo(0, 0); $('#detailBody').innerHTML = '<div class="loading"><i></i><span>Detaylar yükleniyor</span></div>';
  const data = await api(`/api/details?id=${summary.id}&type=${summary.type}`); if (!data.ok) { closeDetail(); return toast(data.error); }
  activeDetail = data.item; renderDetail();
}
function renderDetail() {
  const item = activeDetail; const list = store.get('myList'); const saved = Boolean(list[`${item.type}-${item.id}`]);
  $('#detailBody').innerHTML = `<section class="detailHero" style="background-image:url('${item.backdrop || item.poster || ''}')"><div class="detailInfo"><span class="detailKicker">${item.type === 'tv' ? 'MAXEN DİZİ' : 'MAXEN FİLM'}</span><h1>${escapeHtml(item.title)}</h1><div class="meta">${meta(item)}${item.runtime ? `<span>${item.runtime} dk</span>` : ''}<span class="ageBadge">13+</span></div><p>${escapeHtml(item.overview || 'Açıklama bulunmuyor.')}</p><div class="actions"><button class="primary" id="detailPlay"><span>▶</span> ${resumeLabel(item)}</button>${item.type === 'movie' ? '<button class="secondary" id="detailDownload">↓ İndir</button>' : ''}<button class="secondary iconButton" id="toggleList">${saved ? '✓' : '+'}<em>${saved ? 'Listemde' : 'Listeme Ekle'}</em></button></div><div id="detailDownloadStatus" class="detailDownloadStatus"></div><div class="extra"><b>Türler</b> ${escapeHtml((item.genres || []).join(', '))}${item.cast?.length ? `<br><b>Oyuncular</b> ${escapeHtml(item.cast.join(', '))}` : ''}</div></div></section>${item.type === 'tv' ? `<section class="episodes"><div class="seasonBar"><div><span>BÖLÜM REHBERİ</span><h2>${escapeHtml(item.title)}</h2></div><select id="seasonSelect">${item.seasons.map((s) => `<option value="${s.season_number}">${s.name}</option>`).join('')}</select></div><div id="episodeList"><div class="loading"><i></i></div></div></section>` : ''}`;
  $('#detailPlay').onclick = () => playFromDetail(item); $('#toggleList').onclick = toggleList; if (item.type === 'movie') $('#detailDownload').onclick = () => openDownload({ item, season: 1, episode: 1 });
  if (item.type === 'tv') { $('#seasonSelect').onchange = loadEpisodes; loadEpisodes(); }
  updateDetailDownloads();
}
let detailPollTimer;
async function updateDetailDownloads() {
  clearTimeout(detailPollTimer);
  if (detail.hidden || !activeDetail) return;
  const item = activeDetail;
  const data = await api('/api/downloads');
  if (detail.hidden || activeDetail !== item) return;
  if (data.ok) {
    const matches = data.downloads.filter((entry) => entry.item.type === item.type && String(entry.item.id) === String(item.id));
    const statusText = (entry) => entry.status === 'complete' ? `✓ İndirildi · ${entry.audioLabel}` : entry.status === 'downloading' ? `↓ İndiriliyor · ${entry.downloadedParts || 0} parça` : `İndirme başarısız · ${entry.error || 'Tekrar deneyin'}`;
    if (item.type === 'movie') $('#detailDownloadStatus').textContent = matches[0] ? statusText(matches[0]) : '';
    document.querySelectorAll('[data-download-status]').forEach((element) => {
      const entry = matches.find((value) => value.season === Number($('#seasonSelect').value) && value.episode === Number(element.dataset.downloadStatus));
      element.textContent = entry ? statusText(entry) : '';
      element.classList.toggle('active', entry?.status === 'downloading');
    });
  }
  detailPollTimer = setTimeout(updateDetailDownloads, 1800);
}
function resumeLabel(item) { const entries = Object.values(store.get('progress')); const entry = entries.find((x) => x.id === item.id && x.type === item.type); return entry?.time > 30 ? 'Devam Et' : 'Oynat'; }
function closeDetail() { detail.hidden = true; clearTimeout(detailPollTimer); app.hidden = false; requestAnimationFrame(() => window.scrollTo(0, detailReturnScroll)); }
function resumeFrom(entry) { const { season = 1, episode = 1, time = 0, duration: _duration, updated: _updated, ...item } = entry; play({ item, season, episode }, 'original', time); }
function playFromDetail(item) { const entry = Object.values(store.get('progress')).filter((value) => value && String(value.id) === String(item.id) && value.type === item.type && value.time > 10).sort((a, b) => (b.updated || 0) - (a.updated || 0))[0]; if (entry) return resumeFrom({ ...entry, ...item, season: entry.season, episode: entry.episode, time: entry.time }); play({ item, season: 1, episode: 1 }); }
function toggleList() { const list = store.get('myList'); const key = `${activeDetail.type}-${activeDetail.id}`; if (list[key]) { delete list[key]; toast('Listemden çıkarıldı'); } else { list[key] = activeDetail; toast('Listeme eklendi'); } store.set('myList', list); renderDetail(); }
async function loadEpisodes() {
  const season = Number($('#seasonSelect').value); const target = $('#episodeList'); target.innerHTML = '<div class="loading"><i></i></div>';
  const data = await api(`/api/season?id=${activeDetail.id}&season=${season}`); if (!data.ok) return target.innerHTML = escapeHtml(data.error);
  target.innerHTML = data.episodes.map((ep) => `<div class="episodeWrap"><button class="episode" data-episode="${ep.number}"><b>${ep.number}</b>${ep.still ? `<img loading="lazy" src="${ep.still}" alt="">` : '<span class="episodeStill"></span>'}<span><h3>${escapeHtml(ep.title || `${ep.number}. Bölüm`)}</h3><p>${escapeHtml(ep.overview || 'Bölüm açıklaması bulunmuyor.')}</p>${episodeProgress(activeDetail.id, season, ep.number)}<small class="episodeStatus" data-download-status="${ep.number}"></small></span></button><button class="episodeDownload" data-download-episode="${ep.number}" aria-label="${ep.number}. bölümü indir"><span>↓</span><span>İndir</span></button></div>`).join('');
  target.querySelectorAll('[data-episode]').forEach((el) => el.onclick = () => play({ item: activeDetail, season, episode: Number(el.dataset.episode) }));
  target.querySelectorAll('[data-download-episode]').forEach((el) => el.onclick = () => openDownload({ item: activeDetail, season, episode: Number(el.dataset.downloadEpisode) }));
  updateDetailDownloads();
}
function episodeProgress(id, season, episode) { const entry = store.get('progress')[`tv-${id}-${season}-${episode}`]; return entry?.duration ? `<div class="progress"><b style="width:${Math.min(100, entry.time / entry.duration * 100)}%"></b></div>` : ''; }
function quickPlay(item) { if (item.type === 'movie') return play({ item, season: 1, episode: 1 }); openDetail(item); }

async function play(context, source = 'original', keepTime = 0, forceRefresh = false) {
  const wasHidden = player.hidden;
  if (wasHidden) playerReturn = detail.hidden ? 'app' : 'detail';
  detail.hidden = true; app.hidden = true; player.hidden = false; setPlayerStatus('Video hazırlanıyor…'); enterPlayerFullscreen();
  const requestedKey = `${context.item.type}:${context.item.id}:${context.season || 1}:${context.episode || 1}`;
  if (!forceRefresh && source === 'original' && (wasHidden || requestedKey !== activeMediaKey)) {
    const lookup = ++playbackGeneration;
    const saved = await api('/api/downloads');
    if (lookup !== playbackGeneration) return;
    const offline = saved.ok && saved.downloads.filter((entry) => entry.status === 'complete' && String(entry.item.id) === String(context.item.id) && entry.item.type === context.item.type && (context.item.type !== 'tv' || Number(entry.season) === Number(context.season || 1) && Number(entry.episode) === Number(context.episode || 1))).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))[0];
    if (offline) return playOffline(offline);
  }
  if (current && !player.hidden) { saveProgress(); suppressProgressSave = true; video.pause(); suppressProgressSave = false; }
  const generation = ++playbackGeneration; const openingPlayer = player.hidden; const mediaKey = `${context.item.type}:${context.item.id}:${context.season}:${context.episode}`;
  if (mediaKey !== activeMediaKey) { activeMediaKey = mediaKey; originalAudioTracks = []; dubAvailable = false; pendingAudioLanguage = ''; activeSource = 'original'; }
  current = context; resumeApplied = false; streamRecoveryAttempted = forceRefresh; offlineAudioLabel = ''; if (openingPlayer) playerReturn = detail.hidden ? 'app' : 'detail'; detail.hidden = true; app.hidden = true; player.hidden = false; $('#episodePanel').hidden = true; $('#settingsPanel').hidden = true; showControls(); $('#playerTitle').textContent = context.item.title; $('#playerMeta').textContent = context.item.type === 'tv' ? `${context.season}. Sezon · ${context.episode}. Bölüm` : context.item.year || 'Film'; $('#playerTopTitle').textContent = $('#playerTitle').textContent; $('#playerTopMeta').textContent = $('#playerMeta').textContent;
  renderAudioOptions(source); $('#nextEpisode').hidden = context.item.type !== 'tv'; $('#episodeMenu').hidden = context.item.type !== 'tv'; setPlayerStatus(source === 'dub' ? 'Türkçe ses hazırlanıyor…' : 'Video hazırlanıyor…');
  const params = new URLSearchParams({ tmdbId: context.item.id, type: context.item.type, title: context.item.title, season: context.season, episode: context.episode });
  if (forceRefresh) params.set('refresh', '1');
  const result = await api(`${source === 'dub' ? '/api/dub' : '/api/resolve'}?${params}`); if (generation !== playbackGeneration) return;
  if (!result.ok) { renderAudioOptions(activeSource); setPlayerStatus(result.error, 'error'); return; }
  if (source === 'dub') dubAvailable = true; activeSource = source; startStream(result.streamUrl, keepTime, source); if (source === 'original') discoverDub(context, generation);
}
function enterPlayerFullscreen() { if (!document.fullscreenElement) player.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {}); }
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
  if (activeSource === 'offline') { $('#source').innerHTML = `<option value="offline">${escapeHtml(offlineAudioLabel || 'İndirilen ses')}</option>`; $('#source').disabled = true; return; }
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
  const original = normalizeAudioLanguage(current?.item?.originalLanguage || 'en'); const requested = normalizeAudioLanguage(pendingAudioLanguage || original);
  const chosen = originalAudioTracks.find((entry) => entry.language === requested) || originalAudioTracks.find((entry) => entry.language === original) || originalAudioTracks.find((entry) => entry.language === 'en') || originalAudioTracks.find((entry) => !['es', 'it'].includes(entry.language)) || originalAudioTracks[0];
  if (chosen) { hls.audioTrack = chosen.index; pendingAudioLanguage = ''; renderAudioOptions(`audio:${chosen.index}:${chosen.language}`); toast(`Ses: ${chosen.label}`); }
}
async function discoverDub(context, generation) {
  if (context.item.type !== 'tv') return; const params = new URLSearchParams({ tmdbId: context.item.id, type: context.item.type, title: context.item.title, season: context.season, episode: context.episode }); const result = await api(`/api/dub?${params}`);
  if (generation !== playbackGeneration || !result.ok) return; dubAvailable = true; renderAudioOptions();
}
function startStream(url, seekTime = 0, selectedSource = 'original') {
  pendingSeekCleanup?.();
  if (hls) hls.destroy(); suppressProgressSave = true; video.pause(); video.removeAttribute('src'); suppressProgressSave = false; $('#quality').innerHTML = '<option value="-1">Otomatik</option>'; $('#subtitle').innerHTML = '<option value="-1">Kapalı</option>'; updateQualityBadge();
  const stored = current ? store.get('progress')[progressKey()] : null;
  const target = seekTime > 0 ? seekTime : stored?.time > 10 ? stored.time : 0;
  const applySeek = () => {
    if (resumeApplied || !target) return;
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.readyState < 2) return;
    try { video.currentTime = Math.min(target, Math.max(0, video.duration - 2)); resumeApplied = true; pendingSeekCleanup?.(); }
    catch { /* Wait for seekable media. */ }
  };
  pendingSeekCleanup = () => { for (const event of ['loadedmetadata', 'durationchange', 'canplay', 'playing']) video.removeEventListener(event, applySeek); pendingSeekCleanup = null; };
  if (target) for (const event of ['loadedmetadata', 'durationchange', 'canplay', 'playing']) video.addEventListener(event, applySeek);
  else resumeApplied = true;
  if (Hls.isSupported() && /m3u8/i.test(url)) {
    hls = new Hls({ enableWorker: true, backBufferLength: 90 }); hls.loadSource(url); hls.attachMedia(video);
    const syncAudioTracks = (tracks = hls.audioTracks) => chooseEmbeddedAudio(tracks || [], selectedSource);
    hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      hls.levels.forEach((level, i) => $('#quality').add(new Option(`${level.height}p`, i)));
      syncSubtitles();
      syncAudioTracks(data?.audioTracks || hls.audioTracks);
      applySeek(); video.play().catch(() => {});
    });
    hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data) => syncAudioTracks(data?.audioTracks || hls.audioTracks));
    hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, syncSubtitles);
    hls.on(Hls.Events.SUBTITLE_FRAG_PROCESSED, positionSubtitleCues);
    hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_event, data) => { if (selectedSource !== 'original') return; const active = originalAudioTracks.find((entry) => entry.index === data.id); if (active) renderAudioOptions(`audio:${active.index}:${active.language}`); });
    hls.on(Hls.Events.ERROR, (_event, data) => { if (!data.fatal) return; if (activeSource === 'offline') { setPlayerStatus('İndirilen video açılamadı.', 'error'); return; } if (!streamRecoveryAttempted && current) { streamRecoveryAttempted = true; const retryTime = video.currentTime; toast('Yayın yenileniyor…'); play(current, activeSource, retryTime, true); } else setPlayerStatus('Video oynatılamadı. Başka bir ses seçeneğini deneyebilirsin.', 'error'); });
  } else { renderAudioOptions(selectedSource); video.src = url; video.play().catch(() => {}); }
}
function syncSubtitles() {
  const tracks = hls?.subtitleTracks || [];
  const selected = hls?.subtitleTrack ?? -1;
  $('#subtitle').innerHTML = '<option value="-1">Kapalı</option>' + tracks.map((track, index) => `<option value="${index}">${escapeHtml(track.name || track.lang || `Altyazı ${index + 1}`)}</option>`).join('');
  $('#subtitle').value = String(selected);
  $('#subtitleToggle').classList.toggle('isActive', selected >= 0);
  positionSubtitleCues();
}
function positionSubtitleCues() {
  for (const track of video.textTracks) {
    if (!track.cues) continue;
    for (const cue of track.cues) {
      if (positionedSubtitleCues.has(cue)) continue;
      try { cue.snapToLines = false; cue.line = 79; cue.position = 50; cue.align = 'center'; cue.size = 90; positionedSubtitleCues.add(cue); } catch { /* Some native cue types cannot be repositioned. */ }
    }
  }
}
function progressKey() { return current.item.type === 'tv' ? `tv-${current.item.id}-${current.season}-${current.episode}` : `movie-${current.item.id}`; }
function saveProgress() { if (suppressProgressSave || !current || !Number.isFinite(video.duration) || video.duration <= 0 || video.currentTime < 5) return; const entries = store.get('progress'); entries[progressKey()] = { ...current.item, season: current.season, episode: current.episode, time: video.currentTime, duration: video.duration, updated: Date.now() }; if (video.currentTime / video.duration > .95) delete entries[progressKey()]; store.set('progress', entries); }
function formatTime(seconds) { if (!Number.isFinite(seconds)) return '00:00'; const h = Math.floor(seconds / 3600); const m = Math.floor(seconds % 3600 / 60); const s = Math.floor(seconds % 60); return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
function setPlayerStatus(message = '', kind = 'loading') { $('#playerStatus').textContent = message; player.classList.toggle('loading', Boolean(message) && kind === 'loading'); player.classList.toggle('hasError', Boolean(message) && kind === 'error'); }
function updateControls() { const ratio = Number.isFinite(video.duration) && video.duration > 0 ? video.currentTime / video.duration : 0; seek.value = Math.round(ratio * 1000); seek.style.setProperty('--value', `${ratio * 100}%`); $('#currentTime').textContent = formatTime(video.currentTime); $('#duration').textContent = formatTime(video.duration); if (Number.isFinite(video.duration) && video.duration > 0) { const end = new Date(Date.now() + Math.max(0, video.duration - video.currentTime) / video.playbackRate * 1000); $('#endTime').textContent = `Bitiş ${end.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`; } else $('#endTime').textContent = ''; }
function updateQualityBadge() { $('#qualityBadge').textContent = $('#quality').value === '-1' ? 'AUTO' : ($('#quality').selectedOptions[0]?.textContent || 'AUTO').toUpperCase(); }
function openPlayerSetting(mode) { const panel = $('#settingsPanel'); const opening = panel.hidden || panel.dataset.mode !== mode; $('#episodePanel').hidden = true; panel.dataset.mode = mode; panel.hidden = !opening; showControls(); if (opening) $(`#${mode} select`)?.focus(); }
function updatePlayState() { player.classList.toggle('isPlaying', !video.paused); playToggle.setAttribute('aria-label', video.paused ? 'Oynat' : 'Duraklat'); }
function togglePlayback() { if (!video.src && !hls) return; video.paused ? video.play().catch(() => {}) : video.pause(); showControls(); }
function showControls() { player.classList.add('controlsVisible'); clearTimeout(controlsTimer); if (!video.paused && $('#settingsPanel').hidden && $('#episodePanel').hidden) controlsTimer = setTimeout(() => player.classList.remove('controlsVisible'), 2800); }

async function loadPlayerEpisodes(season) {
  const list = $('#playerEpisodeList'); list.innerHTML = '<div class="panelLoading"><i></i><span>Bölümler hazırlanıyor</span></div>';
  const data = await api(`/api/season?id=${current.item.id}&season=${season}`); if (!data.ok) { list.innerHTML = `<div class="panelLoading"><span>${escapeHtml(data.error)}</span></div>`; return; }
  list.innerHTML = data.episodes.map((episode) => `<button class="playerEpisode${Number(season) === Number(current.season) && episode.number === Number(current.episode) ? ' active' : ''}" data-player-episode="${episode.number}">${episode.still ? `<img src="${episode.still}" alt="">` : '<span class="episodeStill"></span>'}<span><b>${episode.number}. ${escapeHtml(episode.title || 'Bölüm')}</b><small>${episode.runtime ? `${episode.runtime} dk` : ''}</small><em>${escapeHtml(episode.overview || '')}</em></span></button>`).join('');
  list.querySelectorAll('[data-player-episode]').forEach((button) => button.onclick = () => { $('#episodePanel').hidden = true; play({ item: current.item, season: Number(season), episode: Number(button.dataset.playerEpisode) }, activeSource, 0); });
}
function loadOfflinePlayerEpisodes(season) {
  const list = $('#playerEpisodeList');
  list.innerHTML = offlineSeriesEntries.filter((entry) => Number(entry.season) === Number(season)).map((entry) => `<button class="playerEpisode${Number(entry.season) === Number(current.season) && Number(entry.episode) === Number(current.episode) ? ' active' : ''}" data-offline-episode="${escapeHtml(entry.id)}"><span class="episodeStill"></span><span><b>${entry.episode}. Bölüm</b><small>İndirildi</small><em>${escapeHtml(entry.audioLabel || 'Çevrimdışı')}</em></span></button>`).join('');
  list.querySelectorAll('[data-offline-episode]').forEach((button) => button.onclick = () => { const entry = offlineSeriesEntries.find((value) => value.id === button.dataset.offlineEpisode); if (entry) { $('#episodePanel').hidden = true; playOffline(entry); } });
}
async function openEpisodePanel() {
  if (!current || current.item.type !== 'tv') return; $('#settingsPanel').hidden = true; $('#episodePanel').hidden = false; $('#episodePanelTitle').textContent = current.item.title; showControls();
  if (activeSource === 'offline') { const seasons = [...new Set(offlineSeriesEntries.map((entry) => Number(entry.season)))]; $('#playerSeasonSelect').innerHTML = seasons.map((season) => `<option value="${season}">${season}. Sezon</option>`).join(''); $('#playerSeasonSelect').value = String(current.season); loadOfflinePlayerEpisodes(current.season); return; }
  const details = await api(`/api/details?id=${current.item.id}&type=tv`); if (!details.ok || $('#episodePanel').hidden) return;
  current.item = { ...current.item, ...details.item }; const seasons = details.item.seasons || []; $('#playerSeasonSelect').innerHTML = seasons.map((season) => `<option value="${season.season_number}">${escapeHtml(season.name)}</option>`).join(''); $('#playerSeasonSelect').value = String(current.season); await loadPlayerEpisodes(current.season);
}

document.querySelectorAll('[data-nav]').forEach((button) => button.onclick = () => { detail.hidden = true; app.hidden = false; window.scrollTo(0, 0); document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b.dataset.nav === button.dataset.nav)); if (button.dataset.nav === 'home') home(); else if (button.dataset.nav === 'list') listPage(); else if (button.dataset.nav === 'downloads') downloadsPage(); else browse(button.dataset.nav); });
$('#closeDownload').onclick = () => { $('#downloadDialog').hidden = true; downloadContext = null; };
$('#downloadDialog').onclick = (event) => { if (event.target === $('#downloadDialog')) $('#closeDownload').click(); };
$('#downloadAudio').onchange = updateDownloadChoices;
$('#confirmDownload').onclick = async () => {
  if (!downloadContext || !downloadToken || !$('#downloadAudio').value) return;
  const button = $('#confirmDownload'); button.disabled = true; button.textContent = 'Başlatılıyor…';
  const result = await apiPost('/api/download/start', { token: downloadToken, audioId: $('#downloadAudio').value, subtitleId: $('#downloadSubtitle').value, item: downloadContext.item, season: downloadContext.season, episode: downloadContext.episode });
  button.textContent = 'İndir';
  if (!result.ok) { $('#downloadHint').textContent = result.error; button.disabled = false; return; }
  $('#closeDownload').click(); toast('İndirme başladı. İndirilenler bölümünden izleyebilirsin.'); updateDetailDownloads();
};
$('#searchForm').onsubmit = (event) => { event.preventDefault(); const query = $('#query').value.trim(); if (query) { detail.hidden = true; app.hidden = false; window.scrollTo(0, 0); search(query); } };
window.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#query').focus(); $('#query').select(); } });
$('[data-close]').onclick = closeDetail; $('#back').onclick = async () => { playbackGeneration += 1; saveProgress(); video.pause(); pendingSeekCleanup?.(); if (hls) hls.destroy(); hls = null; video.removeAttribute('src'); $('#episodePanel').hidden = true; if (document.fullscreenElement) await document.exitFullscreen?.(); player.hidden = true; player.classList.remove('controlsVisible'); current = null; if (playerReturn === 'detail') { detail.hidden = false; app.hidden = true; updateDetailDownloads(); } else { detail.hidden = true; app.hidden = false; if (document.querySelector('[data-nav="downloads"].active')) downloadsPage(); } };
$('#source').onchange = () => { const value = $('#source').value; const label = $('#source').selectedOptions[0]?.textContent || ''; const keepTime = video.currentTime; $('#settingsPanel').hidden = true; if (value.startsWith('audio:')) { const [, index, language] = value.split(':'); store.set('preferredAudioLanguage', language || label); if (activeSource === 'original' && hls) { hls.audioTrack = Number(index); toast(`Ses: ${label}`); } else { pendingAudioLanguage = language || label; play(current, 'original', keepTime); } return; } if (value === 'dub') { store.set('preferredAudioLanguage', 'tr'); play(current, 'dub', keepTime); return; } store.set('preferredAudioLanguage', current?.item?.originalLanguage || 'en'); if (activeSource !== 'original') play(current, 'original', keepTime); }; $('#quality').onchange = () => { if (hls) hls.currentLevel = Number($('#quality').value); updateQualityBadge(); $('#settingsPanel').hidden = true; };
$('#subtitle').onchange = () => { const index = Number($('#subtitle').value); if (hls) { hls.subtitleDisplay = index >= 0; hls.subtitleTrack = index; } else for (const [trackIndex, track] of [...video.textTracks].entries()) track.mode = trackIndex === index ? 'showing' : 'disabled'; positionSubtitleCues(); $('#subtitleToggle').classList.toggle('isActive', index >= 0); $('#settingsPanel').hidden = true; showControls(); };
$('#speedToggle').onclick = () => { const index = playbackSpeeds.indexOf(video.playbackRate); video.playbackRate = playbackSpeeds[(index + 1) % playbackSpeeds.length]; $('#speedToggle').textContent = `${video.playbackRate}x`; $('#speedToggle').setAttribute('aria-label', `Oynatma hızı: ${video.playbackRate}x`); updateControls(); showControls(); };
$('#fitToggle').onclick = () => { playerFit = playerFit === 'contain' ? 'cover' : 'contain'; video.style.objectFit = playerFit; $('#fitToggle').classList.toggle('isActive', playerFit === 'cover'); $('#fitToggle').setAttribute('aria-label', playerFit === 'cover' ? 'Görüntüyü sığdır' : 'Görüntüyü doldur'); toast(playerFit === 'cover' ? 'Görüntü ekranı dolduruyor' : 'Görüntü ekrana sığdırıldı'); showControls(); };
$('#audioToggle').onclick = () => openPlayerSetting('audioSetting'); $('#subtitleToggle').onclick = () => openPlayerSetting('subtitleSetting'); $('#qualityToggle').onclick = () => openPlayerSetting('qualitySetting');
playToggle.onclick = togglePlayback; video.onclick = togglePlayback; $('#rewind').onclick = () => { video.currentTime = Math.max(0, video.currentTime - 10); showControls(); }; $('#forward').onclick = () => { video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10); showControls(); };
seek.oninput = () => { if (video.duration) video.currentTime = Number(seek.value) / 1000 * video.duration; updateControls(); }; volume.oninput = () => { video.volume = Number(volume.value); video.muted = false; volume.style.setProperty('--value', `${video.volume * 100}%`); player.classList.toggle('isMuted', !video.volume); }; $('#mute').onclick = () => { video.muted = !video.muted; player.classList.toggle('isMuted', video.muted); };
$('#fullscreen').onclick = async () => { try { if (!document.fullscreenElement) await player.requestFullscreen?.({ navigationUI: 'hide' }); else await document.exitFullscreen?.(); } catch (error) { toast(`Tam ekran açılamadı: ${error.message}`); } showControls(); };
document.addEventListener('fullscreenchange', () => { const active = document.fullscreenElement === player; player.classList.toggle('isFullscreen', active); $('#fullscreen').setAttribute('aria-label', active ? 'Tam ekrandan çık' : 'Tam ekran'); showControls(); });
$('#nextEpisode').onclick = () => { if (current?.item.type !== 'tv') return; if (activeSource === 'offline') { const entry = offlineSeriesEntries.find((value) => Number(value.season) === Number(current.season) && Number(value.episode) === Number(current.episode) + 1); if (entry) playOffline(entry); } else play({ ...current, episode: current.episode + 1 }, activeSource, 0); };
$('#episodeMenu').onclick = openEpisodePanel; $('#closeEpisodePanel').onclick = () => { $('#episodePanel').hidden = true; showControls(); }; $('#playerSeasonSelect').onchange = () => activeSource === 'offline' ? loadOfflinePlayerEpisodes(Number($('#playerSeasonSelect').value)) : loadPlayerEpisodes(Number($('#playerSeasonSelect').value));
player.onmousemove = showControls; player.onmouseleave = () => { if (!video.paused) player.classList.remove('controlsVisible'); };
video.addEventListener('playing', () => { setPlayerStatus(''); updatePlayState(); showControls(); }); video.addEventListener('loadeddata', () => { if (video.readyState >= 2) setPlayerStatus(''); }); video.addEventListener('canplay', () => { if (video.readyState >= 2) setPlayerStatus(''); }); video.addEventListener('error', () => { if (!player.hidden) setPlayerStatus('Video açılamadı. Dosyayı veya yayını kontrol edin.', 'error'); }); video.addEventListener('play', updatePlayState); video.addEventListener('pause', () => { updatePlayState(); showControls(); }); video.addEventListener('timeupdate', updateControls); video.addEventListener('durationchange', updateControls);
video.textTracks.addEventListener?.('addtrack', (event) => { event.track?.addEventListener('cuechange', positionSubtitleCues); positionSubtitleCues(); });
video.addEventListener('pause', saveProgress); window.addEventListener('beforeunload', saveProgress); setInterval(saveProgress, 10000);
window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('#deleteDialog').hidden) { $('#cancelDelete').click(); return; } if (player.hidden || ['INPUT', 'SELECT', 'BUTTON'].includes(document.activeElement?.tagName)) return; if (event.code === 'Space' || event.key === 'Enter') { event.preventDefault(); togglePlayback(); } else if (event.key === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 10); else if (event.key === 'ArrowRight') video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10); else if (event.key === 'ArrowUp') { event.preventDefault(); video.volume = Math.min(1, video.volume + .1); volume.value = video.volume; } else if (event.key === 'ArrowDown') { event.preventDefault(); video.volume = Math.max(0, video.volume - .1); volume.value = video.volume; } else if (event.key.toLowerCase() === 'm') $('#mute').click(); else if (event.key.toLowerCase() === 'f') $('#fullscreen').click(); showControls(); });
function enableHotReload() {
  if (!new URLSearchParams(location.search).has('dev')) return;
  let connected = false; let disconnected = false;
  const events = new EventSource('/__hot_reload');
  events.addEventListener('connected', () => { if (connected && disconnected) location.reload(); connected = true; disconnected = false; console.info('[Maxen Dev] Hot reload bağlı'); });
  events.addEventListener('reload', (event) => {
    if (String(event.data).endsWith('.css')) {
      const stylesheet = [...document.querySelectorAll('link[rel="stylesheet"]')].find((link) => link.href.includes(event.data));
      if (stylesheet) stylesheet.href = `${event.data}?t=${Date.now()}`;
    } else location.reload();
  });
  events.onerror = () => { if (connected) disconnected = true; };
}
enableHotReload();
home();
