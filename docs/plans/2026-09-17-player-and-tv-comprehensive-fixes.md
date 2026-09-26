# Kapsamlı Oynatıcı, Bölüm Geçişi, Altyazı ve Android TV Düzeltme Planı

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Oynatıcıdaki bölüm geçişi kilitlenmelerini, asenkron stream yarışlarını, 1Hz altyazı gecikmesini, TV kumanda dinleyici kararsızlığını ve ilerleme tutarsızlıklarını kalıcı olarak çözmek.

**Architecture:** Oynatıcı yaşam döngüsü tek bir generation guard ile korunacak. `currentMediaKey` değiştiğinde tüm oynatıcı durumları atomik olarak sıfırlanacak. Altyazı eşleşmesi 200ms hafif döngüye ve eşzamanlılık kontrollü HLS indirmesine kavuşacak. TV kumandası dinleyicisi ref tabanlı tek bir yaşam döngüsüne bağlanacak. Tamamlanma eşiği 0.95 olarak tekilleştirilecek.

**Tech Stack:** React Native, Expo Video, TypeScript, Android TV, Jest, Firebase Firestore.

---

### Task 1: Oynatıcı Yaşam Döngüsü ve Bölüm Geçiş Kilitlenmelerini Giderme

**Files:**
- Modify: `src/views/VideoPlayerView.tsx`
- Test: `tests/playerReliability.test.ts`

**Steps:**
1. Medya kimliği (`currentMediaKey`) değiştiğinde `hasStartedRef.current`, `bingeTransitioningRef.current`, `isStreamFoundRef.current`, `autoRetryCountRef.current`, `providerIndexRef.current` bayraklarını sıfırla.
2. Önceki bölümün `streamUrl`, `error`, `loading`, `currentTime`, `duration`, `subtitles`, `externalCues`, `audioTracks`, `introData` değerlerini temizle.
3. `handlePlayNextEpisode` ve Watch Party geçişlerinde yeni medya yüklendiğinde `bingeTransitioningRef.current = false` yapılmasını garantiye al.

---

### Task 2: Asenkron Akış ve Kaynak Güvenliği (Generation Guard Entegrasyonu)

**Files:**
- Modify: `src/views/VideoPlayerView.tsx`
- Modify: `src/utils/playerReliability.ts`
- Test: `tests/playerReliability.test.ts`

**Steps:**
1. `createGenerationGuard()` çağrısını `VideoPlayerView.tsx` içinde ref olarak tanımla (`playbackGenerationGuardRef`).
2. Her medya/bölüm değişiminde veya retry işleminde nesli artır (`generationGuard.advance()`).
3. `startStreamResolution`, `fetchTurkishDubStream`, `loadExternalSubtitle`, `extractM3u8Subtitles`, `extractM3u8AudioTracks`, `fetchEpisodeIntro` asenkron operasyonlarına nesil kontrolü ekle.
4. Eski bölümlerden geç gelen asenkron sonuçların aktif bölümün state'ini ezmesini engelle.

---

### Task 3: Altyazı Senkronizasyon Hassasiyeti ve HLS İndirme Eşzamanlılığı

**Files:**
- Modify: `src/views/VideoPlayerView.tsx`
- Test: `tests/playerReliability.test.ts`

**Steps:**
1. Altyazı kontrolü için 200ms hafif interval/loop ekle; 1000ms'lik ağır interval gecikmesini ortadan kaldır.
2. `loadExternalSubtitle` içindeki `segmentUrls` indirmesini 6'lı gruplar (chunked concurrency) halinde sınırla.
3. Yeni altyazı seçildiğinde önceki altyazı indirmesini generation ve abort kontrolüyle geçersiz kıl.

---

### Task 4: TV Kumandası Dinleyicisi ve Focus Yaşam Döngüsünü Kararlı Hale Getirme

**Files:**
- Modify: `src/views/VideoPlayerView.tsx`
- Test: `tests/tvFocusNavigation.test.tsx`

**Steps:**
1. `DeviceEventEmitter.addListener('TVKeyEvent', ...)` dinleyicisini ref'ler üzerinden tek bir yaşam döngüsüne bağla.
2. Kontroller açılıp kapandığında native dinleyicinin unmount/remount edilmesini engelleyerek kumanda tuş kayıplarını ve sarma takılmalarını önle.

---

### Task 5: Yayınlanmamış Bölüm (Air Date) Doğrulaması ve Key Formatı Senkronizasyonu

**Files:**
- Modify: `src/features/player/services/introService.ts`
- Modify: `src/utils/playerReliability.ts`
- Test: `tests/playerReliability.test.ts`

**Steps:**
1. `getNextEpisodeMedia` içine `isAiredEpisode` ve `isEpisodeAdjacent` kontrollerini entegre et; çıkmamış bölümler için `null` dön.
2. `isPreheatedPayloadForMedia` fonksiyonunda hem `tv_123_1_1` hem `tv_123_S1E1` formatlarını destekle.

---

### Task 6: Tamamlanma Eşiği, Uyku Zamanlayıcısı ve Detay Sayfası İlerleme Tutarlılığı

**Files:**
- Modify: `src/services/profileMediaService.ts`
- Modify: `src/services/crossDeviceHandoffService.ts`
- Modify: `src/views/home/useHomeData.ts`
- Modify: `src/views/VideoPlayerView.tsx`
- Modify: `src/utils/watchProgress.ts`
- Test: `tests/playerReliability.test.ts`

**Steps:**
1. `COMPLETION_THRESHOLD = 0.95` sabitini tekilleştir ve tüm servislerde uygula.
2. Uyku zamanlayıcısı iptal edildiğinde kısılan ses seviyesini `originalVolumeRef.current` değerine geri döndür.
3. `getEpisodeProgress` içinde, aktif bölümden önceki tüm bölümleri `%100` (izlendi) olarak işaretle.

---

### Task 7: TV Yan Menü (TVSidebar) Sekme Debounce'ı

**Files:**
- Modify: `src/components/TVSidebar.tsx`

**Steps:**
1. `TVSidebar` dikey geçişlerinde `onTabSelect` çağrısına 200ms debounce ekle; hızlı gezinirken aradaki ekranların anlık render edilmesini engelle.

---

### Task 8: Regresyon Testleri ve Doğrulama

**Files:**
- Test: `tests/playerReliability.test.ts`
- Test: `tests/tvFocusNavigation.test.tsx`
- Modify: `docs/plans/task.md`

**Steps:**
1. `npm test` ile tüm birim ve entegrasyon testlerini doğrula.
2. `npx tsc --noEmit` ile TypeScript kontrolü yap.
3. `docs/plans/task.md` tablosunu güncelle.
