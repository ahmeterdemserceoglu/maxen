const $ = (selector) => document.querySelector(selector);
const app = $('#app'); const detail = $('#detail'); const video = $('#video'); const player = $('#player');
const seek = $('#seek'); const volume = $('#volume'); const playToggle = $('#playToggle');
const store = { get: (key, fallback = {}) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }, set: (key, value) => localStorage.setItem(key, JSON.stringify(value)) };
if (window.maxenDesktop) {
  document.body.classList.add('desktop');
  document.querySelectorAll('[data-window-action]').forEach((button) => button.onclick = () => window.maxenDesktop.windowAction(button.dataset.windowAction));
  window.maxenDesktop.onWindowState((isMaximized) => {
    const maxBtn = document.querySelector('[data-window-action="maximize"]');
    if (maxBtn) {
      maxBtn.setAttribute('aria-label', isMaximized ? 'Geri al' : 'Büyüt');
      maxBtn.setAttribute('title', isMaximized ? 'Geri al' : 'Büyüt');
      maxBtn.innerHTML = isMaximized
        ? '<svg viewBox="0 0 20 20"><path d="M6.5 4.5h9v9M4.5 6.5h9v9h-9z"/></svg>'
        : '<svg viewBox="0 0 20 20"><rect x="4.5" y="4.5" width="11" height="11" rx="1"/></svg>';
    }
  });
}
let hls; let current; let activeDetail; let resumeApplied = false; let toastTimer; let controlsTimer; let playbackGeneration = 0; let activeSource = 'original'; let detailReturnScroll = 0; let playerReturn = 'app'; let streamRecoveryAttempted = false; let activeMediaKey = ''; let originalAudioTracks = []; let dubAvailable = false; let pendingAudioLanguage = ''; let offlineAudioLabel = ''; let pendingSeekCleanup; let suppressProgressSave = false;
let isDraggingSeek = false;
let offlineSeriesEntries = [];
let viewRequest = 0;
const playbackSpeeds = [0.75, 1, 1.25, 1.5, 2];
const positionedSubtitleCues = new WeakSet();
let playerFit = 'contain';
let nextBannerTimer = null;
let nextBannerDismissed = false;
let nextBannerActive = false;
let volumeHudTimer = null;
let subtitleOffset = 0;
const subtitleSizes = { small: '18px', medium: '23px', large: '28px', xlarge: '34px' };

function clearNextBanner() {
  if (nextBannerTimer) { clearInterval(nextBannerTimer); nextBannerTimer = null; }
  nextBannerActive = false;
  nextBannerDismissed = false;
  const banner = $('#nextEpisodeBanner');
  if (banner) banner.hidden = true;
}

function startNextEpisodeCountdown() {
  if (!current || nextBannerActive) return;
  nextBannerActive = true;
  const banner = $('#nextEpisodeBanner');
  if (!banner) return;
  const nextSeason = current.season || 1;
  const nextEp = Number(current.episode || 1) + 1;
  $('#nextBannerTitle').textContent = `${current.item.title} · S${nextSeason} B${nextEp}`;
  let secondsRemaining = 10;
  $('#nextBannerCountdown').textContent = `${secondsRemaining} sn sonra başlıyor`;
  banner.hidden = false;
  if (nextBannerTimer) clearInterval(nextBannerTimer);
  nextBannerTimer = setInterval(() => {
    secondsRemaining -= 1;
    if (secondsRemaining <= 0) {
      clearInterval(nextBannerTimer);
      nextBannerTimer = null;
      banner.hidden = true;
      $('#nextEpisode').click();
    } else {
      $('#nextBannerCountdown').textContent = `${secondsRemaining} sn sonra başlıyor`;
    }
  }, 1000);
}

function showVolumeHud(pct) {
  const hud = $('#volumeHud');
  const text = $('#volumeHudText');
  if (!hud || !text) return;
  text.textContent = `%${Math.round(pct)}`;
  hud.hidden = false;
  if (volumeHudTimer) clearTimeout(volumeHudTimer);
  volumeHudTimer = setTimeout(() => { hud.hidden = true; }, 900);
}

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

const tmdbGenreNames = {
  28: 'Aksiyon', 12: 'Macera', 16: 'Animasyon', 35: 'Komedi', 80: 'Suç',
  99: 'Belgesel', 18: 'Dram', 10751: 'Aile', 14: 'Fantastik', 36: 'Tarih',
  27: 'Korku', 10402: 'Müzik', 9648: 'Gizem', 10749: 'Romantik', 878: 'Bilim Kurgu',
  10770: 'TV Film', 53: 'Gerilim', 10752: 'Savaş', 37: 'Western',
  10759: 'Aksiyon & Macera', 10762: 'Çocuk', 10763: 'Haber', 10764: 'Reality',
  10765: 'Bilim Kurgu & Fantazi', 10766: 'Pembe Dizi', 10767: 'Sohbet', 10768: 'Savaş & Politika'
};

function getCardGenres(item) {
  if (Array.isArray(item.genres) && item.genres.length) {
    return item.genres.slice(0, 2).join(' • ');
  }
  if (Array.isArray(item.genre_ids) && item.genre_ids.length) {
    const mapped = item.genre_ids.map((id) => tmdbGenreNames[id]).filter(Boolean);
    if (mapped.length) return mapped.slice(0, 2).join(' • ');
  }
  return item.type === 'tv' ? 'Dizi • Popüler' : 'Sinema • Seçki';
}

function getCardDuration(item) {
  if (item.type === 'tv') {
    return item.seasons ? `${item.seasons} Sezon` : 'Dizi';
  }
  if (item.runtime) {
    const h = Math.floor(item.runtime / 60);
    const m = item.runtime % 60;
    return h > 0 ? `${h} sa ${m ? `${m} dk` : ''}`.trim() : `${m} dk`;
  }
  return '2 sa 18 dk';
}

function toggleCardList(item, btn) {
  const list = store.get('myList', {});
  const key = `${item.type}-${item.id}`;
  let inList = false;
  if (list[key]) {
    delete list[key];
    store.set('myList', list);
    toast(`“${item.title}” Listemden çıkarıldı`);
    inList = false;
  } else {
    list[key] = item;
    store.set('myList', list);
    toast(`“${item.title}” Listeme eklendi`);
    inList = true;
  }
  if (btn) {
    btn.classList.toggle('inList', inList);
    btn.title = inList ? 'Listemden Çıkar' : 'Listeme Ekle';
    btn.innerHTML = inList
      ? '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.6" d="M5 13l4 4L19 7"/></svg>'
      : '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.6" d="M12 5v14m-7-7h14"/></svg>';
  }
  return inList;
}

function card(item, resume = false) {
  const myList = store.get('myList', {});
  const inList = Boolean(myList[`${item.type}-${item.id}`]);
  const ratingVal = item.rating && Number(item.rating) > 0 ? item.rating : '8.7';
  const yearVal = item.year || '2024';
  const durationVal = getCardDuration(item);
  const genresVal = getCardGenres(item);
  const overviewVal = escapeHtml(item.overview ? (item.overview.length > 95 ? item.overview.slice(0, 92) + '…' : item.overview) : (item.type === 'tv' ? 'Dünya çapında en çok ilgi gören ve beğenilen dizi.' : 'Sinema dünyasının en çok ses getiren ve izlenen başyapıtı.'));
  const titleVal = escapeHtml(item.title || 'İsimsiz İçerik');

  return `
    <article class="card neonCard" data-resume="${resume}" data-item='${escapeHtml(JSON.stringify(item))}'>
      <div class="cardPosterWrap">
        ${item.poster ? `<img loading="lazy" class="cardPoster" src="${item.poster}" alt="${titleVal}">` : '<div class="placeholder"><span>M</span></div>'}
        <div class="cardShade"></div>
        <button class="cardCornerInfoBtn" data-card-info title="Detayları Gör">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.2" stroke="currentColor" stroke-width="1.75" fill="none"/><line x1="12" y1="10.8" x2="12" y2="16.2" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><circle cx="12" cy="7.8" r="1.1" fill="currentColor"/></svg>
        </button>
      </div>
      <div class="cardBody">
        <div class="cardPrimaryInfo">
          <h3 class="cardTitle" title="${titleVal}">${titleVal}</h3>
          <span class="cardRatingBadge"><svg class="starIcon" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> ${ratingVal}</span>
        </div>
        <div class="cardExpandContent">
          <p class="cardOverview">${overviewVal}</p>
          <div class="cardMetaRow">
            <span class="cardYear">${yearVal}</span>
            <span class="cardDivider">|</span>
            <span class="cardDuration">${durationVal}</span>
            <span class="cardDivider">|</span>
            <span class="cardGenres">${genresVal}</span>
          </div>
          <div class="cardActionRow">
            <button class="cardPlayBtn" data-card-play>
              <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              <span>${resume ? 'Devam Et' : 'Şimdi izle'}</span>
            </button>
            <button class="cardIconBtn cardListBtn${inList ? ' inList' : ''}" data-card-list title="${inList ? 'Listemden Çıkar' : 'Listeme Ekle'}">
              ${inList
                ? '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.6" d="M5 13l4 4L19 7"/></svg>'
                : '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.6" d="M12 5v14m-7-7h14"/></svg>'}
            </button>
          </div>
        </div>
        ${progressBar(item)}
      </div>
    </article>
  `;
}

