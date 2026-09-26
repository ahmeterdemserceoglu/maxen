import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import {
  UserProfileDoc,
  UserPresence,
  FriendRelation,
  WatchPartyInvite,
  FriendStatus,
} from '@/types/social';

/**
 * Username validation regex: 3-15 chars, lowercase letters, numbers, and underscores only.
 */
export const USERNAME_REGEX = /^[a-z0-9_]{3,15}$/;

/**
 * Validate username format.
 * Returns valid boolean and human-friendly Turkish error message if invalid.
 */
export function validateUsernameFormat(username: string): { valid: boolean; error?: string } {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Kullanıcı adı boş olamaz.' };
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return { valid: false, error: 'Kullanıcı adı en az 3 karakter olmalıdır.' };
  }

  if (trimmed.length > 15) {
    return { valid: false, error: 'Kullanıcı adı en fazla 15 karakter olabilir.' };
  }

  if (/[A-Z]/.test(trimmed)) {
    return { valid: false, error: 'Kullanıcı adı yalnızca küçük harfler içerebilir.' };
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    return {
      valid: false,
      error: 'Yalnızca küçük harfler (a-z), rakamlar (0-9) ve alt çizgi (_) kullanılabilir.',
    };
  }

  return { valid: true };
}

/**
 * Check if a username is available in /usernames/{username}.
 */
/**
 * Username belongs to the Firebase account (uid), never to a Netflix-style profile.
 * A taken name owned by the same uid is treated as available (edit / keep).
 */
export function isUsernameOwnedByOther(
  existingUid?: string | null,
  currentUid?: string | null
): boolean {
  if (!existingUid) return false;
  if (currentUid && existingUid === currentUid) return false;
  return true;
}

export async function checkUsernameAvailable(
  username: string,
  currentUid?: string
): Promise<boolean> {
  const normalized = username.trim().toLowerCase();
  const formatValidation = validateUsernameFormat(normalized);
  if (!formatValidation.valid) {
    return false;
  }

  try {
    const usernameDocRef = doc(db, 'usernames', normalized);
    const snap = await getDoc(usernameDocRef);
    if (!snap.exists()) return true;
    return !isUsernameOwnedByOther(snap.data()?.uid, currentUid);
  } catch (error) {
    console.warn('checkUsernameAvailable error:', error);
    return false;
  }
}

/**
 * Atomically registers a username in /usernames/{username} and updates /users/{uid}.
 */
export async function registerUsername(
  uid: string,
  username: string,
  displayName: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  const normalized = username.trim().toLowerCase();
  const formatValidation = validateUsernameFormat(normalized);
  if (!formatValidation.valid) {
    return { success: false, error: formatValidation.error };
  }

  try {
    await runTransaction(db, async (transaction) => {
      const usernameDocRef = doc(db, 'usernames', normalized);
      const userDocRef = doc(db, 'users', uid);

      const usernameSnap = await transaction.get(usernameDocRef);
      const userSnap = await transaction.get(userDocRef);
      if (usernameSnap.exists() && usernameSnap.data()?.uid !== uid) {
        throw new Error('Bu kullanıcı adı zaten alınmış.');
      }

      const previousUsername = (userSnap.data()?.username || '').trim().toLowerCase();
      if (previousUsername && previousUsername !== normalized) {
        const previousRef = doc(db, 'usernames', previousUsername);
        const previousSnap = await transaction.get(previousRef);
        if (previousSnap.exists() && previousSnap.data()?.uid === uid) {
          transaction.delete(previousRef);
        }
      }

      const now = Date.now();

      transaction.set(usernameDocRef, {
        uid,
        username: normalized,
        createdAt: usernameSnap.data()?.createdAt || now,
      });

      transaction.set(
        userDocRef,
        {
          uid,
          username: normalized,
          displayName: displayName.trim() || normalized,
          email: email.trim(),
          updatedAt: now,
        },
        { merge: true }
      );
    });

    return { success: true };
  } catch (error: any) {
    console.warn('registerUsername error:', error);
    return { success: false, error: error?.message || 'Kullanıcı adı kaydedilemedi.' };
  }
}

/**
 * Fetches user profile from /users/{uid}.
 */
