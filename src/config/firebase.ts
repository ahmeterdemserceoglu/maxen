import { Platform } from 'react-native';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, type Persistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyB6dSIyPGCFbACGRMAoiY9kKjaddREfScE',
  authDomain: 'fiskos-e1baa.firebaseapp.com',
  databaseURL: 'https://fiskos-e1baa-default-rtdb.firebaseio.com',
  projectId: 'fiskos-e1baa',
  storageBucket: 'fiskos-e1baa.firebasestorage.app',
  messagingSenderId: '1087681590566',
  appId: '1:1087681590566:web:2ffdc82662c22d8c55fde7',
  measurementId: 'G-B271PT6VFQ',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

function initAuth() {
  try {
    if (Platform.OS === 'web') {
      return getAuth(app);
    }

    // getReactNativePersistence RN bundle'da mevcut (Metro firebase/auth -> dist/rn)
    const { getReactNativePersistence } = require('firebase/auth') as {
      getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
    };

    try {
      return initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === 'auth/already-initialized') {
        return getAuth(app);
      }
      throw error;
    }
  } catch (err) {
    try {
      return getAuth(app);
    } catch {
      return {} as any;
    }
  }
}

export const auth = initAuth();
export const db = getFirestore(app);

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('MockKey') && firebaseConfig.projectId);
}