function progressBar(item) {
  const entries = store.get('progress');
  const entry = Object.values(entries).filter(Boolean).find((x) => x.id === item.id && x.type === item.type);
  return entry?.duration ? `<div class="progress"><b style="width:${Math.min(100, entry.time / entry.duration * 100)}%"></b></div>` : '';
}

function bindCards(root = document) {
  root.querySelectorAll('.card[data-item]').forEach((el) => {
    el.onclick = (e) => {
      if (e.target.closest('button')) return;
      const item = JSON.parse(el.dataset.item);
      el.dataset.resume === 'true' ? resumeFrom(item) : openDetail(item);
    };

    el.querySelectorAll('[data-card-play]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const item = JSON.parse(el.dataset.item);
        if (el.dataset.resume === 'true') {
          resumeFrom(item);
        } else {
          quickPlay(item);
        }
      };
    });

    el.querySelectorAll('[data-card-list]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const item = JSON.parse(el.dataset.item);
        toggleCardList(item, btn);
      };
    });

    el.querySelectorAll('[data-card-info]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const item = JSON.parse(el.dataset.item);
        openDetail(item);
      };
    });
  });
}

let currentNav = 'home';
const tabScrolls = { home: 0, movie: 0, tv: 0, list: 0, downloads: 0, search: 0 };
const tabReady = { home: false, movie: false, tv: false, list: false, downloads: false, search: false };

function getTabEl(nav) {
  const initialLoading = app.querySelector(':scope > .loading');
  if (initialLoading) initialLoading.remove();
  let el = document.getElementById(`tabView-${nav}`);
  if (!el) {
    el = document.createElement('div');
    el.id = `tabView-${nav}`;
    el.className = 'tabView';
    if (nav !== 'home') el.hidden = true;
    app.appendChild(el);
  }
  return el;
}

function showTab(nav) {
  app.querySelectorAll(':scope > .loading').forEach((e) => e.remove());
  document.querySelectorAll('.tabView').forEach((view) => {
    view.hidden = (view.id !== `tabView-${nav}`);
  });
}


async function home(targetContainer = null) {
  const container = targetContainer || getTabEl('home');
  showTab('home');
  if (tabReady.home && !targetContainer) {
    window.scrollTo(0, tabScrolls.home || 0);
    return;
  }
  const request = ++viewRequest;
  container.innerHTML = '<div class="loading"><i></i><span>Ana sayfa hazırlanıyor</span></div>';
  const data = await api('/api/home');
  if (request !== viewRequest) return;
  if (!data.ok) return showError(data.error, container);
  if (data.offline) return offlineHome(data.downloads || [], container);
  const continueItems = Object.values(store.get('progress')).filter((x) => x && x.duration && x.time / x.duration < .95).sort((a, b) => b.updated - a.updated);
  container.innerHTML = `<section class="hero" style="background-image:url('${data.hero.backdrop || ''}')"><div class="heroContent"><span class="eyebrow"><i></i> MAXEN SEÇKİSİ</span><h1>${escapeHtml(data.hero.title)}</h1><div class="meta">${meta(data.hero)}<span class="ageBadge">13+</span></div><p>${escapeHtml(data.hero.overview)}</p><div class="actions"><button class="primary" id="heroPlay"><span>▶</span> Şimdi İzle</button><button class="secondary" id="heroInfo"><span>ⓘ</span> Detaylar</button></div></div><div class="heroIndex"><span>BUGÜN</span><strong>01</strong></div><div class="scrollCue">KEŞFET <b>↓</b></div></section><div class="catalog">${continueItems.length ? row('İzlemeye Devam Et', continueItems, 'Kaldığın yerden', true) : ''}${data.sections.map((s, index) => row(s.title, s.items, index === 0 ? 'Şu an en çok izlenenler' : '')).join('')}</div>`;
  container.querySelector('#heroInfo').onclick = () => openDetail(data.hero);
  container.querySelector('#heroPlay').onclick = () => quickPlay(data.hero);
  bindCards(container);
  tabReady.home = true;
  window.scrollTo(0, tabScrolls.home || 0);
}

function offlineHome(entries, targetContainer = null) {
  const container = targetContainer || getTabEl('home');
  const complete = entries.filter((entry) => entry.status === 'complete');
  container.innerHTML = `<section class="gridPage offlinePage"><div class="offlineIntro"><span class="eyebrow">ÇEVRİMDIŞI MOD</span><h1>İndirdiklerin hazır</h1><p>İnternet bağlantısı olmadan indirdiğin filmleri ve bölümleri izleyebilirsin.</p><div class="actions"><button class="primary" id="offlineDownloadsButton">İndirilenler</button><button class="secondary" id="retryHomeButton">Bağlantıyı yeniden dene</button></div></div><div id="offlineDownloads" class="downloadsList"></div></section>`;
  container.querySelector('#offlineDownloadsButton').onclick = () => selectNav('downloads');
  container.querySelector('#retryHomeButton').onclick = () => { tabReady.home = false; home(container); };
  renderDownloadEntries(container.querySelector('#offlineDownloads'), complete, 'Bu bilgisayarda henüz tamamlanmış indirme yok.', complete.length === 0);
}

function row(title, items, subtitle = '', resume = false) { return `<section class="row"><div class="rowHead"><div><h2>${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div><span>${items.length} içerik</span></div><div class="cards">${items.map((item) => card(item, resume)).join('')}</div></section>`; }
function showError(message, targetContainer = app) { targetContainer.innerHTML = `<div class="loading"><strong>Bir şeyler ters gitti</strong><span>${escapeHtml(message)}</span><button class="primary" onclick="location.reload()">Tekrar dene</button></div>`; }

const movieGenres = [
  { id: '', name: 'Tümü' },
  { id: '28', name: 'Aksiyon' },
  { id: '35', name: 'Komedi' },
  { id: '18', name: 'Dram' },
  { id: '878', name: 'Bilim Kurgu' },
  { id: '27', name: 'Korku' },
  { id: '53', name: 'Gerilim' },
  { id: '16', name: 'Animasyon' },
  { id: '10749', name: 'Romantik' }
];

const tvGenres = [
  { id: '', name: 'Tümü' },
  { id: '10759', name: 'Aksiyon & Macera' },
  { id: '35', name: 'Komedi' },
  { id: '18', name: 'Dram' },
  { id: '10765', name: 'Bilim Kurgu' },
  { id: '80', name: 'Suç' },
  { id: '9648', name: 'Gizem' },
  { id: '16', name: 'Animasyon' }
];

let currentBrowse = { type: 'movie', genre: '', sortBy: 'popularity.desc', page: 1, totalPages: 1, loading: false };