export async function getUserProfile(uid: string): Promise<UserProfileDoc | null> {
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);

    if (!snap.exists()) {
      return null;
    }

    const data = snap.data();
    return {
      uid,
      username: data.username || '',
      displayName: data.displayName || data.username || 'Kullanıcı',
      email: data.email || '',
      avatarColor: data.avatarColor || '#E50914',
      hidePresence: !!data.hidePresence,
      createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? Date.now(),
    };
  } catch (error) {
    console.warn('getUserProfile error:', error);
    return null;
  }
}

/**
 * Searches users by username prefix in /users collection.
 */
export async function searchUsersByUsername(
  queryStr: string,
  currentUid: string
): Promise<UserProfileDoc[]> {
  const cleanQuery = queryStr.trim().toLowerCase().replace(/^@+/, '');
  if (!cleanQuery || cleanQuery.length < 2) {
    return [];
  }

  try {
    const usersCol = collection(db, 'users');
    const q = query(
      usersCol,
      where('username', '>=', cleanQuery),
      where('username', '<=', cleanQuery + '\uf8ff'),
      limit(15)
    );

    const snap = await getDocs(q);
    const results: UserProfileDoc[] = [];

    snap.forEach((docSnap) => {
      if (docSnap.id === currentUid) return;
      const data = docSnap.data();
      if (!data.username) return;

      results.push({
        uid: docSnap.id,
        username: data.username,
        displayName: data.displayName || data.username || 'Kullanıcı',
        email: data.email || '',
        avatarColor: data.avatarColor || '#E50914',
        hidePresence: !!data.hidePresence,
        createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? 0,
      });
    });

    return results;
  } catch (error) {
    console.warn('searchUsersByUsername error:', error);
    return [];
  }
}

/**
 * Pure function to construct a UserPresence payload.
 */
export function createPresencePayload(
  user: { uid: string; username?: string; displayName?: string },
  status: 'online' | 'watching' | 'offline',
  media?: any
): UserPresence {
  const cleanUsername = (user.username || user.displayName || 'Kullanıcı')
    .replace(/^@+/, '')
    .toLowerCase();

  return {
    uid: user.uid,
    username: cleanUsername,
    displayName: user.displayName || user.username || 'Kullanıcı',
    status,
    media:
      status === 'watching' && media
        ? {
            id: media.id || media.tmdbId,
            tmdbId: media.tmdbId ? String(media.tmdbId) : media.id ? String(media.id) : undefined,
            title: media.title || media.name || media.show_title || 'İçerik',
            type:
              media.type === 'tv' || media.seasonNumber || media.season_number ? 'tv' : 'movie',
            posterUrl: media.posterUrl || media.poster_path || null,
            seasonNum: media.seasonNum ?? media.seasonNumber ?? media.season_number ?? undefined,
            episodeNum:
              media.episodeNum ?? media.episodeNumber ?? media.episode_number ?? undefined,
          }
        : null,
    lastSeen: Date.now(),
  };
}

/**
 * Updates /presence/{uid} with status, timestamp, and optional media details.
 */
export async function updateLivePresence(
  user: { uid: string; username?: string; displayName?: string; hidePresence?: boolean },
  status: 'online' | 'watching' | 'offline',
  media?: any
): Promise<void> {
  if (!user?.uid) return;

  try {
    const presenceRef = doc(db, 'presence', user.uid);
    const effectiveStatus = user.hidePresence && status !== 'offline' ? 'offline' : status;
    const rawPayload = createPresencePayload(user, effectiveStatus, media);
    const payload = {
      ...rawPayload,
      media: rawPayload.media
        ? Object.fromEntries(Object.entries(rawPayload.media).filter(([, value]) => value !== undefined))
        : null,
    };

    await setDoc(presenceRef, payload, { merge: true });
  } catch (error) {
    console.warn('updateLivePresence error:', error);
  }
}

/**
 * Listen to a single user's presence from /presence/{uid}.
 */
export function subscribeToUserPresence(
  uid: string,
  callback: (presence: UserPresence | null) => void
) {
  const presenceRef = doc(db, 'presence', uid);
  return onSnapshot(
    presenceRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserPresence;
        const isStale = Date.now() - (data.lastSeen || 0) > 6 * 60 * 1000;
        if (isStale && data.status !== 'offline') {
          callback({ ...data, status: 'offline' });
        } else {
          callback(data);
        }
      } else {
        callback(null);
      }
    },
    (error) => {
      console.warn('subscribeToUserPresence error:', error);
    }
  );
}

