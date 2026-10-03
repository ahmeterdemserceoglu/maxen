# Maxen Windows Oynatıcısı v2.7.0 Kapsamlı Yenileme ve Geliştirme Planı

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Maxen Bilgisayar (Windows Masaüstü) uygulamasındaki tüm mimari ve çalışma zamanı çakışmalarını düzeltmek, eski/ölü kod ve kurulum dosyalarını temizlemek, zengin oynatıcı ve katalog özelliklerini eklemek ve yeni `Maxen-Setup-2.7.0-Windows-x64.exe` paketini üretip bilgisayara kurmak.

**Architecture:** Electron 44 ana süreci (`main.js`, `preload.js`) ile dahili yerel HTTP sunucusu (`server.js`, `downloads.js`) ve modern cam yüzeyli HTML5/HLS.js renderer katmanı arasındaki veri akışını sağlamlaştırma; tek örnek kilidi, dinamik port, güvenli akış borulaması, hata toleranslı parçalı indirme motoru ve modern masaüstü oynatıcı UX pratikleri (çift tık tam ekran, PiP, fare tekerleği ses kontrolü, sayfalama, fragman modalı) entegrasyonu.

**Tech Stack:** Electron 44, Node.js (HTTP / Streams / Crypto), HLS.js, CSS Custom Properties (Dark / Glassmorphism), TMDB API, Inno/NSIS Installer.

---

### Görev Listesi Özeti

| ID | Kategori | Görev Tanımı | Hedef Dosyalar |
| :--- | :--- | :--- | :--- |
| **TASK-1** | ⚠️ Çakışma Düzeltmeleri | Tek Örnek Kilidi, Dinamik Port, Uyku Engeli ve Pencere Büyütme IPC | `windows-player/main.js`, `preload.js` |
| **TASK-2** | ⚠️ Çakışma Düzeltmeleri | Hata Toleranslı İndirme Motoru (3x Retry) ve Stream Boru Koruması | `windows-player/downloads.js`, `server.js` |
| **TASK-3** | ⚠️ Çakışma Düzeltmeleri | Zaman Çubuğu Sürükleme Titremesi (Seekbar Jitter) ve Dublaj Ön Sorgu Optimizasyonu | `windows-player/renderer/app.js`, `server.js` |
| **TASK-4** | 🗑️ Temizlik | Eski İndirme Kartı Stilleri, Ölü CSS ve Arayüz Elemanlarının Temizlenmesi | `windows-player/renderer/styles.css`, `immersive.css`, `index.html` |
| **TASK-5** | 🗑️ Temizlik | Eski Kurulum Paketlerinin Temizlenmesi (2.6.0 / 2.6.1) ve Kod Fazlalıklarının Ayıklanması | `windows-player/release/`, `downloads.js` |
| **TASK-6** | 🚀 Yeni Özellikler (Oynatıcı) | Çift Tıklama Tam Ekran, Resim İçinde Resim (PiP), Fare Tekerleği Ses ve Zaman Çubuğu İpucu | `windows-player/renderer/app.js`, `index.html`, `immersive.css` |
| **TASK-7** | 🚀 Yeni Özellikler (Oynatıcı) | Sonraki Bölüm Otomatik Geçiş Sayacı, Altyazı Boyut/Senkron Ayarı ve Gelişmiş Kısayollar | `windows-player/renderer/app.js`, `index.html`, `immersive.css` |
| **TASK-8** | 🚀 Yeni Özellikler (Katalog) | Filmler & Diziler Sayfalaması (Infinite Scroll/Daha Fazla), Tür Filtreleri ve Fragman Modalı | `windows-player/renderer/app.js`, `index.html`, `immersive.css`, `server.js` |
| **TASK-9** | 🚀 Yeni Özellikler (İndirme) | İndirmede Anlık Hız (MB/s), Kalan Süre (ETA) ve "Klasörde Göster" Butonu | `windows-player/renderer/app.js`, `downloads.js`, `server.js` |
| **TASK-10**| 📦 Derleme & Kurulum | v2.7.0 Sürüm Yükseltme, Otomatik Testler, Windows x64 NSIS Derleme ve Kurulum Doğrulaması | `windows-player/package.json`, `release/` |

---

### Task 1: Tek Örnek Kilidi, Dinamik Port, Uyku Engeli ve Pencere Büyütme IPC

**Files:**
- Modify: `windows-player/main.js`
- Modify: `windows-player/preload.js`

