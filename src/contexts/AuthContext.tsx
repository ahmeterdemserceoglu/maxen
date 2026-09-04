import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  updateProfile,
  signInAnonymously,
  type User,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/config/firebase';
import { type Profile } from '@/types/profile';
import {
  getProfiles,
  createDefaultProfile,
  ensureUserDocument,
} from '@/services/profileService';
import { cleanupTvSession } from '@/services/tvAuthService';
import { activeProfileKey } from '@/utils/storageKeys';

const TV_SESSION_STORAGE_KEY = 'maxen_tv_paired_session';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  profiles: Profile[];
  profilesLoading: boolean;
  activeProfile: Profile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  selectProfile: (profile: Profile) => Promise<void>;
  clearProfile: () => Promise<void>;
  refreshProfiles: () => Promise<void>;
  signInWithTvSession: (sessionData: {
    userId: string;
    userEmail?: string;
    userDisplayName?: string;
    profileId?: string;
    code?: string;
    profiles?: any[];
  }) => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

function mapFirebaseError(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'Geçersiz e-posta adresi.';
    case 'auth/user-disabled':
      return 'Bu hesap devre dışı bırakılmış.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-posta veya şifre hatalı.';
    case 'auth/email-already-in-use':
      return 'Bu e-posta adresi zaten kullanılıyor.';
    case 'auth/weak-password':
      return 'Şifre en az 6 karakter olmalı.';
    case 'auth/too-many-requests':
      return 'Çok fazla deneme. Lütfen daha sonra tekrar deneyin.';
    case 'auth/network-request-failed':
      return 'İnternet bağlantısı yok.';
    default:
      return 'Bir hata oluştu. Lütfen tekrar deneyin.';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const loadProfiles = useCallback(
    async (uid: string, fallbackProfiles?: Profile[], preferredProfileId?: string) => {
      setProfilesLoading(true);
      try {
        let list: Profile[] = [];
        try {
          list = await getProfiles(uid);
        } catch (err) {
          console.warn('Could not fetch profiles from firestore:', err);
        }

        if (list.length === 0 && Array.isArray(fallbackProfiles) && fallbackProfiles.length > 0) {
          list = fallbackProfiles;
        }

        if (list.length === 0) {
          try {
            const defaultProfile = await createDefaultProfile(uid);
            list = [defaultProfile];
          } catch {}
        }
        setProfiles(list);

        const storedId = (await AsyncStorage.getItem(activeProfileKey(uid))) || preferredProfileId;
        const found = (storedId ? list.find((p) => p.id === storedId) : null) || list[0];
        if (found) {
          setActiveProfile(found);
          await AsyncStorage.setItem(activeProfileKey(uid), found.id);
        }
      } catch (e) {
        console.warn('Profile load error:', e);
      } finally {
        setProfilesLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // 1. Önce TV eşleşme oturumu var mı kontrol et (TV için kalıcı oturum)
      try {
        const storedTvSession = await AsyncStorage.getItem(TV_SESSION_STORAGE_KEY);
        if (storedTvSession) {
          const parsed = JSON.parse(storedTvSession);
          if (parsed?.userId) {
            const tvUser = {
              uid: parsed.userId,
              email: parsed.userEmail || `${parsed.userId}@maxen.tv`,
              displayName:
                parsed.userDisplayName || parsed.userEmail?.split('@')[0] || 'TV Kullanıcısı',
              emailVerified: true,
              isAnonymous: false,
            } as unknown as User;

            setUser(tvUser);
            await loadProfiles(parsed.userId, parsed.profiles, parsed.profileId);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn('TV session load error:', e);
      }

      // 2. TV oturumu yoksa ve gerçek (anonim olmayan) bir Firebase kullanıcısı varsa:
      if (firebaseUser && !firebaseUser.isAnonymous) {
        setUser(firebaseUser);
        await loadProfiles(firebaseUser.uid);
      } else {
        setUser(null);
        setProfiles([]);
        setActiveProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [loadProfiles]);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e: any) {
      setAuthError(mapFirebaseError(e.code ?? ''));
      throw e;
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      setAuthError(null);
      try {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );
        await updateProfile(cred.user, { displayName: displayName.trim() });
        await ensureUserDocument(cred.user.uid, email.trim(), displayName.trim());
        await createDefaultProfile(cred.user.uid, displayName.trim());
      } catch (e: any) {
        setAuthError(mapFirebaseError(e.code ?? ''));
        throw e;
      }
    },
    [],
  );

  const resetPassword = useCallback(async (email: string) => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (e: any) {
      setAuthError(mapFirebaseError(e.code ?? ''));
      throw e;
    }
  }, []);

  const signInWithTvSession = useCallback(
    async (sessionData: {
      userId: string;
      userEmail?: string;
      userDisplayName?: string;
      profileId?: string;
      code?: string;
      profiles?: Profile[];
    }) => {
      setAuthError(null);
      setLoading(true);
      try {
        // 1. Ensure anonymous token for Firebase rules if not authenticated
        if (!auth.currentUser) {
          try {
            await signInAnonymously(auth);
          } catch (anonErr) {
            console.warn('Anonymous sign-in for TV session:', anonErr);
          }
        }

        // 2. Set TV User State
        const tvUser = {
          uid: sessionData.userId,
          email: sessionData.userEmail || `${sessionData.userId}@maxen.tv`,
          displayName:
            sessionData.userDisplayName || sessionData.userEmail?.split('@')[0] || 'TV Kullanıcısı',
          emailVerified: true,
          isAnonymous: false,
        } as unknown as User;

        setUser(tvUser);

        // 3. Load Profiles from session or Firestore
        let list: Profile[] =
          Array.isArray(sessionData.profiles) && sessionData.profiles.length > 0
            ? sessionData.profiles
            : [];

        try {
          const freshList = await getProfiles(sessionData.userId);
          if (freshList.length > 0) {
            list = freshList;
          }
        } catch (pErr) {
          console.warn('Could not fetch profiles from firestore:', pErr);
        }

        if (list.length === 0) {
          try {
            const def = await createDefaultProfile(sessionData.userId, tvUser.displayName || 'Kullanıcı');
            list = [def];
          } catch {}
        }

        setProfiles(list);

        // 4. Select Profile
        const target = list.find((p) => p.id === sessionData.profileId) || list[0];
        if (target) {
          setActiveProfile(target);
          await AsyncStorage.setItem(activeProfileKey(sessionData.userId), target.id);
        }

        // 5. Save TV session to AsyncStorage (with complete profiles array and selected profile)
        await AsyncStorage.setItem(
          TV_SESSION_STORAGE_KEY,
          JSON.stringify({
            userId: sessionData.userId,
            userEmail: sessionData.userEmail || '',
            userDisplayName: sessionData.userDisplayName || '',
            profileId: target ? target.id : sessionData.profileId || '',
            profiles: list,
          })
        );

        // 6. Cleanup TV pairing session document from Firestore
        if (sessionData.code) {
          cleanupTvSession(sessionData.code).catch(() => {});
        }
      } catch (err: any) {
        console.error('signInWithTvSession error:', err);
        setAuthError('TV oturumu başlatılırken bir hata oluştu.');
        throw err;
      } finally {
        setLoading(false);
        setProfilesLoading(false);
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    if (user) {
      await AsyncStorage.removeItem(activeProfileKey(user.uid));
    }
    await AsyncStorage.removeItem(TV_SESSION_STORAGE_KEY);
    setActiveProfile(null);
    setProfiles([]);
    setUser(null);
    await firebaseSignOut(auth).catch(() => {});
  }, [user]);

  const selectProfile = useCallback(
    async (profile: Profile) => {
      setActiveProfile(profile);
      if (user) {
        await AsyncStorage.setItem(activeProfileKey(user.uid), profile.id);
        try {
          const stored = await AsyncStorage.getItem(TV_SESSION_STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            parsed.profileId = profile.id;
            await AsyncStorage.setItem(TV_SESSION_STORAGE_KEY, JSON.stringify(parsed));
          }
        } catch {}
      }
    },
    [user],
  );

  const clearProfile = useCallback(async () => {
    setActiveProfile(null);
    if (user) {
      await AsyncStorage.removeItem(activeProfileKey(user.uid));
    }
  }, [user]);

  const refreshProfiles = useCallback(async () => {
    if (user) await loadProfiles(user.uid);
  }, [user, loadProfiles]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        profiles,
        profilesLoading,
        activeProfile,
        signIn,
        signUp,
        resetPassword,
        signOut,
        selectProfile,
        clearProfile,
        refreshProfiles,
        signInWithTvSession,
        authError,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
