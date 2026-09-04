import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

export interface TvSessionData {
  code: string;
  status: 'pending' | 'authenticated' | 'expired';
  createdAt: number;
  expiresAt: number;
  userId?: string;
  userEmail?: string;
  userDisplayName?: string;
  profileId?: string;
  profiles?: any[];
  authenticatedAt?: number;
}

// Kolay okunur ve karışıklık yaratmayan karakter havuzu (0, O, 1, I hariç)
const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generatePairingCode(length = 6): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * CODE_CHARS.length);
    result += CODE_CHARS[randomIndex];
  }
  return result;
}

/**
 * TV için yeni bir oturum eşleşme kodu ve QR verisi üretir
 */
export async function createTvSession(): Promise<TvSessionData> {
  const code = generatePairingCode(6);
  const now = Date.now();
  const expiresAt = now + 5 * 60 * 1000; // 5 dakika geçerli

  const sessionData: TvSessionData = {
    code,
    status: 'pending',
    createdAt: now,
    expiresAt,
  };

  const ref = doc(db, 'tv_sessions', code);
  await setDoc(ref, sessionData);

  return sessionData;
}

/**
 * TV ekranında eşleşme durumunu canlı olarak dinler
 */
export function subscribeToTvSession(
  code: string,
  onAuthenticated: (data: TvSessionData) => void,
  onExpired?: () => void
) {
  const ref = doc(db, 'tv_sessions', code);

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as TvSessionData;

      if (data.status === 'authenticated' && data.userId) {
        onAuthenticated(data);
      } else if (Date.now() > data.expiresAt) {
        onExpired?.();
      }
    },
    (err) => {
      console.warn('TV session listener error:', err);
    }
  );
}

/**
 * Telefondan QR okutulduğunda veya 6 haneli kod girildiğinde TV oturumunu onaylar
 */
export async function confirmTvSessionFromMobile(
  code: string,
  userId: string,
  userEmail?: string,
  profileId?: string,
  userDisplayName?: string,
  profiles?: any[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanCode = code.trim().toUpperCase();
    const ref = doc(db, 'tv_sessions', cleanCode);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return { success: false, error: 'Geçersiz veya bulunamayan TV eşleşme kodu.' };
    }

    const data = snap.data() as TvSessionData;
    if (Date.now() > data.expiresAt) {
      return { success: false, error: 'Bu kodun süresi dolmuş. Lütfen TV ekranını yenileyin.' };
    }

    await setDoc(
      ref,
      {
        status: 'authenticated',
        userId,
        userEmail: userEmail || '',
        userDisplayName: userDisplayName || '',
        profileId: profileId || '',
        profiles: Array.isArray(profiles) ? profiles : [],
        authenticatedAt: Date.now(),
      },
      { merge: true }
    );

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'TV oturumu onaylanırken bir hata oluştu.' };
  }
}

/**
 * Oturum tamamlandığında veya iptal edildiğinde temizleme yapar
 */
export async function cleanupTvSession(code: string): Promise<void> {
  try {
    const ref = doc(db, 'tv_sessions', code.trim().toUpperCase());
    await deleteDoc(ref);
  } catch (e) {}
}