**Adımlar:**
1. `app.requestSingleInstanceLock()` kontrolü ekle: İkinci açılışta `second-instance` yakalanarak `mainWindow.focus()` yapılsın, yeni süreç hemen kapansın.
2. `powerSaveBlocker` ekle: Renderer'dan video oynatılıyor bilgisi geldiğinde ekran kapanması engellensin (`prevent-display-sleep`), duraklatıldığında serbest bırakılsın.
3. Port çakışması koruması: Port 47831 dinlenemezse port `0` (dinamik boş port) denenerek BrowserWindow doğrudan o porta yönlendirilsin.
4. Pencere büyütüldüğünde (`maximize`, `unmaximize`) `maxen:window-state-changed` renderer'a bildirilsin.
5. "Klasörde Göster" IPC handler'ı (`shell.showItemInFolder`) tanımlansın.
6. `preload.js` içine `onWindowStateChange`, `showInFolder`, `setPlaybackActive` API'leri güvenle aktarılsın.

---

### Task 2: Hata Toleranslı İndirme Motoru (3x Retry) ve Stream Boru Koruması

**Files:**
- Modify: `windows-player/downloads.js`
- Modify: `windows-player/server.js`

**Adımlar:**
1. `downloads.js` içerisindeki `writeResource` fonksiyonuna 3 denemeli ve üstel gecikmeli (500ms, 1500ms, 3000ms) retry mantığı ekle.
2. HLS indirmesinde tek bir segment hata verirse hemen tüm klasör silinmesin; 3 deneme de başarısız olursa temizlensin.
3. `server.js` içerisindeki `proxyStream` fonksiyonunda `Readable.fromWeb(response.body).pipe(res)` kısmına `res.on('close')` ve `pipeline` hata yakalayıcıları eklenerek erken kapanmalarda çökmeler önlensin.

---

### Task 3: Zaman Çubuğu Sürükleme Titremesi (Seekbar Jitter) ve Dublaj Ön Sorgu Optimizasyonu

**Files:**
- Modify: `windows-player/renderer/app.js`
- Modify: `windows-player/server.js`

**Adımlar:**
1. `app.js` içine `isDraggingSeek` durumu ekle.
2. Zaman çubuğu `mousedown` / `input` sırasında `timeupdate` olayının `seek.value` değerini ezmesi engellensin; `change` veya `mouseup` anında video yeni saniyeye atlansın.
3. `discoverDub` fonksiyonunun video oynatımı başlar başlamaz tüm akışları ağır şekilde kazıması yerine; yalnızca dizi bölümünde dublaj bayrağını hafifçe kontrol etmesi, gerçek akış çözümünün yalnızca kullanıcı "Türkçe Dublaj" sesini seçtiğinde yapılması sağlansın.

---

### Task 4: Eski İndirme Kartı Stilleri, Ölü CSS ve Arayüz Elemanlarının Temizlenmesi

**Files:**
- Modify: `windows-player/renderer/styles.css`
- Modify: `windows-player/renderer/immersive.css`
- Modify: `windows-player/renderer/index.html`

**Adımlar:**
1. `styles.css` ve `immersive.css` içindeki eski kullanılmayan `.downloadEntry`, `.downloadArt`, `.downloadInfo`, `.downloadRowActions`, `.downloadDelete`, `.downloadPlay` sınıflarını tamamen sil.
2. HTML'de bulunmayan `.centerPlay`, `.playerBrand`, `.playingBadge`, `.skip`, `.volumeButton`, `<dialog>` CSS kurallarını ayıkla.
3. `index.html` içerisindeki gizli `.profile` div'ini ve formun içindeki gereksiz gizli submit butonunu temizle.
4. `#player .playerControls` üzerindeki 4 katmanlı `!important` içeren CSS çatışmalarını temizle, tek ve tutarlı bir kural altında birleştir.

---

### Task 5: Eski Kurulum Paketlerinin Temizlenmesi (2.6.0 / 2.6.1) ve Kod Fazlalıklarının Ayıklanması

**Files:**
- Delete: `windows-player/release/Maxen-Setup-2.6.0-Windows-x64.exe`
- Delete: `windows-player/release/Maxen-Setup-2.6.0-Windows-x64.exe.blockmap`
- Delete: `windows-player/release/Maxen-Setup-2.6.1-Windows-x64.exe`
- Delete: `windows-player/release/Maxen-Setup-2.6.1-Windows-x64.exe.blockmap`
- Modify: `windows-player/downloads.js` (kullanılmayan `attributes` dışa aktarımını kaldır)

**Adımlar:**
1. Eski 2.6.0 ve 2.6.1 kurulum dosyalarını diskten temizle (~220 MB kazanım).
2. `downloads.js` içindeki ölü export'ları kaldır.

---

### Task 6: Oynatıcı Çift Tıklama Tam Ekran, Resim İçinde Resim (PiP), Fare Tekerleği Ses ve Zaman Çubuğu İpucu

**Files:**
- Modify: `windows-player/renderer/index.html`
- Modify: `windows-player/renderer/app.js`
- Modify: `windows-player/renderer/immersive.css`