/**
 * Listen to presences for a list of friend UIDs.
 */
export function subscribeToFriendPresences(
  friendUids: string[],
  callback: (presences: Record<string, UserPresence>) => void
) {
  if (friendUids.length === 0) {
    callback({});
    return () => {};
  }

  const presencesMap: Record<string, UserPresence> = {};
  const unsubs = friendUids.map((uid) => {
    return subscribeToUserPresence(uid, (presence) => {
      if (presence) {
        presencesMap[uid] = presence;
      } else {
        delete presencesMap[uid];
      }
      callback({ ...presencesMap });
    });
  });

  return () => {
    unsubs.forEach((unsub) => unsub());
  };
}

/**
 * Real-time listener for /friends/{uid}/userFriends.
 */
export function subscribeToFriends(
  uid: string,
  callback: (friends: FriendRelation[]) => void
) {
  const friendsCol = collection(db, 'friends', uid, 'userFriends');
  return onSnapshot(
    friendsCol,
    (snap) => {
      const list: FriendRelation[] = snap.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          friendUid: data.friendUid || docSnap.id,
          friendUsername: data.friendUsername || 'Kullanıcı',
          friendDisplayName: data.friendDisplayName || data.friendUsername || 'Kullanıcı',
          status: data.status as FriendStatus,
          updatedAt: data.updatedAt?.toMillis?.() ?? data.updatedAt ?? Date.now(),
        };
      });
      callback(list);
    },
    (error) => {
      console.warn('subscribeToFriends error:', error);
    }
  );
}

/**
 * Sends a friend request by creating bidirectional entries:
 * - /friends/{currentUser.uid}/userFriends/{targetUser.uid} -> pending_sent
 * - /friends/{targetUser.uid}/userFriends/{currentUser.uid} -> pending_received
 */
export async function sendFriendRequest(
  currentUser: { uid: string; username?: string; displayName?: string },
  targetUser: { uid: string; username: string; displayName: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (currentUser.uid === targetUser.uid) {
      return { success: false, error: 'Kendinize arkadaşlık isteği gönderemezsiniz.' };
    }

    const batch = writeBatch(db);
    const now = Date.now();

    const senderUsername = (currentUser.username || currentUser.displayName || 'Kullanıcı')
      .replace(/^@+/, '')
      .toLowerCase();
    const senderDisplayName = currentUser.displayName || currentUser.username || 'Kullanıcı';

    const targetUsername = targetUser.username.replace(/^@+/, '').toLowerCase();
    const targetDisplayName = targetUser.displayName || targetUser.username;

    const senderRef = doc(db, 'friends', currentUser.uid, 'userFriends', targetUser.uid);
    const receiverRef = doc(db, 'friends', targetUser.uid, 'userFriends', currentUser.uid);

    batch.set(senderRef, {
      friendUid: targetUser.uid,
      friendUsername: targetUsername,
      friendDisplayName: targetDisplayName,
      status: 'pending_sent' as FriendStatus,
      updatedAt: now,
    });

    batch.set(receiverRef, {
      friendUid: currentUser.uid,
      friendUsername: senderUsername,
      friendDisplayName: senderDisplayName,
      status: 'pending_received' as FriendStatus,
      updatedAt: now,
    });

    await batch.commit();
    return { success: true };
  } catch (error: any) {
    console.warn('sendFriendRequest error:', error);
    return { success: false, error: error?.message || 'İstek gönderilemedi.' };
  }
}

/**
 * Accepts an incoming friend request by updating both documents to 'accepted'.
 */
export async function acceptFriendRequest(
  currentUid: string,
  friendUid: string
): Promise<void> {
  const batch = writeBatch(db);
  const now = Date.now();

  const myFriendRef = doc(db, 'friends', currentUid, 'userFriends', friendUid);
  const targetFriendRef = doc(db, 'friends', friendUid, 'userFriends', currentUid);

  batch.update(myFriendRef, { status: 'accepted' as FriendStatus, updatedAt: now });
  batch.update(targetFriendRef, { status: 'accepted' as FriendStatus, updatedAt: now });

  await batch.commit();
}

