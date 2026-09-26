import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  getDoc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import {
  type ProfileMediaItem,
  mediaDocId,
  normalizeMediaItem,
} from '@/types/profileMedia';
import {
  COMPLETION_THRESHOLD,
  getContinueWatchingDocId,
  selectLatestContinueWatching,
  SerialWriteQueue,
} from '@/utils/playerReliability';

type ListKind = 'continueWatching' | 'favorites' | 'watchLater';
const continueWatchingWriteQueue = new SerialWriteQueue();
const cleanedLegacyShows = new Set<string>();

function listRef(userId: string, profileId: string, kind: ListKind) {
  return collection(db, 'users', userId, 'profiles', profileId, kind);
}

function listDoc(userId: string, profileId: string, kind: ListKind, itemId: string) {
  return doc(db, 'users', userId, 'profiles', profileId, kind, itemId);
}

function mapSnapshot(snap: Awaited<ReturnType<typeof getDocs>>): ProfileMediaItem[] {
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return normalizeMediaItem({
      ...data,
      id: data.id ?? d.id.split('_').slice(1).join('_') ?? d.id,
      savedAt: (data.savedAt as { toMillis?: () => number })?.toMillis?.() ?? data.savedAt ?? 0,
    });
  });
}

export function subscribeToContinueWatching(
  userId: string,
  profileId: string,
  onUpdate: (items: ProfileMediaItem[]) => void
) {
  const q = query(listRef(userId, profileId, 'continueWatching'), orderBy('savedAt', 'desc'));
  return onSnapshot(q, (snap) => {
    onUpdate(selectLatestContinueWatching(
      mapSnapshot(snap as any).filter((item) => (item.progress ?? 0) < COMPLETION_THRESHOLD),
    ));
  }, (error) => { console.warn('onSnapshot error:', error); });
}

export function subscribeToFavorites(
  userId: string,
  profileId: string,
  onUpdate: (items: ProfileMediaItem[]) => void
) {
  const q = query(listRef(userId, profileId, 'favorites'), orderBy('savedAt', 'desc'), limit(50));
  return onSnapshot(q, (snap) => {
    onUpdate(mapSnapshot(snap as any));
  }, (error) => { console.warn('onSnapshot error:', error); });
}

export function subscribeToWatchLater(
  userId: string,
  profileId: string,
  onUpdate: (items: ProfileMediaItem[]) => void
) {
  const q = query(listRef(userId, profileId, 'watchLater'), orderBy('savedAt', 'desc'), limit(50));
  return onSnapshot(q, (snap) => {
    onUpdate(mapSnapshot(snap as any));
  }, (error) => { console.warn('onSnapshot error:', error); });
}

export async function getContinueWatching(
  userId: string,
  profileId: string,
): Promise<ProfileMediaItem[]> {
  const q = query(listRef(userId, profileId, 'continueWatching'), orderBy('savedAt', 'desc'));
  const snap = await getDocs(q);
  return selectLatestContinueWatching(
    mapSnapshot(snap).filter((item) => (item.progress ?? 0) < COMPLETION_THRESHOLD),
  );
}

export async function getFavorites(userId: string, profileId: string): Promise<ProfileMediaItem[]> {
  const q = query(listRef(userId, profileId, 'favorites'), orderBy('savedAt', 'desc'), limit(50));
  const snap = await getDocs(q);
  return mapSnapshot(snap);
}

export async function getWatchLater(userId: string, profileId: string): Promise<ProfileMediaItem[]> {
  const q = query(listRef(userId, profileId, 'watchLater'), orderBy('savedAt', 'desc'), limit(50));
  const snap = await getDocs(q);
  return mapSnapshot(snap);
}