**Adımlar:**
1. Video alanına çift tıklama (`dblclick`) ile tam ekrana geçme/çıkma davranışı ekle.
2. Oynatıcı kontrol çubuğuna PiP butonu (`#pipToggle`) ekle; `document.pictureInPictureEnabled` ile `video.requestPictureInPicture()` tetiklensin.
3. Oynatıcı üzerinde fare tekerleği (`wheel`) dinleyicisi ekle: Yukarı tekerlek sesi %5 artırsın, aşağı tekerlek sesi %5 azaltsın; arayüzde kısa süreli ses balonu gösterilsin.
4. Zaman çubuğu üzerine fare getirildiğinde (`mousemove`) fare imlecinin üzerindeki saniyeyi (`01:23:45`) gösteren zaman ipucu balonu (`#seekTooltip`) ekle.

---

### Task 7: Sonraki Bölüm Otomatik Geçiş Sayacı, Altyazı Boyut/Senkron Ayarı ve Gelişmiş Kısayollar

**Files:**
- Modify: `windows-player/renderer/index.html`
- Modify: `windows-player/renderer/app.js`
- Modify: `windows-player/renderer/immersive.css`

**Adımlar:**
1. Dizi izlenirken son 30 saniyeye gelindiğinde sağ altta "Sonraki Bölüm (10 sn sonra oynatılacak)" sayacı çıksın; tıklandığında hemen geçsin, "İptal" tıklandığında kapansın.
2. Oynatıcı ayarlar paneline Altyazı Boyutu (Küçük 18px, Normal 23px, Büyük 28px) ve Altyazı Senkronu (-1s, -0.5s, 0, +0.5s, +1s) seçeneği ekle.
3. Medya kısayolları ekle: `J` (10s geri), `K` (duraklat/oynat), `L` (10s ileri), `M` (sessiz), `0-9` (% atlama), `Esc` (oynatıcıdan çıkış).

---

### Task 8: Filmler & Diziler Sayfalaması (Infinite Scroll/Daha Fazla), Tür Filtreleri ve Fragman Modalı

**Files:**
- Modify: `windows-player/server.js`
- Modify: `windows-player/renderer/app.js`
- Modify: `windows-player/renderer/index.html`
- Modify: `windows-player/renderer/immersive.css`

**Adımlar:**
1. `server.js` içerisindeki `/api/discover` uç noktasına `genre` filtresi desteği ekle.
2. "Filmler" ve "Diziler" sayfalarında üst kısma popüler tür etiketleri (Tümü, Aksiyon, Komedi, Dram, Korku, Bilim Kurgu vb.) ekle.
3. Sayfa sonuna inildiğinde otomatik sayfa artırımı (Infinite Scroll) veya "Daha Fazla Göster" butonu ile 20 içerik sınırını kaldır.
4. Detay ekranına "Fragman İzle" butonu ekle; TMDB video API'sinden YouTube fragman kimliğini çekip yerel bir fragman oynatıcı modalında aç.
5. Oyuncu kadrosundaki isimleri tıklanabilir yap; tıklandığında oyuncunun yer aldığı içerikleri arama sayfasına yönlendir.

---

### Task 9: İndirmede Anlık Hız (MB/s), Kalan Süre (ETA) ve "Klasörde Göster" Butonu

**Files:**
- Modify: `windows-player/downloads.js`
- Modify: `windows-player/server.js`
- Modify: `windows-player/renderer/app.js`
- Modify: `windows-player/renderer/immersive.css`

**Adımlar:**
1. `downloads.js` içinde indirme süresince `downloadedBytes`, `speedBps` ve `etaSeconds` hesaplaması ekle.
2. İndirilenler ekranında her kart için tamamlanmışsa "Klasörde Göster" butonu ekle (`window.maxenDesktop.showInFolder(entry.id)`).
3. Devam eden indirmelerde yüzde ve hız göstergesi ekle (`%64 · 3.8 MB/s · 45 sn kaldı`).

---

### Task 10: v2.7.0 Sürüm Yükseltme, Otomatik Testler, Windows x64 NSIS Derleme ve Kurulum Doğrulaması

**Files:**
- Modify: `windows-player/package.json`
- Test: `windows-player/test-downloads.cjs`
- Test: `windows-player/test-offline.cjs`
- Output: `windows-player/release/Maxen-Setup-2.7.0-Windows-x64.exe`

**Adımlar:**
1. `windows-player/package.json` sürümünü `2.7.0` yap.
2. `node windows-player/test-downloads.cjs` ve `node windows-player/test-offline.cjs` testlerini çalıştırıp doğrula.
3. `electron-builder` ile yeni Windows kurulum paketini derle.
4. Kurulum paketini sessiz/kullanıcı modunda çalıştırarak bilgisayara temiz v2.7.0 kurulumunu yap.
