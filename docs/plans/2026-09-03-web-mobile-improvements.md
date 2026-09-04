# Web ve Mobil Geliştirme & Düzeltme Uygulama Planı

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Maxen projesinde Web ve Mobil platformlarındaki kritik hataları gidermek, masaüstü Netflix navigasyonunu aktifleştirmek, FlashList performansını optimize etmek, iOS/Android Store uyumluluğunu sağlamak ve web sesli aramayı entegre etmek.

**Architecture:** İstemci tarafında Expo Router + Zustand + FlashList; Backend/Edge tarafında Node.js Serverless ve Cloudflare Worker çözücüleri. Platforma özgü API'lar (Web Speech API, iOS Info.plist, Android Manifest maxSdkVersion) ile optimize edilir.

**Tech Stack:** React Native 0.81, Expo SDK 54, TypeScript 5.3, FlashList, Firebase, Jest.

---

### Task 1: Backend Stream Çözücü Çökmesini Giderme (`api/stream.js`)
**Files:**
- Modify: `api/stream.js:30-45`
- Test: `__tests__/streamResolver.test.ts`

**Step 1:** `api/stream.js` içinde `extractVixSrcStream` fonksiyonuna eksik olan `const expM = html.match(/['"]expires['"]:\s*['"]([^'"]+)['"]/);` satırını ekle.
**Step 2:** `const expires = expM ? expM[1] : '';` çağrısının ReferenceError vermeden doğru çalışmasını sağla.
**Step 3:** Testleri çalıştır: `npm test`

---

### Task 2: Masaüstü Web Netflix Navbar'ını Aktifleştirme & TVSidebar Ayrımı
**Files:**
- Modify: `src/app/index.tsx:460-490`
- Modify: `src/components/NetflixWebNavbar.tsx`

**Step 1:** `src/app/index.tsx` içinde masaüstü web (`isDesktopWeb`) için `NetflixWebNavbar` bileşenini üst kısma render et.
**Step 2:** `TVSidebar`'ı yalnızca `isTV` durumunda render et (desktop web'de kumanda odaklı sidebar yerine Netflix tarzı üst bar çıksın).
**Step 3:** Masaüstü web için `tvViewContainer` padding-left yerine padding-top: 68px ayarla (navbar altında içerik kalmaması için).
**Step 4:** Profil değiştirme, Watch Party ve Keşif Hub butonlarının callback bağlantılarını sağla.

---

### Task 3: FlashList Virtualization & Performans Optimizasyonu
**Files:**
- Modify: `src/views/home/MediaRow.tsx:538-555`
- Modify: `src/views/search/SearchResultGrid.tsx:197-215`
- Modify: `src/views/MediaHubView.tsx:380-410`

**Step 1:** `MediaRow.tsx` içindeki `<FlashList>` bileşenine `estimatedItemSize={180}` ekle.
**Step 2:** `SearchResultGrid.tsx` içindeki `<FlashList>` bileşenine `estimatedItemSize={280}` ekle.
**Step 3:** `MediaHubView.tsx` içindeki `<FlashList>` bileşenine `estimatedItemSize={260}` ekle.
**Step 4:** Konsoldaki sarı uyarıların temizlenmesini ve liste geri dönüşümünün (recycling) 60fps/120fps akmasını sağla.

---

### Task 4: Mobil Store Uyumluluğu (iOS & Android Yapılandırması)
**Files:**
- Modify: `app.json:9-12`
- Modify: `android/app/src/main/AndroidManifest.xml:4-9`

**Step 1:** `app.json` içindeki `ios` bloğuna `"bundleIdentifier": "com.maxen.app"` ekle.
**Step 2:** `app.json` `ios.infoPlist` içine `UIBackgroundModes: ["audio"]` ve `NSAppTransportSecurity` ekle.
**Step 3:** `android/app/src/main/AndroidManifest.xml` içinde `READ_EXTERNAL_STORAGE` ve `WRITE_EXTERNAL_STORAGE` izinlerine `android:maxSdkVersion="32"` ekleyerek Android 13+ Google Play Store retlerini önle.

---

### Task 5: Web İçin Sesli Arama Desteği (Web Speech API)
**Files:**
- Modify: `src/modules/VoiceRecognition.ts`

**Step 1:** `Platform.OS === 'web'` kontrolü ekle.
**Step 2:** Tarayıcı `window.webkitSpeechRecognition` veya `window.SpeechRecognition` API'si varsa bunu Promise tabanlı mikrofon dinleyicisine bağla.
**Step 3:** Web tarayıcılarında sesli aramanın yerel olarak çalışmasını sağla.

---

### Task 6: Jest Test Runner Timer Handle Temizliği
**Files:**
- Modify: `src/features/player/services/StreamSessionManager.ts:80-84`

**Step 1:** `this.refreshTimeout` oluşturulurken Node.js ortamında `.unref?.()` çağrısı ekle.
**Step 2:** Test koşusu bittiğinde Jest worker'ının asılı kalmasını önle.

---

### Task 7: Doğrulama ve Tam Test Koşusu
**Files:**
- Test: `npm test`
- Verification: `npx tsc --noEmit`
