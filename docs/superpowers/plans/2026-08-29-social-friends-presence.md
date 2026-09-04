# Maxen Social, Friends & Live Presence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete real-time Social ecosystem for Maxen including unique `@usernames`, live presence tracking ("Who's watching what"), friend list & requests, 1-click Watch Party invites, Media Hub, and updated navigation tabs.

**Architecture:** Firebase Firestore real-time collections (`/usernames`, `/users`, `/presence`, `/friends`, `/invites`) with decoupled service layer (`socialService.ts`), Zustand state bindings (`uiStore.ts`), and modular presentation views (`SocialView.tsx`, `MediaHubView.tsx`, `UsernameSetupModal.tsx`, `WatchPartyInviteModal.tsx`).

**Tech Stack:** React Native, Expo, Firebase Firestore, TypeScript, Jest, Zustand, TVFocusable.

**Spec:** [`docs/superpowers/specs/2026-08-29-social-friends-presence-design.md`](file:///c:/Users/ahmet/Desktop/maxen/docs/superpowers/specs/2026-08-29-social-friends-presence-design.md)

## Global Constraints
- All Firestore operations must adhere to security rules and use clean TypeScript interfaces.
- D-Pad / Android TV focus must be preserved across all newly created screens.
- Zero TypeScript errors (`npx tsc --noEmit`) and 100% test pass rate (`npm test`).

---

### Task 1: Firestore Social Security Rules & Social Types

**Files:**
- Create: `src/types/social.ts`
- Modify: `firestore.rules`
- Test: `__tests__/socialService.test.ts`

**Interfaces:**
- Produces: `UserProfile`, `UserPresence`, `FriendRelation`, `WatchPartyInvite`, `UsernameAvailabilityResult`

- [ ] **Step 1: Write `src/types/social.ts`**
Define interfaces for usernames, user profiles, live presence, friends relations, and party invites.

- [ ] **Step 2: Update `firestore.rules`**
Add rules for `/usernames/{username}`, `/users/{userId}`, `/presence/{userId}`, `/friends/{userId}/userFriends/{friendId}`, and `/invites/{userId}/partyInvites/{inviteId}`.

- [ ] **Step 3: Commit**
```bash
git add src/types/social.ts firestore.rules
git commit -m "feat(social): add social types and firestore rules"
```

---

### Task 2: Social & Presence Service Engine

**Files:**
- Create: `src/services/socialService.ts`
- Create: `__tests__/socialService.test.ts`

**Interfaces:**
- Produces: `checkUsernameAvailable`, `registerUsername`, `getUserProfile`, `updateLivePresence`, `subscribeToFriends`, `sendFriendRequest`, `acceptFriendRequest`, `removeFriend`, `sendWatchPartyInvite`, `subscribeToWatchPartyInvites`, `respondToWatchPartyInvite`

- [ ] **Step 1: Write the failing tests in `__tests__/socialService.test.ts`**
Unit tests for username validation regex, presence payload formatting, and friend relation statuses.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test __tests__/socialService.test.ts`

- [ ] **Step 3: Implement `src/services/socialService.ts`**
Implement Firestore methods with transactional uniqueness check and real-time snapshot subscribers.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm test __tests__/socialService.test.ts`

- [ ] **Step 5: Commit**
```bash
git add src/services/socialService.ts __tests__/socialService.test.ts
git commit -m "feat(social): implement socialService engine and unit tests"
```

---

### Task 3: Username Setup Modal

**Files:**
- Create: `src/components/UsernameSetupModal.tsx`

**Interfaces:**
- Consumes: `checkUsernameAvailable`, `registerUsername` from `src/services/socialService.ts`
- Produces: `<UsernameSetupModal visible={boolean} onComplete={() => void} />`

- [ ] **Step 1: Implement `UsernameSetupModal.tsx`**
Create clean modal with input debouncing, real-time availability check, character rules (`a-z0-9_`, 3-15 chars), and TV focus support.

- [ ] **Step 2: Commit**
```bash
git add src/components/UsernameSetupModal.tsx
git commit -m "feat(social): add UsernameSetupModal for new and existing users"
```

---

### Task 4: Media & Categories Hub Screen

**Files:**
- Create: `src/views/MediaHubView.tsx`

**Interfaces:**
- Produces: `<MediaHubView onSelectMedia={(media) => void} onSelectCategory={(cat) => void} />`

- [ ] **Step 1: Implement `MediaHubView.tsx`**
Build a segmented view switching between Movies and TV Series, featuring genre pills and categorized TMDB discovery rows.

- [ ] **Step 2: Commit**
```bash
git add src/views/MediaHubView.tsx
git commit -m "feat(media): create unified MediaHubView for movies and series"
```

---

### Task 5: Social & Friends Screen

**Files:**
- Create: `src/views/SocialView.tsx`

**Interfaces:**
- Consumes: `subscribeToFriends`, `sendFriendRequest`, `acceptFriendRequest`, `removeFriend` from `socialService.ts`
- Produces: `<SocialView onStartWatchParty={(friend, media) => void} onSelectMedia={(media) => void} />`

- [ ] **Step 1: Implement `SocialView.tsx`**
Build live friends list with online/watching cards, "Birlikte İzle" buttons, incoming requests modal, and username search drawer.

- [ ] **Step 2: Commit**
```bash
git add src/views/SocialView.tsx
git commit -m "feat(social): create SocialView with live activity and friend manager"
```

---

### Task 6: Real-Time Watch Party Invite Modal & VideoPlayerView Presence

**Files:**
- Create: `src/components/WatchPartyInviteModal.tsx`
- Modify: `src/views/VideoPlayerView.tsx`

**Interfaces:**
- Consumes: `subscribeToWatchPartyInvites`, `respondToWatchPartyInvite`, `updateLivePresence`
- Produces: `<WatchPartyInviteModal />`

- [ ] **Step 1: Implement `WatchPartyInviteModal.tsx`**
Real-time listener popping up when an invite is received with [Katıl] / [Reddet] actions.

- [ ] **Step 2: Bind playback presence in `VideoPlayerView.tsx`**
Call `updateLivePresence('watching', media)` on mount and `updateLivePresence('online', null)` on unmount.

- [ ] **Step 3: Commit**
```bash
git add src/components/WatchPartyInviteModal.tsx src/views/VideoPlayerView.tsx
git commit -m "feat(social): add WatchPartyInviteModal and video player live presence"
```

---

### Task 7: Main Navigation Tabs & TV Sidebar Reorganization

**Files:**
- Modify: `src/store/uiStore.ts`
- Modify: `src/app/index.tsx`
- Modify: `src/components/TVSidebar.tsx`
- Modify: `__tests__/uiStore.test.ts`

**Interfaces:**
- Replaces `movies` and `tv` tabs with `media` and `social`.

- [ ] **Step 1: Update `uiStore.ts` and `TABS` in `index.tsx` & `TVSidebar.tsx`**
Configure tabs: `home`, `media`, `social`, `search`, `settings`.

- [ ] **Step 2: Mount `UsernameSetupModal` and `WatchPartyInviteModal` in `index.tsx`**
Ensure global modals render over the active view.

- [ ] **Step 3: Update `__tests__/uiStore.test.ts`**
Verify new tab keys and modal states in tests.

- [ ] **Step 4: Commit**
```bash
git add src/store/uiStore.ts src/app/index.tsx src/components/TVSidebar.tsx __tests__/uiStore.test.ts
git commit -m "feat(nav): reorganize navigation tabs for media and social views"
```

---

### Task 8: Verification & Quality Gate

- [ ] **Step 1: Run TypeScript validation**
Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Run all Jest unit tests**
Run: `npm test`
Expected: 100% test pass rate across all suites.
