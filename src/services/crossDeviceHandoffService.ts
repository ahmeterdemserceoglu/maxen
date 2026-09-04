import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/config/firebase';
import { Platform } from 'react-native';

export const HANDOFF_DEVICE_STORAGE_KEY = 'maxen_device_unique_id';

export interface PlaybackSessionData {
  deviceId: string;
  deviceName: string;
  deviceType: 'mobile' | 'web' | 'tv';
  media: {
    id: string;
    tmdbId?: string | number;
    title: string;
    type: 'movie' | 'tv';
    show_title?: string;
    season_number?: number;
    episode_number?: number;
    posterUrl?: string | null;
    backdropUrl?: string | null;
    year?: string | number;
    rating?: string | number;
    [key: string]: any;
  };
  positionSeconds: number;
  durationSeconds: number;
  progress: number;
  updatedAt: number;
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(HANDOFF_DEVICE_STORAGE_KEY);
  if (existing) return existing;
  const isTV = Platform.isTV;
  const prefix = Platform.OS === 'web' ? 'web' : isTV ? 'tv' : 'mob';
  const deviceId = `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  await AsyncStorage.setItem(HANDOFF_DEVICE_STORAGE_KEY, deviceId);
  return deviceId;
}

export function getDeviceType(): 'mobile' | 'web' | 'tv' {
  if (Platform.isTV) return 'tv';
  if (Platform.OS === 'web') return 'web';
  return 'mobile';
}

export function getDeviceFriendlyName(): string {
  if (Platform.isTV) return 'Android TV';
  if (Platform.OS === 'web') return 'Web Tarayıcı';
  if (Platform.OS === 'ios') return 'iPhone';
  return 'Android Telefon';
}

/**
 * Updates the user's active playback session in Firestore
 */
export async function saveActivePlaybackSession(
  userId: string,
  profileId: string,
  media: any,
  positionSeconds: number,
  durationSeconds: number
): Promise<void> {
  if (!userId || !profileId || !media || positionSeconds < 10) return;

  try {
    const deviceId = await getOrCreateDeviceId();
    const progress = durationSeconds > 0 ? positionSeconds / durationSeconds : 0;

    // Do not save as active handoff if video is completed (>92%)
    if (progress >= 0.92) {
      await clearActivePlaybackSession(userId, profileId);
      return;
    }

    const sessionRef = doc(db, 'users', userId, 'profiles', profileId, 'handoff', 'lastSession');
    const sessionData: PlaybackSessionData = {
      deviceId,
      deviceName: getDeviceFriendlyName(),
      deviceType: getDeviceType(),
      media: {
        id: String(media.id || media.tmdbId || ''),
        tmdbId: media.tmdbId || media.id,
        title: String(media.title || media.name || media.show_title || 'İçerik'),
        type: media.type === 'tv' || media.season_number ? 'tv' : 'movie',
        show_title: media.show_title || media.name || media.title,
        season_number: media.season_number || media.seasonNumber,
        episode_number: media.episode_number || media.episodeNumber,
        posterUrl: media.posterUrl || media.poster_path,
        backdropUrl: media.backdropUrl || media.backdrop_path,
        year: media.year,
        rating: media.rating,
      },
      positionSeconds: Math.floor(positionSeconds),
      durationSeconds: Math.floor(durationSeconds),
      progress,
      updatedAt: Date.now(),
    };

    await setDoc(sessionRef, sessionData, { merge: true });
  } catch (err) {
    console.warn('[Handoff] Error saving playback session:', err);
  }
}

/**
 * Clears the active playback session when finished or dismissed
 */
export async function clearActivePlaybackSession(
  userId: string,
  profileId: string
): Promise<void> {
  if (!userId || !profileId) return;
  try {
    const sessionRef = doc(db, 'users', userId, 'profiles', profileId, 'handoff', 'lastSession');
    await deleteDoc(sessionRef).catch(() => {});
  } catch {
    // ignore
  }
}

/**
 * Listens for active playback sessions left on other devices within the last 24 hours
 */
export function subscribeToCrossDeviceHandoff(
  userId: string,
  profileId: string,
  currentDeviceId: string,
  onHandoffDetected: (session: PlaybackSessionData) => void
): () => void {
  if (!userId || !profileId) return () => {};

  const sessionRef = doc(db, 'users', userId, 'profiles', profileId, 'handoff', 'lastSession');
  let lastSeenTimestamp = 0;

  return onSnapshot(
    sessionRef,
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as PlaybackSessionData;

      if (!data || !data.media || !data.positionSeconds || !data.updatedAt) return;

      // Ensure session is from a DIFFERENT device
      if (data.deviceId === currentDeviceId) return;

      // Ensure session is fresh (within last 24 hours)
      const isWithin24Hours = Date.now() - data.updatedAt < 24 * 60 * 60 * 1000;
      if (!isWithin24Hours) return;

      // Ensure session was watched for at least 30 seconds and not ended (>92%)
      if (data.positionSeconds < 30 || data.progress >= 0.92) return;

      // Avoid duplicate triggers for the same timestamp
      if (data.updatedAt === lastSeenTimestamp) return;
      lastSeenTimestamp = data.updatedAt;

      onHandoffDetected(data);
    },
    (err) => {
      console.warn('[Handoff] Listener error:', err);
    }
  );
}

/**
 * Formats seconds into MM:SS or H:MM:SS
 */
export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}
