# Maxen Social: Friends, Live Presence & Watch Party Invites Design Document

## 1. Overview & Goals
The goal of this subsystem is to introduce a rich, real-time social platform inside Maxen:
1. **Unique Usernames & Onboarding**: Every user account has a unique `@username` registered in Firestore (`/usernames/{username}` & `/users/{uid}`). Existing users without a username are prompted via a non-intrusive `UsernameSetupModal` on launch.
2. **Tab Bar & Navigation Reorganization**: Reorganize main navigation into 5 clean tabs:
   - `home`: Ana Sayfa
   - `media`: Medya / Kategoriler (Filmler & Diziler Hub)
   - `social`: Sosyal & Arkadaşlar (Arkadaş Listesi, Canlı Aktivite, İstekler, Arama)
   - `search`: Keşfet / Arama
   - `settings`: Ayarlar & Profil
3. **Live Presence & Activity Tracking**:
   - Track live presence (`online`, `watching`, `idle`) with media metadata (title, poster, type, season/episode).
   - Real-time listeners for friend activity (*"Ahmet şu an Interstellar izliyor"*).
4. **1-Click Watch Party Invites**:
   - Send direct Watch Party invites to friends from either the player or the Social tab.
   - Incoming invites pop up as an interactive invitation banner/modal (*"Ahmet seni 'Fight Club' izlemeye davet etti"* -> [Katıl] / [Reddet]).

---

## 2. Architecture & Data Model (Firestore)

### 2.1 `/usernames/{username}` (Global Unique Index)
Fast lookup and atomic uniqueness reservation.
```typescript
interface UsernameDoc {
  uid: string;
  createdAt: number;
}
```

### 2.2 `/users/{uid}` (User Account Metadata)
```typescript
interface UserProfileDoc {
  uid: string;
  username: string; // e.g. "ahmet"
  displayName: string;
  email: string;
  avatarColor?: string;
  hidePresence?: boolean;
  createdAt: number;
}
```

### 2.3 `/presence/{uid}` (Live Activity)
Updated automatically on app state changes, playback start, seek, and playback end.
```typescript
interface UserPresence {
  uid: string;
  username: string;
  displayName: string;
  status: 'online' | 'watching' | 'offline';
  media?: {
    id: string | number;
    tmdbId?: string;
    title: string;
    type: 'movie' | 'tv';
    posterUrl?: string | null;
    seasonNum?: number;
    episodeNum?: number;
  };
  lastSeen: number;
}
```

### 2.4 `/friends/{uid}/userFriends/{friendUid}` & Friend Requests
```typescript
interface FriendRelation {
  friendUid: string;
  friendUsername: string;
  friendDisplayName: string;
  status: 'pending_sent' | 'pending_received' | 'accepted';
  updatedAt: number;
}
```

### 2.5 `/invites/{friendUid}/partyInvites/{inviteId}`
```typescript
interface WatchPartyInvite {
  id: string;
  senderUid: string;
  senderUsername: string;
  senderDisplayName: string;
  roomCode: string;
  media: any;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}
```

---

## 3. UI/UX Components

1. **`src/views/SocialView.tsx`**:
   - **Header**: User `@username`, friend count, Search & Add Friend button, Incoming Requests badge.
   - **Live Friends List**: Card per friend displaying avatar, online/watching status indicator, what they are watching with poster thumbnail, and a *"Birlikte İzle"* (Watch Together) action button.
   - **Incoming/Outgoing Friend Requests Modal**.
   - **Search & Add Friend Modal**: Live debounce search by username with 1-click *"İstek Gönder"*.
2. **`src/components/UsernameSetupModal.tsx`**:
   - Shown on app launch if `user && !userProfile.username`.
   - Real-time input check for regex `/^[a-z0-9_]{3,15}$/` and Firestore availability check.
3. **`src/components/WatchPartyInviteModal.tsx`**:
   - Real-time listener for `/invites/{currentUserUid}/partyInvites`.
   - Slide-in toast / interactive modal when a friend invites to a watch party with [Katıl] and [Kapat].
4. **`src/views/MediaHubView.tsx`**:
   - Clean unified hub for browsing Movies, TV Series, and Genres with responsive tabs or segmented control.
5. **Navigation Integration (`src/app/index.tsx` & `src/components/TVSidebar.tsx`)**:
   - Replaced old `movies`/`tv` tabs with `media` (Medya) and `social` (Sosyal).

---

## 4. Error Handling & Security
- **Firestore Security Rules**:
  - `/usernames/{username}`: create only if does not exist.
  - `/presence/{uid}`: write only if `request.auth.uid == uid`.
  - `/friends/{uid}/**`: read/write only if participant.
  - `/invites/{uid}/**`: sender can create, recipient can read/update status.
- **Offline & Graceful Degradation**:
  - Presence automatically marks as offline on app unmount or background state.

---

## 5. Verification & Testing Plan
- **Unit Tests (`__tests__/socialService.test.ts`)**:
  - Username format validation & sanitized lowercase regex.
  - Presence state transitions (`watching` -> `idle` -> `offline`).
  - Friend request acceptance and bidirectional friendship sync.
  - Watch Party invite creation and response lifecycle.
- **Type Checking (`npx tsc --noEmit`)**:
  - Zero TypeScript errors across all components.
- **E2E / Jest (`npm test`)**:
  - 100% test suite pass rate.
