import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import {
  type Profile,
  PROFILE_COLORS,
  profileLetter,
  MAX_PROFILES,
} from '@/types/profile';

function profilesRef(userId: string) {
  return collection(db, 'users', userId, 'profiles');
}

export async function getProfiles(userId: string): Promise<Profile[]> {
  const q = query(profilesRef(userId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      letter: data.letter,
      color: data.color,
      avatarUrl: data.avatarUrl ?? undefined,
      isKids: data.isKids ?? false,
      pin: data.pin ?? undefined,
      createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? 0,
    };
  });
}

export async function createProfile(
  userId: string,
  name: string,
  color?: string,
  isKids?: boolean,
  pin?: string,
  avatarUrl?: string,
): Promise<Profile> {
  const existing = await getProfiles(userId);
  if (existing.length >= MAX_PROFILES) {
    throw new Error(`En fazla ${MAX_PROFILES} profil oluşturabilirsiniz.`);
  }

  const usedColors = new Set(existing.map((p) => p.color));
  const pickedColor =
    color ??
    PROFILE_COLORS.find((c) => !usedColors.has(c)) ??
    PROFILE_COLORS[existing.length % PROFILE_COLORS.length];

  const profileData: Record<string, any> = {
    name: name.trim(),
    letter: profileLetter(name),
    color: pickedColor,
    isKids: isKids ?? false,
    createdAt: serverTimestamp(),
  };
  if (avatarUrl) {
    profileData.avatarUrl = avatarUrl;
  }
  if (pin && pin.trim().length === 4) {
    profileData.pin = pin.trim();
  }

  const ref = await addDoc(profilesRef(userId), profileData);

  return {
    id: ref.id,
    name: name.trim(),
    letter: profileLetter(name),
    color: pickedColor,
    avatarUrl: avatarUrl ?? undefined,
    isKids: isKids ?? false,
    pin: pin && pin.trim().length === 4 ? pin.trim() : undefined,
    createdAt: Date.now(),
  };
}

export async function updateProfile(
  userId: string,
  profileId: string,
  updates: { name?: string; color?: string; isKids?: boolean; pin?: string | null; avatarUrl?: string | null },
): Promise<void> {
  const data: Record<string, any> = {};
  if (updates.name !== undefined) {
    data.name = updates.name.trim();
    data.letter = profileLetter(updates.name);
  }
  if (updates.color !== undefined) {
    data.color = updates.color;
  }
  if (updates.avatarUrl !== undefined) {
    data.avatarUrl = updates.avatarUrl;
  }
  if (updates.isKids !== undefined) {
    data.isKids = updates.isKids;
  }
  if (updates.pin !== undefined) {
    if (updates.pin === null || updates.pin.trim() === '') {
      data.pin = null;
    } else if (updates.pin.trim().length === 4) {
      data.pin = updates.pin.trim();
    }
  }
  await updateDoc(doc(db, 'users', userId, 'profiles', profileId), data);
}

export async function deleteProfile(userId: string, profileId: string): Promise<void> {
  const existing = await getProfiles(userId);
  if (existing.length <= 1) {
    throw new Error('Son profili silemezsiniz.');
  }
  await deleteDoc(doc(db, 'users', userId, 'profiles', profileId));
}

export async function ensureUserDocument(
  userId: string,
  email: string,
  displayName?: string,
): Promise<void> {
  await setDoc(
    doc(db, 'users', userId),
    {
      email,
      displayName: displayName ?? '',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function createDefaultProfile(
  userId: string,
  displayName?: string,
): Promise<Profile> {
  const name = displayName?.trim() || 'Profil 1';
  return createProfile(userId, name);
}