async function browse(type, genre = '', sortBy = 'popularity.desc', page = 1, append = false, targetContainer = null) {
  const container = targetContainer || getTabEl(type);
  showTab(type);

  const isDefaultBrowse = !genre && sortBy === 'popularity.desc' && page === 1;
  if (!append && isDefaultBrowse && tabReady[type] && !targetContainer) {
    window.scrollTo(0, tabScrolls[type] || 0);
    return;
  }

  if (currentBrowse.loading && append) return;
  currentBrowse.loading = true;
  const request = ++viewRequest;

  if (!append) {
    currentBrowse = { type, genre, sortBy, page: 1, totalPages: 1, loading: true };
    container.innerHTML = '<div class="loading"><i></i><span>Katalog hazırlanıyor…</span></div>';
  } else {
    currentBrowse.page = page;
    const btn = container.querySelector('#loadMoreCatalog') || $('#loadMoreCatalog');
    if (btn) { btn.disabled = true; btn.textContent = 'Yükleniyor…'; }
  }

  const isMainLanding = !genre && sortBy === 'popularity.desc';
  let catalogData = null;
  if (!append && isMainLanding) {
    const catRes = await api(`/api/catalog?type=${type}`);
    if (catRes.ok) catalogData = catRes;
  }

  const query = new URLSearchParams({ type, page: String(page), sort_by: sortBy });
  if (genre) query.set('genre', genre);
  const data = await api(`/api/discover?${query}`);
  if (request !== viewRequest) return;
  currentBrowse.loading = false;
  if (!data.ok) return showError(data.error, container);

  currentBrowse.totalPages = data.totalPages || 1;
  const genres = type === 'tv' ? tvGenres : movieGenres;
  const activeGenreObj = genres.find((g) => g.id === genre) || genres[0];
  const hero = catalogData?.hero || data.hero || data.results[0];

  if (!append) {
    const heroHtml = hero ? `
      <section class="hero" style="background-image:url('${hero.backdrop || hero.poster || ''}')">
        <div class="heroContent">
          <span class="eyebrow"><i></i> MAXEN ${type === 'tv' ? 'DİZİ' : 'FİLM'} SEÇKİSİ</span>
          <h1>${escapeHtml(hero.title)}</h1>
          <div class="meta">${meta(hero)}<span class="ageBadge">13+</span></div>
          <p>${escapeHtml(hero.overview || (type === 'tv' ? 'Dünya çapında en çok ilgi gören ve beğenilen popüler diziler.' : 'Sinema dünyasının en çok izlenen ve ses getiren filmleri.'))}</p>
          <div class="actions">
            <button class="primary" id="catalogHeroPlay"><span>▶</span> Hemen İzle</button>
            <button class="secondary" id="catalogHeroInfo">ⓘ Detaylar</button>
          </div>
        </div>
        <div class="heroIndex"><span>${type === 'tv' ? 'DİZİ' : 'FİLM'}</span><strong>TOP</strong></div>
        <div class="scrollCue">${type === 'tv' ? 'DİZİLER' : 'FİLMLER'} <b>↓</b></div>
      </section>
    ` : '';

    const sortOptions = [
      { id: 'popularity.desc', label: 'En Popüler Yapımlar' },
      { id: 'vote_average.desc', label: 'En Çok Beğenilenler (IMDb)' },
      { id: 'release_date.desc', label: 'En Yeni Çıkanlar' }
    ];

    const toolbarHtml = `
      <div class="catalogToolbar">
        <div class="genreChips">
          ${genres.map((g) => `<button class="genreChip${g.id === genre ? ' active' : ''}" data-genre="${g.id}">${g.name}</button>`).join('')}
        </div>
        <div class="sortSelectorWrap">
          <label for="catalogSort">Sıralama:</label>
          <select id="catalogSort">
            ${sortOptions.map((opt) => `<option value="${opt.id}"${opt.id === sortBy ? ' selected' : ''}>${opt.label}</option>`).join('')}
          </select>
        </div>
      </div>
    `;


    let shelvesHtml = '';
    if (isMainLanding && catalogData?.sections?.length) {
      shelvesHtml = catalogData.sections.map((s) => row(s.title, s.items, s.subtitle)).join('');
    }

    const sectionTitle = genre
      ? `${activeGenreObj.name} ${type === 'tv' ? 'Dizileri' : 'Filmleri'}`
      : `Tüm ${type === 'tv' ? 'Dizi' : 'Film'} Kataloğu`;

    const sectionSubtitle = sortBy === 'vote_average.desc'
      ? 'IMDb ve TMDB puanına göre en yüksekten en düşüğe'
      : sortBy === 'release_date.desc'
        ? 'Vizyona ve yayına giriş tarihine göre en yeniden eskiye'
        : 'Popülerliğe göre listeleniyor';

    const sectionHeaderHtml = `
      <div class="catalogSectionHeader">
        <h2>${sectionTitle}</h2>
        <p>${sectionSubtitle}</p>
      </div>
    `;

    const loadMoreHtml = currentBrowse.page < currentBrowse.totalPages
      ? '<div class="loadMoreWrap"><button id="loadMoreCatalog" class="loadMoreBtn">Daha Fazla Göster</button></div>'
      : '';

    container.innerHTML = `
      ${heroHtml}
      <div class="catalog"${!hero ? ' style="margin-top:20px"' : ''}>
        ${toolbarHtml}
        ${shelvesHtml}
        ${sectionHeaderHtml}
        <div style="width:min(100% - 40px, 1240px);margin:0 auto">
          <div id="catalogGrid" class="grid">${data.results.map((item) => card(item)).join('')}</div>
        </div>
        ${loadMoreHtml}
      </div>
    `;

    if (hero) {
      container.querySelector('#catalogHeroPlay')?.addEventListener('click', () => quickPlay(hero));
      container.querySelector('#catalogHeroInfo')?.addEventListener('click', () => openDetail(hero));
    }

    container.querySelectorAll('.genreChip').forEach((chip) => {
      chip.onclick = () => {
        browse(type, chip.dataset.genre, currentBrowse.sortBy, 1, false, container);
      };
    });

    const sortSelect = container.querySelector('#catalogSort');
    if (sortSelect) {
      sortSelect.onchange = () => {
        browse(type, currentBrowse.genre, sortSelect.value, 1, false, container);
      };
    }

    if (isDefaultBrowse) tabReady[type] = true;
    window.scrollTo(0, tabScrolls[type] || 0);
  } else {
    const grid = container.querySelector('#catalogGrid');
    if (grid) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = data.results.map((item) => card(item)).join('');
      while (tempDiv.firstChild) {
        grid.appendChild(tempDiv.firstChild);
      }
    }
    const loadMoreWrap = container.querySelector('.loadMoreWrap');
    if (loadMoreWrap) {
      if (currentBrowse.page >= currentBrowse.totalPages) {
        loadMoreWrap.remove();
      } else {
        const btn = container.querySelector('#loadMoreCatalog');
        if (btn) { btn.disabled = false; btn.textContent = 'Daha Fazla Göster'; }
      }
    }
  }

  bindCards(container);
  const loadMoreBtn = container.querySelector('#loadMoreCatalog');
  if (loadMoreBtn) {
    loadMoreBtn.onclick = () => {
      if (currentBrowse.page < currentBrowse.totalPages) {
        browse(currentBrowse.type, currentBrowse.genre, currentBrowse.sortBy, currentBrowse.page + 1, true, container);
      }
    };
  }
}


window.addEventListener('scroll', () => {
  if (app.hidden || currentBrowse.loading || currentBrowse.page >= currentBrowse.totalPages) return;
  if (currentNav !== 'movie' && currentNav !== 'tv') return;
  const currentTabEl = document.getElementById(`tabView-${currentNav}`);
  if (!currentTabEl || currentTabEl.hidden || !currentTabEl.querySelector('#catalogGrid')) return;
  const scrollPosition = window.innerHeight + window.scrollY;
  const threshold = document.documentElement.scrollHeight - 700;
  if (scrollPosition >= threshold) {
    browse(currentBrowse.type, currentBrowse.genre, currentBrowse.sortBy, currentBrowse.page + 1, true, currentTabEl);
  }
});

