# Player Reliability Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Bölüm geçişi, izleme kaydı, stream çözümleme, Watch Party, TV/telefon kumandası ve altyazı akışlarını yarış koşullarına ve yanlış medya kimliğine karşı güvenli hale getirmek.

**Architecture:** Medya kimliği bütün akışlarda tek doğruluk kaynağı olacak. Kalıcı kayıtlar dizi başına güncel konumu temsil edecek; asenkron stream ve altyazı sonuçları oturum/sürüm anahtarlarıyla korunacak; TV odağı tek koordinatör üzerinden yönetilecek. Değişiklikler test-first küçük gruplar halinde uygulanacak.

**Tech Stack:** React Native, Expo Video, TypeScript, Firebase Firestore, Jest, Android TV Kotlin.

---

### Task 1: Continue Watching identity and ordered persistence

**Files:**
- Modify: `src/services/profileMediaService.ts`
- Modify: `src/views/home/useHomeData.ts`
- Modify: `src/views/VideoPlayerView.tsx`
- Test: `tests/playerReliability.test.ts`

**Steps:**
1. Write failing tests for show-level keys, monotonic writes, transition seed records, strict timestamp ordering and legacy-record deduplication.
2. Run the focused test and confirm expected failures.
3. Add deterministic continue-watching helpers and per-item serialized writes.
4. Migrate saves to a show-level TV document and clean legacy episode records after a successful save.
5. Save the validated next episode identity immediately during transition without carrying network stream data.
6. Run focused tests and TypeScript validation.

### Task 2: Stream session generation and source state

**Files:**
- Modify: `src/features/player/services/StreamSessionManager.ts`
- Modify: `src/views/VideoPlayerView.tsx`
- Modify: `src/features/player/services/streamResolverService.ts`
- Test: `tests/playerReliability.test.ts`

**Steps:**
1. Write failing tests for media-keyed sessions, generation invalidation, refresh-handler cleanup and failed-source rotation.
2. Run the focused test and confirm expected failures.
3. Require media keys in stream sessions and scope refresh handlers to the active media.
4. Add generation guards to every async stream, dub, quality and replacement operation.
5. Track source identity and reset quality data whenever the master source changes.
6. Rotate to the next provider after bounded retries and blacklist failed URLs for the current playback generation.
7. Run focused tests and TypeScript validation.

### Task 3: Watch Party and TV remote focus coordination

**Files:**
- Modify: `src/services/watchPartyService.ts`
- Modify: `src/views/VideoPlayerView.tsx`
- Modify: `src/utils/tvPlaybackControls.ts`
- Modify: `src/features/player/components/ProgressBar.tsx`
- Modify: `src/features/player/components/EpisodeActionButtons.tsx`
- Modify: `src/features/player/components/NextEpisodeCountdownOverlay.tsx`
- Test: `tests/tvFocusNavigation.test.tsx`
- Test: `tests/playerReliability.test.ts`

**Steps:**
1. Write failing tests for media revision transitions, timer invalidation, menu-safe virtual remote controls and zero-volume changes.
2. Run focused tests and confirm expected failures.
3. Broadcast media identity atomically when the host changes episode and make guests follow the host revision.
4. Replace overlapping remote-sync timers with one tracked timer.
5. Route virtual D-pad events through the same playback-intent rules as physical TV events.
6. Ensure only one player surface owns preferred focus at a time and restore focus after overlays.
7. Run focused tests and TypeScript validation.

### Task 4: Secondary identity and lifecycle safeguards

**Files:**
- Modify: `src/views/DetailView.tsx`
- Modify: `src/views/HomeView.tsx`
- Modify: `src/features/player/services/introService.ts`
- Modify: `src/views/VideoPlayerView.tsx`
- Modify: `src/services/crossDeviceHandoffService.ts`
- Modify: `src/app/index.tsx`
- Test: `tests/playerReliability.test.ts`

**Steps:**
1. Write failing tests for episode-bound downloads, preheat identity, next-episode adjacency/air dates, subtitle selection generations, sleep-volume restoration and aligned completion thresholds.
2. Run the focused test and confirm expected failures.
3. Bind download and preheat caches to complete episode identities.
4. Validate TMDB repair candidates and next-episode availability.
5. Cancel stale subtitle loads, limit HLS subtitle fetch concurrency and improve cue update frequency.
6. Restore volume on sleep-timer cancellation and align handoff completion behavior.
7. Stabilize TV remote subscription lifetimes with state refs.
8. Run focused tests and TypeScript validation.

### Task 5: Full regression verification

**Files:**
- Modify: `docs/plans/task.md`

**Steps:**
1. Run the complete Jest suite.
2. Run `npx tsc --noEmit`.
3. Run Android Kotlin compilation when a Java runtime is available; otherwise record the exact environment blocker.
4. Review all changed paths against the approved findings.
5. Mark TASK-89 completed only when all runnable checks pass and every finding is addressed.