/**
 * Removes a friend relation by deleting documents from both users' collections.
 */
export async function removeFriend(
  currentUid: string,
  friendUid: string
): Promise<void> {
  const batch = writeBatch(db);

  const myFriendRef = doc(db, 'friends', currentUid, 'userFriends', friendUid);
  const targetFriendRef = doc(db, 'friends', friendUid, 'userFriends', currentUid);

  batch.delete(myFriendRef);
  batch.delete(targetFriendRef);

  await batch.commit();
}

/**
 * Sends a watch party invitation to /invites/{friendUid}/partyInvites.
 */
export async function sendWatchPartyInvite(
  sender: { uid: string; username?: string; displayName?: string },
  friendUid: string,
  roomCode: string,
  media: any
): Promise<WatchPartyInvite> {
  const invitesCol = collection(db, 'invites', friendUid, 'partyInvites');
  const inviteRef = doc(invitesCol);

  const invite: WatchPartyInvite = {
    id: inviteRef.id,
    senderUid: sender.uid,
    senderUsername: (sender.username || sender.displayName || 'Arkadaş').replace(/^@+/, ''),
    senderDisplayName: sender.displayName || sender.username || 'Arkadaş',
    roomCode: roomCode.trim().toUpperCase(),
    media: {
      id: media.id || media.tmdbId,
      tmdbId: media.tmdbId || media.id,
      title: media.title || media.name || media.show_title || 'İçerik',
      type: media.type || (media.seasonNumber ? 'tv' : 'movie'),
      posterUrl: media.posterUrl || media.poster_path || '',
      seasonNumber: media.seasonNumber || media.season_number || undefined,
      episodeNumber: media.episodeNumber || media.episode_number || undefined,
      episodeTitle: media.episode_title || media.episodeTitle || undefined,
    },
    status: 'pending',
    createdAt: Date.now(),
  };

  await setDoc(inviteRef, invite);
  return invite;
}

/**
 * Real-time listener for pending invites in /invites/{uid}/partyInvites.
 */
export function subscribeToWatchPartyInvites(
  uid: string,
  callback: (invites: WatchPartyInvite[]) => void
) {
  const invitesCol = collection(db, 'invites', uid, 'partyInvites');
  const q = query(
    invitesCol,
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc'),
    limit(5)
  );

  return onSnapshot(
    q,
    (snap) => {
      const invites: WatchPartyInvite[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          senderUid: data.senderUid,
          senderUsername: data.senderUsername || 'Arkadaş',
          senderDisplayName: data.senderDisplayName || data.senderUsername || 'Arkadaş',
          roomCode: data.roomCode,
          media: data.media,
          status: data.status,
          createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? Date.now(),
        };
      });
      callback(invites);
    },
    (error) => {
      console.warn('subscribeToWatchPartyInvites error:', error);
    }
  );
}

/**
 * Respond to a watch party invite by setting status to 'accepted' or 'declined'.
 */
export async function respondToWatchPartyInvite(
  recipientUid: string,
  inviteId: string,
  status: 'accepted' | 'declined'
): Promise<void> {
  try {
    const inviteRef = doc(db, 'invites', recipientUid, 'partyInvites', inviteId);
    await updateDoc(inviteRef, {
      status,
      respondedAt: Date.now(),
    });
  } catch (error) {
    console.warn('respondToWatchPartyInvite error:', error);
  }
}

/**
 * Check if targetUid is an accepted friend of currentUid.
 */
export async function isAcceptedFriend(currentUid: string, targetUid: string): Promise<boolean> {
  if (!currentUid || !targetUid) return false;
  if (currentUid === targetUid) return true;
  try {
    const friendDocRef = doc(db, 'friends', currentUid, 'userFriends', targetUid);
    const snap = await getDoc(friendDocRef);
    if (!snap.exists()) return false;
    return snap.data()?.status === 'accepted';
  } catch (e) {
    console.warn('isAcceptedFriend check error:', e);
    return false;
  }
}

export interface FriendProfileDetail {
  user: UserProfileDoc;
  presence?: UserPresence;
  isFriend: boolean;
  continueWatching: any[];
  favorites: any[];
}