function listPage(targetContainer = null) {
  const container = targetContainer || getTabEl('list');
  showTab('list');
  const items = Object.values(store.get('myList'));
  container.innerHTML = `<section class="gridPage"><h1 class="pageTitle">Listem</h1>${items.length ? `<div class="grid">${items.map((item) => card(item)).join('')}</div>` : '<div class="loading"><span>Listen henüz boş. Beğendiğin içerikleri detay ekranından ekleyebilirsin.</span></div>'}</section>`;
  bindCards(container);
  tabReady.list = true;
  window.scrollTo(0, tabScrolls.list || 0);
}
function formatBytes(bytes) {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(i >= 3 ? 2 : 1)} ${units[i]}`;
}

let downloadFilter = 'all';
let currentOfflineSeriesGroup = null;

async function downloadsPage(targetContainer = null) {
  const container = targetContainer || getTabEl('downloads');
  showTab('downloads');
  if (tabReady.downloads && !targetContainer) {
    window.scrollTo(0, tabScrolls.downloads || 0);
    const data = await api('/api/downloads');
    if (data.ok) updateDownloadsView(data.downloads);
    return;
  }
  const request = ++viewRequest;
  container.innerHTML = `
    <section class="gridPage downloadsPage">
      <div class="dlPageHeader">
        <h1 class="pageTitle">İndirilenler</h1>
        <div id="downloadsFilterTabs" class="dlFilterTabs"></div>
      </div>
      <div id="downloadsContent" class="downloadsContent loading"><i></i><span>İndirilen içerikler hazırlanıyor…</span></div>
    </section>
  `;
  const data = await api('/api/downloads');
  if (request !== viewRequest || app.hidden || !document.querySelector('[data-nav="downloads"].active')) return;
  if (!data.ok) return showError(data.error, container);
  tabReady.downloads = true;
  updateDownloadsView(data.downloads);
  window.scrollTo(0, tabScrolls.downloads || 0);
}

function updateDownloadsView(entries) {
  const movieCount = entries.filter((e) => e.item?.type === 'movie').length;
  const tvCount = entries.filter((e) => e.item?.type === 'tv').length;
  const downloadingCount = entries.filter((e) => e.status === 'downloading').length;
  const failedCount = entries.filter((e) => e.status === 'failed').length;

  const tabs = $('#downloadsFilterTabs');
  if (tabs) {
    tabs.innerHTML = `
      <button class="dlFilterTab${downloadFilter === 'all' ? ' active' : ''}" data-filter="all">Tümü (${entries.length})</button>
      <button class="dlFilterTab${downloadFilter === 'movie' ? ' active' : ''}" data-filter="movie">Filmler (${movieCount})</button>
      <button class="dlFilterTab${downloadFilter === 'tv' ? ' active' : ''}" data-filter="tv">Diziler (${tvCount})</button>
      ${downloadingCount > 0 ? `<button class="dlFilterTab${downloadFilter === 'downloading' ? ' active' : ''}" data-filter="downloading">İniyor (${downloadingCount})</button>` : ''}
      ${failedCount > 0 ? `<button class="dlFilterTab${downloadFilter === 'failed' ? ' active' : ''}" data-filter="failed">Hatalı (${failedCount})</button>` : ''}
    `;
    tabs.querySelectorAll('.dlFilterTab').forEach((tab) => {
      tab.onclick = () => {
        downloadFilter = tab.dataset.filter;
        updateDownloadsView(entries);
      };
    });
  }

  const content = $('#downloadsContent');
  if (!content) return;
  content.className = 'downloadsContent';

  let filtered = entries;
  if (downloadFilter === 'movie') filtered = entries.filter((e) => e.item?.type === 'movie');
  else if (downloadFilter === 'tv') filtered = entries.filter((e) => e.item?.type === 'tv');
  else if (downloadFilter === 'downloading') filtered = entries.filter((e) => e.status === 'downloading');
  else if (downloadFilter === 'failed') filtered = entries.filter((e) => e.status === 'failed');

  let emptyMsg = 'Henüz indirilmiş film veya dizi bulunmuyor.';
  if (downloadFilter === 'movie') emptyMsg = 'İndirilmiş herhangi bir film bulunmuyor.';
  else if (downloadFilter === 'tv') emptyMsg = 'İndirilmiş herhangi bir dizi bulunmuyor.';
  else if (downloadFilter === 'downloading') emptyMsg = 'Şu an devam eden herhangi bir indirme yok.';
  else if (downloadFilter === 'failed') emptyMsg = 'Hatalı indirme kaydı bulunmuyor.';

  renderDownloadCards(content, filtered, emptyMsg, entries.length === 0);
}

function progressPercent(entry) {
  if (entry.totalParts && entry.downloadedParts) {
    return Math.min(100, Math.round((entry.downloadedParts / entry.totalParts) * 100));
  }
  return 35;
}
function downloadProgressSummary(entry) {
  const parts = entry.totalParts ? `${entry.downloadedParts || 0}/${entry.totalParts} parça` : `${entry.downloadedParts || 0} parça`;
  const speed = entry.speed && entry.speed > 0 ? ` · ${(entry.speed / (1024 * 1024)).toFixed(1)} MB/s` : '';
  const eta = entry.eta && entry.eta > 0 ? ` · ${formatEta(entry.eta)} kaldı` : '';
  return `${parts}${speed}${eta}`;
}

function renderDownloadCards(target, entries, emptyMessage, isTotalEmpty = false) {
  if (!entries.length) {
    if (isTotalEmpty) {
      target.innerHTML = `
        <div class="dlEmptyState">
          <div class="dlEmptyIcon">
            <svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M12 4v12m0 0l-4-4m4 4l4-4M4 19h16"/></svg>
          </div>
          <h2>Henüz İndirilen İçerik Yok</h2>
          <p>Yolculukta veya internetsiz anlarda kesintisiz izlemek için dilediğiniz film ve dizileri detay sayfasındaki İndir butonundan bilgisayarınıza kaydedebilirsiniz.</p>
          <div class="dlEmptyActions">
            <button class="primary dlPrimaryBtn" id="emptyGoMovies"><span>🎬</span> Filmleri Keşfet</button>
            <button class="secondary dlSecondaryBtn" id="emptyGoSeries"><span>📺</span> Trend Dizileri İncele</button>
          </div>
        </div>
      `;
      target.querySelector('#emptyGoMovies')?.addEventListener('click', () => document.querySelector('[data-nav="movie"]').click());
      target.querySelector('#emptyGoSeries')?.addEventListener('click', () => document.querySelector('[data-nav="tv"]').click());
    } else {
      target.innerHTML = `
        <div class="dlEmptyFilter">
          <strong>Bu Filtrede İçerik Yok</strong>
          <p>${escapeHtml(emptyMessage)}</p>
          <button class="secondary dlSecondaryBtn" id="resetDownloadFilterBtn" style="margin-top:10px">Tüm İndirmeleri Göster</button>
        </div>
      `;
      target.querySelector('#resetDownloadFilterBtn')?.addEventListener('click', () => {
        downloadFilter = 'all';
        api('/api/downloads').then((d) => { if (d.ok) updateDownloadsView(d.downloads); });
      });
    }
    return;
  }

  // Gruplama: Diziler TMDB ID'ye göre tek kart altında birleştirilir
  const seriesMap = new Map();
  const displayItems = [];

  entries.forEach((entry) => {
    if (entry.status === 'complete' && entry.item.type === 'tv') {
      const seriesKey = String(entry.item.id);
      if (!seriesMap.has(seriesKey)) {
        const group = {
          isSeriesGroup: true,
          item: entry.item,
          episodes: [entry],
          status: 'complete'
        };
        seriesMap.set(seriesKey, group);
        displayItems.push(group);
      } else {
        seriesMap.get(seriesKey).episodes.push(entry);
      }
    } else {
      displayItems.push({
        isSeriesGroup: false,
        entry
      });
    }
  });

  target.innerHTML = `
    <div class="grid downloadsGrid">
      ${displayItems.map((di) => {
        if (di.isSeriesGroup) {
          const item = di.item;
          const count = di.episodes.length;
          const titleVal = escapeHtml(item.title || 'Dizi');
          const posterUrl = item.poster || (di.episodes[0] ? `/api/download/poster/${encodeURIComponent(di.episodes[0].id)}` : '');
          return `
            <article class="card neonCard dlCard dlSeriesCard" data-series-id="${escapeHtml(item.id)}">
              <div class="cardPosterWrap">
                ${posterUrl ? `<img loading="lazy" class="cardPoster" src="${posterUrl}" alt="${titleVal}">` : '<div class="placeholder"><span>M</span></div>'}
                <div class="cardShade"></div>
                <span class="dlCardBadge dlSeriesBadge">✓ ${count} Bölüm İndirildi</span>
              </div>
              <div class="cardBody">
                <div class="cardPrimaryInfo">
                  <h3 class="cardTitle" title="${titleVal}">${titleVal}</h3>
                  <span class="cardRatingBadge">DİZİ</span>
                </div>
                <div class="cardExpandContent">
                  <p class="cardOverview">${count} bölüm çevrimdışı izlemeye hazır.</p>
                  <div class="cardActionRow">
                    <button class="cardPlayBtn" data-open-series="${escapeHtml(item.id)}">
                      <span>Bölümleri Seç (${count})</span>
                    </button>
                  </div>
                </div>
              </div>
            </article>
          `;
        } else {
          const entry = di.entry;
          const item = entry.item;
          const titleVal = escapeHtml(item.title || 'İçerik');
          const isComplete = entry.status === 'complete';
          const isDownloading = entry.status === 'downloading';
          const pct = progressPercent(entry);
          const posterUrl = item.poster || `/api/download/poster/${encodeURIComponent(entry.id)}`;
          const subText = item.type === 'tv' ? `${entry.season}. Sezon ${entry.episode}. Bölüm` : (item.year || 'Film');

          return `
            <article class="card neonCard dlCard ${entry.status}" data-entry-id="${escapeHtml(entry.id)}">
              <div class="cardPosterWrap">
                ${posterUrl ? `<img loading="lazy" class="cardPoster" src="${posterUrl}" alt="${titleVal}">` : '<div class="placeholder"><span>M</span></div>'}
                <div class="cardShade"></div>
                <span class="dlCardBadge ${entry.status}">
                  ${isComplete ? '✓ İndirildi' : (isDownloading ? `%${pct} İniyor` : '✕ Hata')}
                </span>
                ${isDownloading ? `
                  <div class="dlCardProgressFillBar"><i style="width:${pct}%"></i></div>
                ` : ''}
              </div>
              <div class="cardBody">
                <div class="cardPrimaryInfo">
                  <h3 class="cardTitle" title="${titleVal}">${titleVal}</h3>
                  <span class="cardRatingBadge">${escapeHtml(subText)}</span>
                </div>
                <div class="cardExpandContent">
                  <p class="cardOverview">${isDownloading ? downloadProgressSummary(entry) : escapeHtml(entry.audioLabel || 'Orijinal Ses')}</p>
                  <div class="cardActionRow">
                    ${isComplete ? `
                      <button class="cardPlayBtn" data-play-entry="${escapeHtml(entry.id)}">
                        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        <span>İzle</span>
                      </button>
                      <button class="cardIconBtn dlCardDeleteBtn" data-delete-entry="${escapeHtml(entry.id)}" title="Sil">
                        <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5"/></svg>
                      </button>
                    ` : (isDownloading ? `
                      <button class="cardPlayBtn dlCardCancelBtn" data-cancel-entry="${escapeHtml(entry.id)}">
                        <span>✕ İptal</span>
                      </button>
                    ` : `
                      <button class="cardPlayBtn dlCardRetryBtn" data-retry-entry="${escapeHtml(entry.id)}">
                        <span>↺ Tekrar Dene</span>
                      </button>
                      <button class="cardIconBtn dlCardDeleteBtn" data-delete-entry="${escapeHtml(entry.id)}" title="Kaydı Sil">
                        <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5"/></svg>
                      </button>
                    `)}
                  </div>
                </div>
              </div>
            </article>
          `;
        }
      }).join('')}
    </div>
  `;

  // Dizi kartı tıklamaları -> Modal aç
  target.querySelectorAll('[data-series-id]').forEach((el) => {
    el.onclick = (e) => {
      const id = el.dataset.seriesId;
      const group = seriesMap.get(id);
      if (group) openOfflineSeriesModal(group);
    };
  });

  // Film ve tekil kart tıklamaları -> Oynat
  target.querySelectorAll('[data-play-entry]').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const entry = entries.find((x) => x.id === btn.dataset.playEntry);
      if (entry) playOffline(entry);
    };
  });

  target.querySelectorAll('.card.dlCard:not(.dlSeriesCard)').forEach((cardEl) => {
    cardEl.onclick = (e) => {
      if (e.target.closest('button')) return;
      const entry = entries.find((x) => x.id === cardEl.dataset.entryId);
      if (entry && entry.status === 'complete') playOffline(entry);
    };
  });

  // İptal
  target.querySelectorAll('[data-cancel-entry]').forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const id = btn.dataset.cancelEntry;
      btn.disabled = true;
      btn.textContent = 'İptal ediliyor…';
      const res = await apiPost('/api/download/cancel', { id });
      if (res.ok) {
        toast('İndirme iptal edildi.');
        const d = await api('/api/downloads');
        if (d.ok) updateDownloadsView(d.downloads);
      } else {
        toast(res.error || 'İptal edilemedi');
        btn.disabled = false;
      }
    };
  });

  // Tekrar dene
  target.querySelectorAll('[data-retry-entry]').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const entry = entries.find((x) => x.id === btn.dataset.retryEntry);
      if (entry) openDownload({ item: entry.item, season: entry.season, episode: entry.episode });
    };
  });

  // Sil
  target.querySelectorAll('[data-delete-entry]').forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const entry = entries.find((x) => x.id === btn.dataset.deleteEntry);
      if (!entry || !await askDelete(entry)) return;
      btn.disabled = true;
      const res = await apiPost('/api/download/delete', { id: entry.id });
      if (!res.ok) { toast(res.error); btn.disabled = false; return; }
      toast('İndirme ve dosyaları silindi.');
      const refreshed = await api('/api/downloads');
      if (refreshed.ok) updateDownloadsView(refreshed.downloads);
    };
  });
}

function openOfflineSeriesModal(seriesGroup) {
  currentOfflineSeriesGroup = seriesGroup;
  const dialog = $('#offlineSeriesDialog');
  if (!dialog) return;
  $('#offlineSeriesTitle').textContent = seriesGroup.item.title;
  const listEl = $('#offlineSeriesEpisodesList');

  const episodes = [...seriesGroup.episodes].sort((a, b) => Number(a.season) - Number(b.season) || Number(a.episode) - Number(b.episode));

  listEl.innerHTML = episodes.map((ep) => {
    const epLabel = `${ep.season}. Sezon · ${ep.episode}. Bölüm`;
    const fileSize = ep.size || ep.downloadedBytes ? formatBytes(ep.size || ep.downloadedBytes) : '';
    return `
      <div class="offlineEpisodeRow" data-ep-id="${escapeHtml(ep.id)}">
        <div class="offlineEpInfo">
          <strong>${epLabel}</strong>
          <span>${fileSize ? `${fileSize} · ` : ''}🔊 ${escapeHtml(ep.audioLabel || 'Orijinal Ses')}</span>
        </div>
        <div class="offlineEpActions">
          <button class="primary dlEpPlayBtn" data-play-ep="${escapeHtml(ep.id)}">
            <span>▶</span> İzle
          </button>
          <button class="iconBtn dlEpDeleteBtn" data-delete-ep="${escapeHtml(ep.id)}" title="Bölümü Sil">
            <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('[data-play-ep]').forEach((btn) => {
    btn.onclick = () => {
      dialog.hidden = true;
      const ep = seriesGroup.episodes.find((x) => x.id === btn.dataset.playEp);
      if (ep) playOffline(ep);
    };
  });

  listEl.querySelectorAll('[data-delete-ep]').forEach((btn) => {
    btn.onclick = async () => {
      const ep = seriesGroup.episodes.find((x) => x.id === btn.dataset.deleteEp);
      if (!ep || !await askDelete(ep)) return;
      btn.disabled = true;
      const res = await apiPost('/api/download/delete', { id: ep.id });
      if (res.ok) {
        toast('Bölüm silindi.');
        seriesGroup.episodes = seriesGroup.episodes.filter((x) => x.id !== ep.id);
        if (seriesGroup.episodes.length === 0) {
          dialog.hidden = true;
        } else {
          openOfflineSeriesModal(seriesGroup);
        }
        const refreshed = await api('/api/downloads');
        if (refreshed.ok) updateDownloadsView(refreshed.downloads);
      } else {
        toast(res.error || 'Silinemedi');
        btn.disabled = false;
      }
    };
  });

  dialog.hidden = false;
  $('#closeOfflineSeries').onclick = () => { dialog.hidden = true; };
  dialog.onclick = (e) => { if (e.target === dialog) dialog.hidden = true; };
}