export async function saveContinueWatching(
  userId: string,
  profileId: string,
  media: any,
  progressRatio: number,
  positionSeconds?: number,
  durationSeconds?: number,
): Promise<void> {
  const docId = getContinueWatchingDocId(media);
  const queueKey = `${userId}:${profileId}:${docId}`;
  return continueWatchingWriteQueue.enqueue(queueKey, async () => {
    const ref = listDoc(userId, profileId, 'continueWatching', docId);
    const legacyDocId = mediaDocId(media);

    if (progressRatio >= COMPLETION_THRESHOLD) {
      await Promise.all([
        deleteDoc(ref).catch(() => {}),
        legacyDocId !== docId
          ? deleteDoc(listDoc(userId, profileId, 'continueWatching', legacyDocId)).catch(() => {})
          : Promise.resolve(),
      ]);
      return;
    }

    const item = normalizeMediaItem({
      ...media,
      // Network stream URLs are episode-bound and must never be restored from
      // a show-level Continue Watching record.
      savedStreamUrl: docId.startsWith('tv_') ? null : media.savedStreamUrl,
      savedStreamHeaders: docId.startsWith('tv_') ? null : media.savedStreamHeaders,
      progress: progressRatio,
      positionSeconds: positionSeconds ?? media.positionSeconds,
      durationSeconds: durationSeconds ?? media.durationSeconds,
      savedAt: Date.now(),
    });

    const firestoreItem = Object.fromEntries(
      Object.entries({ ...item, savedAt: Date.now() }).filter(([, value]) => value !== undefined),
    );
    await setDoc(ref, firestoreItem);

    const cleanupKey = `${userId}:${profileId}:${docId}`;
    if (!cleanedLegacyShows.has(cleanupKey) && docId.startsWith('tv_')) {
      cleanedLegacyShows.add(cleanupKey);
      try {
        const snapshot = await getDocs(listRef(userId, profileId, 'continueWatching'));
        await Promise.all(snapshot.docs
          .filter((entry) => entry.id !== docId && entry.id.startsWith(`${docId}_S`))
          .map((entry) => deleteDoc(entry.ref).catch(() => {})));
      } catch (error) {
        cleanedLegacyShows.delete(cleanupKey);
        console.warn('Legacy Continue Watching cleanup error:', error);
      }
    }
  });
}

export async function getContinueWatchingItem(
  userId: string,
  profileId: string,
  media: any,
): Promise<ProfileMediaItem | null> {
  const currentDocId = getContinueWatchingDocId(media);
  let snap = await getDoc(listDoc(userId, profileId, 'continueWatching', currentDocId));
  if (!snap.exists()) {
    const legacyDocId = mediaDocId(media);
    if (legacyDocId !== currentDocId) {
      snap = await getDoc(listDoc(userId, profileId, 'continueWatching', legacyDocId));
    }
  }
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  return normalizeMediaItem({
    ...data,
    id: data.id ?? snap.id,
    savedAt: (data.savedAt as { toMillis?: () => number })?.toMillis?.() ?? data.savedAt ?? 0,
  });
}

export async function isFavorite(
  userId: string,
  profileId: string,
  media: any,
): Promise<boolean> {
  const snap = await getDoc(listDoc(userId, profileId, 'favorites', mediaDocId(media)));
  return snap.exists();
}

export async function isWatchLater(
  userId: string,
  profileId: string,
  media: any,
): Promise<boolean> {
  const snap = await getDoc(listDoc(userId, profileId, 'watchLater', mediaDocId(media)));
  return snap.exists();
}

export async function toggleFavorite(
  userId: string,
  profileId: string,
  media: any,
): Promise<boolean> {
  const docId = mediaDocId(media);
  const ref = listDoc(userId, profileId, 'favorites', docId);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    await deleteDoc(ref);
    return false;
  }
  const item = normalizeMediaItem({ ...media, savedAt: Date.now() });
  await setDoc(ref, { ...item, savedAt: serverTimestamp() });
  return true;
}

export async function toggleWatchLater(
  userId: string,
  profileId: string,
  media: any,
): Promise<boolean> {
  const docId = mediaDocId(media);
  const ref = listDoc(userId, profileId, 'watchLater', docId);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    await deleteDoc(ref);
    return false;
  }
  const item = normalizeMediaItem({ ...media, savedAt: Date.now() });
  await setDoc(ref, { ...item, savedAt: serverTimestamp() });
  return true;
}

export type RatingValue = number | null; // 1 to 10

export async function getMediaRating(
  userId: string,
  profileId: string,
  media: any,
): Promise<RatingValue> {
  const snap = await getDoc(doc(db, 'users', userId, 'profiles', profileId, 'ratings', mediaDocId(media)));
  if (!snap.exists()) return null;
  return (snap.data()?.rating as RatingValue) ?? null;
}

export async function setMediaRating(
  userId: string,
  profileId: string,
  media: any,
  rating: RatingValue,
): Promise<void> {
  const docId = mediaDocId(media);
  const ref = doc(db, 'users', userId, 'profiles', profileId, 'ratings', docId);
  if (rating === null) {
    await deleteDoc(ref).catch(() => {});
  } else {
    await setDoc(ref, {
      mediaId: docId,
      rating,
      updatedAt: serverTimestamp(),
    });
  }
}