/**
 * Fetch friend profile details and their watching activity (continueWatching and favorites).
 * Strictly enforces privacy: if not friends, returns isFriend: false and no watching data!
 */
export async function getFriendProfileDetail(
  currentUid: string,
  friendUid: string
): Promise<FriendProfileDetail | null> {
  if (!currentUid || !friendUid) return null;

  // 1. Privacy Check: Must be accepted friends or self
  const isFriend = await isAcceptedFriend(currentUid, friendUid);
  if (!isFriend && currentUid !== friendUid) {
    const userProfile = await getUserProfile(friendUid);
    if (!userProfile) return null;
    return {
      user: userProfile,
      isFriend: false,
      continueWatching: [],
      favorites: [],
    };
  }

  // 2. Fetch User Profile Doc & Live Presence
  const [userProfile, presenceSnap] = await Promise.all([
    getUserProfile(friendUid),
    getDoc(doc(db, 'presence', friendUid)),
  ]);

  if (!userProfile) return null;

  const presence = presenceSnap.exists()
    ? (presenceSnap.data() as UserPresence)
    : undefined;

  // 3. Fetch friend's profiles list to get continueWatching and favorites
  const continueWatchingItems: any[] = [];
  const favoritesItems: any[] = [];

  try {
    const profilesSnap = await getDocs(collection(db, 'users', friendUid, 'profiles'));
    
    const profilePromises = profilesSnap.docs.map(async (pDoc) => {
      const pId = pDoc.id;
      try {
        const [cwSnap, favSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, 'users', friendUid, 'profiles', pId, 'continueWatching'),
              orderBy('savedAt', 'desc'),
              limit(15)
            )
          ),
          getDocs(
            query(
              collection(db, 'users', friendUid, 'profiles', pId, 'favorites'),
              orderBy('savedAt', 'desc'),
              limit(20)
            )
          ),
        ]);

        cwSnap.docs.forEach((d) => {
          const data = d.data();
          continueWatchingItems.push({
            id: data.id || d.id,
            tmdbId: data.tmdbId || data.id,
            title: data.title || data.name || 'İçerik',
            posterUrl: data.posterUrl || data.poster_path || null,
            backdropUrl: data.backdropUrl || data.backdrop_path || null,
            type: data.type || (data.seasonNumber ? 'tv' : 'movie'),
            seasonNumber: data.seasonNumber || data.season_number,
            episodeNumber: data.episodeNumber || data.episode_number,
            episodeTitle: data.episodeTitle || data.episode_title,
            progress: data.progress ?? 0,
            savedAt: data.savedAt?.toMillis?.() ?? data.savedAt ?? 0,
          });
        });

        favSnap.docs.forEach((d) => {
          const data = d.data();
          favoritesItems.push({
            id: data.id || d.id,
            tmdbId: data.tmdbId || data.id,
            title: data.title || data.name || 'İçerik',
            posterUrl: data.posterUrl || data.poster_path || null,
            type: data.type || 'movie',
            rating: data.rating,
            year: data.year,
          });
        });
      } catch (err) {
        console.warn(`Error reading profile ${pId} media:`, err);
      }
    });

    await Promise.all(profilePromises);
  } catch (e) {
    console.warn('Error fetching friend continueWatching/favorites:', e);
  }

  // Deduplicate and sort continue watching
  const uniqueCW = Array.from(
    new Map(continueWatchingItems.map((item) => [String(item.id || item.tmdbId), item])).values()
  ).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

  const uniqueFav = Array.from(
    new Map(favoritesItems.map((item) => [String(item.id || item.tmdbId), item])).values()
  );

  return {
    user: userProfile,
    presence,
    isFriend: true,
    continueWatching: uniqueCW,
    favorites: uniqueFav,
  };
}

/**
 * Format relative time in Turkish (e.g. "5 dk önce", "2 saat önce", "Dün").
 */
export function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return 'Bilinmiyor';
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Az önce';
  if (diffMinutes < 60) return `${diffMinutes} dk önce`;
  if (diffHours < 24) return `${diffHours} saat önce`;
  if (diffDays === 1) return 'Dün';
  if (diffDays < 7) return `${diffDays} gün önce`;
  return new Date(timestamp).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}