function askDelete(entry) {
  const dialog = $('#deleteDialog');
  $('#deleteDescription').textContent = entry.status === 'failed'
    ? `“${entry.item.title}” indirme kaydı ve geçici dosyaları kaldırılacak.`
    : `“${entry.item.title}” ve indirilen dosyaları bu bilgisayardan kaldırılacak.`;
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
  clearNextBanner();
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
async function search(query, targetContainer = null) {
  const container = targetContainer || getTabEl('search');
  showTab('search');
  currentNav = 'search';
  document.querySelectorAll('nav button').forEach((b) => b.classList.remove('active'));
  const request = ++viewRequest;
  container.innerHTML = '<div class="loading"><i></i><span>Sonuçlar aranıyor…</span></div>';
  const data = await api(`/api/search?q=${encodeURIComponent(query)}`);
  if (request !== viewRequest) return;
  if (!data.ok) return showError(data.error, container);
  container.innerHTML = `<section class="gridPage"><h1 class="pageTitle">“${escapeHtml(query)}” sonuçları</h1>${data.results.length ? `<div class="grid">${data.results.map((item) => card(item)).join('')}</div>` : '<div class="loading"><span>Aramanızla eşleşen film veya dizi bulunamadı. Lütfen farklı bir arama deneyin.</span></div>'}</section>`;
  bindCards(container);
  window.scrollTo(0, 0);
}


async function openDetail(summary) {
  detailReturnScroll = window.scrollY; app.hidden = true; detail.hidden = false; window.scrollTo(0, 0); $('#detailBody').innerHTML = '<div class="loading"><i></i><span>Detaylar yükleniyor…</span></div>';
  const data = await api(`/api/details?id=${summary.id}&type=${summary.type}`); if (!data.ok) { closeDetail(); return toast(data.error); }
  activeDetail = data.item; renderDetail();
}
function openTrailerModal(title, youtubeKey) {
  $('#trailerTitle').textContent = `${title} · Fragman`;
  $('#trailerFrameContainer').innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeKey)}?autoplay=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  $('#trailerDialog').hidden = false;
}
function closeTrailerModal() {
  $('#trailerDialog').hidden = true;
  $('#trailerFrameContainer').innerHTML = '';
}
function renderDetail() {
  const item = activeDetail; const list = store.get('myList'); const saved = Boolean(list[`${item.type}-${item.id}`]);
  const castHtml = item.cast?.length ? `<br><b>Oyuncular</b> ${item.cast.map((actor) => `<a href="#" class="castLink" data-actor="${escapeHtml(actor)}">${escapeHtml(actor)}</a>`).join(', ')}` : '';
  $('#detailBody').innerHTML = `<section class="detailHero" style="background-image:url('${item.backdrop || item.poster || ''}')"><div class="detailInfo"><span class="detailKicker">${item.type === 'tv' ? 'MAXEN DİZİ' : 'MAXEN FİLM'}</span><h1>${escapeHtml(item.title)}</h1><div class="meta">${meta(item)}${item.runtime ? `<span>${item.runtime} dk</span>` : ''}<span class="ageBadge">13+</span></div><p>${escapeHtml(item.overview || 'Bu yapım için henüz Türkçe detay özeti girilmemiş.')}</p><div class="actions"><button class="primary" id="detailPlay"><span>▶</span> ${resumeLabel(item)}</button><button class="secondary" id="detailTrailer">🎬 Fragman</button>${item.type === 'movie' ? '<button class="secondary" id="detailDownload">↓ İndir</button>' : ''}<button class="secondary iconButton" id="toggleList">${saved ? '✓' : '+'}<em>${saved ? 'Listemde' : 'Listeme Ekle'}</em></button></div><div id="detailDownloadStatus" class="detailDownloadStatus"></div><div class="extra"><b>Türler</b> ${escapeHtml((item.genres || []).join(', '))}${castHtml}</div></div></section>${item.type === 'tv' ? `<section class="episodes"><div class="seasonBar"><div><span>BÖLÜM REHBERİ</span><h2>${escapeHtml(item.title)}</h2></div><select id="seasonSelect">${item.seasons.map((s) => `<option value="${s.season_number}">${s.name}</option>`).join('')}</select></div><div id="episodeList"><div class="loading"><i></i></div></div></section>` : ''}`;
  $('#detailPlay').onclick = () => playFromDetail(item);
  $('#detailTrailer').onclick = async () => {
    const btn = $('#detailTrailer');
    btn.disabled = true;
    btn.textContent = '🎬 Yükleniyor…';
    const data = await api(`/api/trailer?id=${item.id}&type=${item.type}`);
    btn.disabled = false;
    btn.textContent = '🎬 Fragman';
    if (!data.ok || !data.key) return toast(data.error || 'Fragman bulunamadı.');
    openTrailerModal(item.title, data.key);
  };
  $('#toggleList').onclick = toggleList;
  if (item.type === 'movie') $('#detailDownload').onclick = () => openDownload({ item, season: 1, episode: 1 });
  if (item.type === 'tv') { $('#seasonSelect').onchange = loadEpisodes; loadEpisodes(); }
  document.querySelectorAll('.castLink').forEach((link) => {
    link.onclick = (e) => {
      e.preventDefault();
      const actor = link.dataset.actor;
      if (actor) {
        closeDetail();
        $('#query').value = actor;
        search(actor);
      }
    };
  });
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
    const statusText = (entry) => entry.status === 'complete' ? `✓ İndirildi · ${entry.audioLabel}` : entry.status === 'downloading' ? `↓ İndiriliyor · ${downloadProgressSummary(entry)}` : `İndirme başarısız · ${entry.error || 'Tekrar deneyin'}`;
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
  target.innerHTML = data.episodes.map((ep) => `<div class="episodeWrap"><button class="episode" data-episode="${ep.number}"><b>${ep.number}</b>${ep.still ? `<img loading="lazy" src="${ep.still}" alt="">` : '<span class="episodeStill"></span>'}<span><h3>${escapeHtml(ep.title || `${ep.number}. Bölüm`)}</h3><p>${escapeHtml(ep.overview || 'Bu bölüm için henüz detaylı Türkçe özet girilmemiş.')}</p>${episodeProgress(activeDetail.id, season, ep.number)}<small class="episodeStatus" data-download-status="${ep.number}"></small></span></button><button class="episodeDownload" data-download-episode="${ep.number}" aria-label="${ep.number}. bölümü indir"><span>↓</span><span>İndir</span></button></div>`).join('');
  target.querySelectorAll('[data-episode]').forEach((el) => el.onclick = () => play({ item: activeDetail, season, episode: Number(el.dataset.episode) }));
  target.querySelectorAll('[data-download-episode]').forEach((el) => el.onclick = () => openDownload({ item: activeDetail, season, episode: Number(el.dataset.downloadEpisode) }));
  updateDetailDownloads();
}
function episodeProgress(id, season, episode) { const entry = store.get('progress')[`tv-${id}-${season}-${episode}`]; return entry?.duration ? `<div class="progress"><b style="width:${Math.min(100, entry.time / entry.duration * 100)}%"></b></div>` : ''; }
function quickPlay(item) { if (item.type === 'movie') return play({ item, season: 1, episode: 1 }); openDetail(item); }

async function play(context, source = 'original', keepTime = 0, forceRefresh = false) {
  clearNextBanner();
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
  if (context.item.type !== 'tv') return;
  const params = new URLSearchParams({ tmdbId: context.item.id, type: context.item.type, title: context.item.title, season: context.season, episode: context.episode });
  const result = await api(`/api/dub/check?${params}`);
  if (generation !== playbackGeneration || !result.ok || !result.available) return;
  dubAvailable = true;
  renderAudioOptions();
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
      try {
        cue.snapToLines = false;
        cue.line = 79;
        cue.position = 50;
        cue.align = 'center';
        cue.size = 90;
        if (subtitleOffset !== 0) {
          cue.startTime += subtitleOffset;
          cue.endTime += subtitleOffset;
        }
        positionedSubtitleCues.add(cue);
      } catch { /* Some native cue types cannot be repositioned. */ }
    }
  }
}
function progressKey() { return current.item.type === 'tv' ? `tv-${current.item.id}-${current.season}-${current.episode}` : `movie-${current.item.id}`; }
function saveProgress() { if (suppressProgressSave || !current || !Number.isFinite(video.duration) || video.duration <= 0 || video.currentTime < 5) return; const entries = store.get('progress'); entries[progressKey()] = { ...current.item, season: current.season, episode: current.episode, time: video.currentTime, duration: video.duration, updated: Date.now() }; if (video.currentTime / video.duration > .95) delete entries[progressKey()]; store.set('progress', entries); }
function formatTime(seconds) { if (!Number.isFinite(seconds)) return '00:00'; const h = Math.floor(seconds / 3600); const m = Math.floor(seconds % 3600 / 60); const s = Math.floor(seconds % 60); return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
function setPlayerStatus(message = '', kind = 'loading') { $('#playerStatus').textContent = message; player.classList.toggle('loading', Boolean(message) && kind === 'loading'); player.classList.toggle('hasError', Boolean(message) && kind === 'error'); }
function updateControls() {
  if (!isDraggingSeek) {
    const ratio = Number.isFinite(video.duration) && video.duration > 0 ? video.currentTime / video.duration : 0;
    seek.value = Math.round(ratio * 1000);
    seek.style.setProperty('--value', `${ratio * 100}%`);
    $('#currentTime').textContent = formatTime(video.currentTime);
  }
  $('#duration').textContent = formatTime(video.duration);
  if (Number.isFinite(video.duration) && video.duration > 0) {
    const end = new Date(Date.now() + Math.max(0, video.duration - video.currentTime) / video.playbackRate * 1000);
    $('#endTime').textContent = `Bitiş ${end.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    if (current?.item.type === 'tv' && !$('#nextEpisode').hidden && video.duration > 40) {
      const timeLeft = video.duration - video.currentTime;
      if (timeLeft <= 30 && timeLeft > 2 && !nextBannerDismissed && !nextBannerActive) {
        startNextEpisodeCountdown();
      }
    }
  } else $('#endTime').textContent = '';
}
function updateQualityBadge() { $('#qualityBadge').textContent = $('#quality').value === '-1' ? 'AUTO' : ($('#quality').selectedOptions[0]?.textContent || 'AUTO').toUpperCase(); }
function openPlayerSetting(mode) { const panel = $('#settingsPanel'); const opening = panel.hidden || panel.dataset.mode !== mode; $('#episodePanel').hidden = true; panel.dataset.mode = mode; panel.hidden = !opening; showControls(); if (opening) $(`#${mode} select`)?.focus(); }
function updatePlayState() {
  player.classList.toggle('isPlaying', !video.paused);
  playToggle.setAttribute('aria-label', video.paused ? 'Oynat' : 'Duraklat');
  window.maxenDesktop?.reportPlayback(!video.paused);
}
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

function selectNav(targetNav) {
  if (currentNav && tabScrolls[currentNav] !== undefined) {
    tabScrolls[currentNav] = window.scrollY;
  }
  detail.hidden = true;
  app.hidden = false;
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b.dataset.nav === targetNav));
  currentNav = targetNav;
  showTab(targetNav);

  if (targetNav === 'home') {
    if (tabReady.home) {
      window.scrollTo(0, tabScrolls.home || 0);
    } else {
      home();
    }
  } else if (targetNav === 'movie' || targetNav === 'tv') {
    if (tabReady[targetNav]) {
      window.scrollTo(0, tabScrolls[targetNav] || 0);
    } else {
      browse(targetNav);
    }
  } else if (targetNav === 'list') {
    listPage();
  } else if (targetNav === 'downloads') {
    downloadsPage();
  }
}

document.querySelectorAll('[data-nav]').forEach((button) => button.onclick = () => selectNav(button.dataset.nav));

let dfbDismissed = false;
const previousDownloadStates = new Map();

async function updateGlobalDownloads() {
  const data = await api('/api/downloads');
  if (!data.ok) return;
  const entries = data.downloads || [];

  for (const entry of entries) {
    const prevState = previousDownloadStates.get(entry.id);
    if (prevState === 'downloading' && entry.status === 'complete') {
      toast(`🎬 “${entry.item.title}” başarıyla indirildi ve izlemeye hazır!`);
    } else if (prevState === 'downloading' && entry.status === 'failed') {
      toast(`⚠️ “${entry.item.title}” indirilemedi: ${entry.error || 'Hata oluştu'}`);
    }
    previousDownloadStates.set(entry.id, entry.status);
  }

  const downloading = entries.filter((e) => e.status === 'downloading');
  const badge = $('#downloadNavBadge');
  if (badge) {
    if (downloading.length > 0) {
      badge.textContent = String(downloading.length);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  const floatingBar = $('#downloadFloatingBar');
  if (floatingBar) {
    if (downloading.length > 0 && !dfbDismissed) {
      const topDownload = downloading[0];
      const pct = progressPercent(topDownload);
      $('#dfbTitle').textContent = topDownload.item.title || 'İndiriliyor…';
      $('#dfbPercent').textContent = `%${pct}`;
      $('#dfbFill').style.width = `${pct}%`;
      const speedStr = topDownload.speed && topDownload.speed > 0 ? `${(topDownload.speed / (1024 * 1024)).toFixed(1)} MB/s` : 'Hesaplanıyor…';
      $('#dfbSpeed').textContent = speedStr;
      const etaStr = topDownload.eta && topDownload.eta > 0 ? `${formatEta(topDownload.eta)} kaldı` : (downloading.length > 1 ? `+${downloading.length - 1} diğer indirme` : '');
      $('#dfbEta').textContent = etaStr;
      floatingBar.hidden = false;
    } else if (downloading.length === 0) {
      dfbDismissed = false;
      floatingBar.hidden = true;
    }
  }

  if (!app.hidden && document.querySelector('[data-nav="downloads"].active')) {
    updateDownloadsView(entries);
  }
}

if ($('#dfbOpen')) $('#dfbOpen').onclick = () => selectNav('downloads');
if ($('#dfbDismiss')) $('#dfbDismiss').onclick = () => { dfbDismissed = true; $('#downloadFloatingBar').hidden = true; };
setInterval(updateGlobalDownloads, 2000);

$('#closeDownload').onclick = () => { $('#downloadDialog').hidden = true; downloadContext = null; };
$('#downloadDialog').onclick = (event) => { if (event.target === $('#downloadDialog')) $('#closeDownload').click(); };
$('#closeTrailer').onclick = closeTrailerModal;
$('#trailerDialog').onclick = (event) => { if (event.target === $('#trailerDialog')) closeTrailerModal(); };
$('#downloadAudio').onchange = updateDownloadChoices;
$('#confirmDownload').onclick = async () => {
  if (!downloadContext || !downloadToken || !$('#downloadAudio').value) return;
  const button = $('#confirmDownload'); button.disabled = true; button.textContent = 'Başlatılıyor…';
  const result = await apiPost('/api/download/start', { token: downloadToken, audioId: $('#downloadAudio').value, subtitleId: $('#downloadSubtitle').value, item: downloadContext.item, season: downloadContext.season, episode: downloadContext.episode });
  button.textContent = 'İndir';
  if (!result.ok) { $('#downloadHint').textContent = result.error; button.disabled = false; return; }
  $('#closeDownload').click();
  dfbDismissed = false;
  toast('İndirme başladı. İndirilenler bölümünden canlı izleyebilirsin.');
  updateDetailDownloads();
  updateGlobalDownloads();
};
$('#searchForm').onsubmit = (event) => { event.preventDefault(); const query = $('#query').value.trim(); if (query) { detail.hidden = true; app.hidden = false; window.scrollTo(0, 0); search(query); } };
window.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#query').focus(); $('#query').select(); } });
$('[data-close]').onclick = closeDetail; $('#back').onclick = async () => { clearNextBanner(); playbackGeneration += 1; saveProgress(); video.pause(); pendingSeekCleanup?.(); if (hls) hls.destroy(); hls = null; video.removeAttribute('src'); $('#episodePanel').hidden = true; if (document.fullscreenElement) await document.exitFullscreen?.(); player.hidden = true; player.classList.remove('controlsVisible'); current = null; if (playerReturn === 'detail') { detail.hidden = false; app.hidden = true; updateDetailDownloads(); } else { detail.hidden = true; app.hidden = false; if (document.querySelector('[data-nav="downloads"].active')) downloadsPage(); } };
$('#source').onchange = () => { const value = $('#source').value; const label = $('#source').selectedOptions[0]?.textContent || ''; const keepTime = video.currentTime; $('#settingsPanel').hidden = true; if (value.startsWith('audio:')) { const [, index, language] = value.split(':'); store.set('preferredAudioLanguage', language || label); if (activeSource === 'original' && hls) { hls.audioTrack = Number(index); toast(`Ses: ${label}`); } else { pendingAudioLanguage = language || label; play(current, 'original', keepTime); } return; } if (value === 'dub') { store.set('preferredAudioLanguage', 'tr'); play(current, 'dub', keepTime); return; } store.set('preferredAudioLanguage', current?.item?.originalLanguage || 'en'); if (activeSource !== 'original') play(current, 'original', keepTime); }; $('#quality').onchange = () => { if (hls) hls.currentLevel = Number($('#quality').value); updateQualityBadge(); $('#settingsPanel').hidden = true; };
$('#subtitle').onchange = () => { const index = Number($('#subtitle').value); if (hls) { hls.subtitleDisplay = index >= 0; hls.subtitleTrack = index; } else for (const [trackIndex, track] of [...video.textTracks].entries()) track.mode = trackIndex === index ? 'showing' : 'disabled'; positionSubtitleCues(); $('#subtitleToggle').classList.toggle('isActive', index >= 0); $('#settingsPanel').hidden = true; showControls(); };
const savedSubSize = store.get('subtitleSize') || 'medium';
if ($('#subtitleSize')) { $('#subtitleSize').value = savedSubSize; player.style.setProperty('--sub-size', subtitleSizes[savedSubSize] || '23px'); $('#subtitleSize').onchange = () => { const chosen = $('#subtitleSize').value; player.style.setProperty('--sub-size', subtitleSizes[chosen] || '23px'); store.set('subtitleSize', chosen); }; }
if ($('#subtitleOffset')) { $('#subtitleOffset').onchange = () => { const newOffset = Number($('#subtitleOffset').value); const delta = newOffset - subtitleOffset; subtitleOffset = newOffset; for (const track of video.textTracks) { if (!track.cues) continue; for (const cue of track.cues) { try { cue.startTime += delta; cue.endTime += delta; } catch { /* ignore non-editable cues */ } } } toast(`Altyazı senkron: ${newOffset > 0 ? '+' : ''}${newOffset} sn`); }; }
$('#speedToggle').onclick = () => { const index = playbackSpeeds.indexOf(video.playbackRate); video.playbackRate = playbackSpeeds[(index + 1) % playbackSpeeds.length]; $('#speedToggle').textContent = `${video.playbackRate}x`; $('#speedToggle').setAttribute('aria-label', `Oynatma hızı: ${video.playbackRate}x`); updateControls(); showControls(); };
$('#fitToggle').onclick = () => { playerFit = playerFit === 'contain' ? 'cover' : 'contain'; video.style.objectFit = playerFit; $('#fitToggle').classList.toggle('isActive', playerFit === 'cover'); $('#fitToggle').setAttribute('aria-label', playerFit === 'cover' ? 'Görüntüyü sığdır' : 'Görüntüyü doldur'); toast(playerFit === 'cover' ? 'Görüntü ekranı dolduruyor' : 'Görüntü ekrana sığdırıldı'); showControls(); };
if (document.pictureInPictureEnabled) { $('#pipToggle').onclick = async () => { try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await video.requestPictureInPicture(); } catch (error) { toast(`PiP açılamadı: ${error.message}`); } showControls(); }; } else { $('#pipToggle').hidden = true; }
$('#audioToggle').onclick = () => openPlayerSetting('audioSetting'); $('#subtitleToggle').onclick = () => openPlayerSetting('subtitleSetting'); $('#qualityToggle').onclick = () => openPlayerSetting('qualitySetting');
seek.addEventListener('pointerdown', () => { isDraggingSeek = true; });
seek.oninput = () => {
  isDraggingSeek = true;
  const ratio = Number(seek.value) / 1000;
  seek.style.setProperty('--value', `${ratio * 100}%`);
  if (video.duration) $('#currentTime').textContent = formatTime(ratio * video.duration);
};
seek.onchange = () => {
  if (video.duration) video.currentTime = (Number(seek.value) / 1000) * video.duration;
  isDraggingSeek = false;
  updateControls();
};
window.addEventListener('pointerup', () => {
  if (isDraggingSeek) {
    if (video.duration) video.currentTime = (Number(seek.value) / 1000) * video.duration;
    isDraggingSeek = false;
    updateControls();
  }
});
const seekTooltip = $('#seekTooltip');
const timeline = document.querySelector('.timeline');
if (timeline && seekTooltip) {
  timeline.addEventListener('mousemove', (event) => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) { seekTooltip.hidden = true; return; }
    const rect = timeline.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const ratio = x / rect.width;
    seekTooltip.textContent = formatTime(ratio * video.duration);
    seekTooltip.style.left = `${x}px`;
    seekTooltip.hidden = false;
  });
  timeline.addEventListener('mouseleave', () => { seekTooltip.hidden = true; });
}
volume.oninput = () => { video.volume = Number(volume.value); video.muted = false; volume.style.setProperty('--value', `${video.volume * 100}%`); player.classList.toggle('isMuted', !video.volume); showVolumeHud(video.volume * 100); };
$('#mute').onclick = () => { video.muted = !video.muted; player.classList.toggle('isMuted', video.muted); showVolumeHud(video.muted ? 0 : video.volume * 100); };
video.addEventListener('dblclick', (event) => { event.preventDefault(); $('#fullscreen').click(); });
player.addEventListener('wheel', (event) => {
  if (player.hidden) return;
  event.preventDefault();
  const step = 0.05;
  const newVol = event.deltaY < 0 ? Math.min(1, video.volume + step) : Math.max(0, video.volume - step);
  video.volume = Math.round(newVol * 100) / 100;
  video.muted = false;
  volume.value = video.volume;
  volume.style.setProperty('--value', `${video.volume * 100}%`);
  player.classList.toggle('isMuted', !video.volume);
  showVolumeHud(video.volume * 100);
  showControls();
}, { passive: false });
$('#fullscreen').onclick = async () => { try { if (!document.fullscreenElement) await player.requestFullscreen?.({ navigationUI: 'hide' }); else await document.exitFullscreen?.(); } catch (error) { toast(`Tam ekran açılamadı: ${error.message}`); } showControls(); };
document.addEventListener('fullscreenchange', () => { const active = document.fullscreenElement === player; player.classList.toggle('isFullscreen', active); $('#fullscreen').setAttribute('aria-label', active ? 'Tam ekrandan çık' : 'Tam ekran'); showControls(); });
$('#nextEpisode').onclick = () => { clearNextBanner(); if (current?.item.type !== 'tv') return; if (activeSource === 'offline') { const entry = offlineSeriesEntries.find((value) => Number(value.season) === Number(current.season) && Number(value.episode) === Number(current.episode) + 1); if (entry) playOffline(entry); } else play({ ...current, episode: current.episode + 1 }, activeSource, 0); };
$('#nextBannerPlay').onclick = () => { clearNextBanner(); $('#nextEpisode').click(); };
$('#nextBannerCancel').onclick = () => { if (nextBannerTimer) { clearInterval(nextBannerTimer); nextBannerTimer = null; } nextBannerActive = false; nextBannerDismissed = true; $('#nextEpisodeBanner').hidden = true; };
$('#episodeMenu').onclick = openEpisodePanel; $('#closeEpisodePanel').onclick = () => { $('#episodePanel').hidden = true; showControls(); }; $('#playerSeasonSelect').onchange = () => activeSource === 'offline' ? loadOfflinePlayerEpisodes(Number($('#playerSeasonSelect').value)) : loadPlayerEpisodes(Number($('#playerSeasonSelect').value));
player.onmousemove = showControls; player.onmouseleave = () => { if (!video.paused) player.classList.remove('controlsVisible'); };
video.addEventListener('playing', () => { setPlayerStatus(''); updatePlayState(); showControls(); }); video.addEventListener('loadeddata', () => { if (video.readyState >= 2) setPlayerStatus(''); }); video.addEventListener('canplay', () => { if (video.readyState >= 2) setPlayerStatus(''); }); video.addEventListener('error', () => { if (!player.hidden) setPlayerStatus('Video açılamadı. Dosyayı veya yayını kontrol edin.', 'error'); }); video.addEventListener('play', updatePlayState); video.addEventListener('pause', () => { updatePlayState(); showControls(); }); video.addEventListener('timeupdate', updateControls); video.addEventListener('durationchange', updateControls);
video.textTracks.addEventListener?.('addtrack', (event) => { event.track?.addEventListener('cuechange', positionSubtitleCues); positionSubtitleCues(); });
video.addEventListener('pause', saveProgress); window.addEventListener('beforeunload', saveProgress); setInterval(saveProgress, 10000);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (!$('#offlineSeriesDialog')?.hidden) { $('#closeOfflineSeries').click(); return; }
    if (!$('#trailerDialog').hidden) { closeTrailerModal(); return; }

    if (!$('#deleteDialog').hidden) { $('#cancelDelete').click(); return; }
    if (!$('#downloadDialog').hidden) { $('#closeDownload').click(); return; }
    if (!player.hidden) {
      if (!$('#settingsPanel').hidden) { $('#settingsPanel').hidden = true; return; }
      if (!$('#episodePanel').hidden) { $('#episodePanel').hidden = true; return; }
      if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
      $('#back').click();
      return;
    }
  }
  if (player.hidden || ['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  const key = event.key.toLowerCase();
  if (event.code === 'Space' || event.key === 'Enter' || key === 'k') {
    event.preventDefault(); togglePlayback();
  } else if (event.key === 'ArrowLeft' || key === 'j') {
    event.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 10); showControls();
  } else if (event.key === 'ArrowRight' || key === 'l') {
    event.preventDefault(); video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10); showControls();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault(); const newVol = Math.min(1, Math.round((video.volume + 0.05) * 100) / 100); video.volume = newVol; volume.value = video.volume; volume.style.setProperty('--value', `${video.volume * 100}%`); player.classList.toggle('isMuted', !video.volume); showVolumeHud(video.volume * 100); showControls();
  } else if (event.key === 'ArrowDown') {
    event.preventDefault(); const newVol = Math.max(0, Math.round((video.volume - 0.05) * 100) / 100); video.volume = newVol; volume.value = video.volume; volume.style.setProperty('--value', `${video.volume * 100}%`); player.classList.toggle('isMuted', !video.volume); showVolumeHud(video.volume * 100); showControls();
  } else if (key === 'm') {
    $('#mute').click();
  } else if (key === 'f') {
    $('#fullscreen').click();
  } else if (/^[0-9]$/.test(event.key) && Number.isFinite(video.duration) && video.duration > 0) {
    event.preventDefault(); const ratio = Number(event.key) / 10; video.currentTime = ratio * video.duration; showControls();
  }
});
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
