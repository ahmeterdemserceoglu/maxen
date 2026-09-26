import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  deleteField,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/config/firebase';
import { isFreshTvRemoteAction } from '@/utils/tvRemoteAction';

export const TV_DEVICE_STORAGE_KEY = 'maxen_tv_device_id';
export const TV_ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 dakika tolerans
export const TV_HEARTBEAT_MS = 20 * 1000;
const lastRemoteActionIdByDevice = new Map<string, string>();
const remoteWriteQueueByDevice = new Map<string, Promise<void>>();

export interface TvPlayMedia {
  id: string;
  tmdbId?: string | number;
  type: 'movie' | 'tv';
  title: string;
  show_title?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  posterUrl?: string | null;
  poster_path?: string | null;
  backdropUrl?: string | null;
  overview?: string;
  year?: string | number;
  rating?: string | number;
  profileId?: string;
  positionSeconds?: number; // TV'ye gönderildiğinde kaldığı saniye
}

export interface TvPlayCommand {
  commandId: string;
  requestedAt: number;
  profileId: string;
  media: TvPlayMedia;
}

export interface TvDevice {
  deviceId: string;
  ownerUid: string;
  deviceName: string;
  localIp?: string | null;
  lastSeen: number;
  playCommand?: TvPlayCommand | null;
}

export function ipv4Prefix(ip?: string | null): string | null {
  if (!ip || typeof ip !== 'string') return null;
  const match = ip.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return null;
  const parts = [match[1], match[2], match[3], match[4]].map(Number);
  if (parts.some((n) => n > 255)) return null;
  if (parts[0] === 127) return null;
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

export function isSameLocalNetwork(a?: string | null, b?: string | null): boolean {
  const prefixA = ipv4Prefix(a);
  const prefixB = ipv4Prefix(b);
  if (!prefixA || !prefixB) return true;
  return prefixA === prefixB;
}

export function isTvDeviceOnline(lastSeen: number, now = Date.now()): boolean {
  if (!lastSeen || lastSeen <= 0) return false;
  // Saat farkı (clock skew) toleransı: TV saati telefondan ilerideyse de aktif sayılır
  if (lastSeen > now) return true;
  return now - lastSeen <= TV_ONLINE_WINDOW_MS;
}

export function filterTvsOnSameNetwork(
  devices: TvDevice[],
  phoneIp?: string | null,
  now = Date.now()
): TvDevice[] {
  return devices.filter((device) => {
    if (!isTvDeviceOnline(device.lastSeen, now)) return false;
    return isSameLocalNetwork(phoneIp, device.localIp);
  });
}

export function serializePlayMedia(media: any, profileId: string): TvPlayMedia {
  const type: 'movie' | 'tv' =
    media?.type === 'tv' || media?.seasonNumber || media?.season_number || media?.episodeNumber
      ? 'tv'
      : 'movie';

  const payload: TvPlayMedia = {
    id: String(media?.id || media?.tmdbId || media?.Id || ''),
    type,
    title: String(media?.title || media?.name || media?.Name || 'İçerik'),
    profileId,
  };

  const tmdbId = media?.tmdbId || media?.id;
  if (tmdbId != null) payload.tmdbId = tmdbId;

  if (media?.show_title) payload.show_title = String(media.show_title);
  const seasonNumber = media?.seasonNumber ?? media?.season_number;
  const episodeNumber = media?.episodeNumber ?? media?.episode_number;
  if (seasonNumber != null) payload.seasonNumber = Number(seasonNumber);
  if (episodeNumber != null) payload.episodeNumber = Number(episodeNumber);
  if (media?.posterUrl) payload.posterUrl = media.posterUrl;
  if (media?.poster_path) payload.poster_path = media.poster_path;
  if (media?.backdropUrl) payload.backdropUrl = media.backdropUrl;
  if (media?.overview) payload.overview = String(media.overview).slice(0, 400);
  if (media?.year != null) payload.year = media.year;
  if (media?.rating != null) payload.rating = media.rating;
  // Mevcut oynatma pozisyonunu taşı — TV kaldığı yerden başlatabilsin
  if (media?.positionSeconds != null && media.positionSeconds > 0) {
    payload.positionSeconds = Math.floor(Number(media.positionSeconds));
  }

  return payload;
}


export async function getOrCreateTvDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(TV_DEVICE_STORAGE_KEY);
  if (existing) return existing;
  const deviceId = `tv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await AsyncStorage.setItem(TV_DEVICE_STORAGE_KEY, deviceId);
  return deviceId;
}

export async function registerTvDevice(params: {
  ownerUid: string;
  deviceName?: string;
  localIp?: string | null;
}): Promise<string> {
  const deviceId = await getOrCreateTvDeviceId();
  const ref = doc(db, 'tv_devices', deviceId);
  await setDoc(
    ref,
    {
      deviceId,
      ownerUid: params.ownerUid,
      deviceName: params.deviceName || `Maxen TV ${deviceId.slice(-4).toUpperCase()}`,
      localIp: params.localIp || null,
      lastSeen: Date.now(),
    },
    { merge: true }
  );
  return deviceId;
}

export async function heartbeatTvDevice(ownerUid: string, localIp?: string | null): Promise<void> {
  const deviceId = await getOrCreateTvDeviceId();
  await setDoc(
    doc(db, 'tv_devices', deviceId),
    {
      deviceId,
      ownerUid,
      localIp: localIp || null,
      lastSeen: Date.now(),
    },
    { merge: true }
  );
}

export async function unregisterTvDevice(): Promise<void> {
  try {
    const deviceId = await AsyncStorage.getItem(TV_DEVICE_STORAGE_KEY);
    if (!deviceId) return;
    await setDoc(
      doc(db, 'tv_devices', deviceId),
      { lastSeen: 0 },
      { merge: true }
    );
  } catch {
    // ignore
  }
}

export async function listOnlineTvs(ownerUid: string, phoneIp?: string | null): Promise<TvDevice[]> {
  try {
    const q = query(collection(db, 'tv_devices'), where('ownerUid', '==', ownerUid));
    const snap = await getDocs(q);
    const devices: TvDevice[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        deviceId: data.deviceId || d.id,
        ownerUid: data.ownerUid,
        deviceName: data.deviceName || 'Maxen TV',
        localIp: data.localIp || null,
        lastSeen: data.lastSeen || 0,
        playCommand: data.playCommand || null,
      };
    });
    return filterTvsOnSameNetwork(devices, phoneIp);
  } catch (e) {
    console.warn('listOnlineTvs error:', e);
    return [];
  }
}

export function subscribeToOnlineTvs(
  ownerUid: string,
  onUpdate: (devices: TvDevice[]) => void,
  phoneIp?: string | null
): () => void {
  const q = query(collection(db, 'tv_devices'), where('ownerUid', '==', ownerUid));
  return onSnapshot(
    q,
    (snap) => {
      const devices: TvDevice[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          deviceId: data.deviceId || d.id,
          ownerUid: data.ownerUid,
          deviceName: data.deviceName || 'Maxen TV',
          localIp: data.localIp || null,
          lastSeen: data.lastSeen || 0,
          playCommand: data.playCommand || null,
        };
      });
      onUpdate(filterTvsOnSameNetwork(devices, phoneIp));
    },
    (err) => {
      console.warn('subscribeToOnlineTvs error:', err);
    }
  );
}

export async function sendPlayToTv(
  deviceId: string,
  media: any,
  profileId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const command: TvPlayCommand = {
      commandId: `cmd_${Date.now().toString(36)}`,
      requestedAt: Date.now(),
      profileId,
      media: serializePlayMedia(media, profileId),
    };
    await setDoc(
      doc(db, 'tv_devices', deviceId),
      { playCommand: command },
      { merge: true }
    );
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'TV komutu gönderilemedi.' };
  }
}

export async function ackTvPlayCommand(deviceId: string): Promise<void> {
  try {
    await setDoc(
      doc(db, 'tv_devices', deviceId),
      { playCommand: deleteField() },
      { merge: true }
    );
  } catch {
    // ignore
  }
}

export function subscribeToTvPlayCommands(
  deviceId: string,
  onCommand: (command: TvPlayCommand) => void
): () => void {
  let lastCommandId: string | null = null;
  return onSnapshot(
    doc(db, 'tv_devices', deviceId),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as TvDevice;
      const command = data.playCommand;
      if (!command?.commandId || !command.media) return;
      if (command.commandId === lastCommandId) return;
      lastCommandId = command.commandId;
      onCommand(command);
    },
    (err) => {
      console.warn('TV play command listener error:', err);
    }
  );
}

export interface TvRemoteAction {
  actionId: string;
  requestedAt: number;
  type:
    | 'dpad_up'
    | 'dpad_down'
    | 'dpad_left'
    | 'dpad_right'
    | 'dpad_center' // OK / Select
    | 'back'
    | 'home'
    | 'play_pause'
    | 'seek_forward' // +10s
    | 'seek_backward' // -10s
    | 'volume_up'
    | 'volume_down'
    | 'volume_mute'
    | 'tab_switch' // e.g. 'home' | 'media' | 'search' | 'social' | 'settings'
    | 'search_query'; // search string
  payload?: any;
}

export async function sendTvRemoteAction(
  deviceId: string,
  type: TvRemoteAction['type'],
  payload?: any
): Promise<{ success: boolean; error?: string }> {
  const previousWrite = remoteWriteQueueByDevice.get(deviceId) || Promise.resolve();
  const write = previousWrite.catch(() => undefined).then(async () => {
    const action: TvRemoteAction = {
      actionId: `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      requestedAt: Date.now(),
      type,
      payload,
    };
    await setDoc(
      doc(db, 'tv_devices', deviceId),
      { remoteAction: action },
      { merge: true }
    );
  });
  remoteWriteQueueByDevice.set(deviceId, write);

  try {
    await write;
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Kumanda komutu gönderilemedi.' };
  } finally {
    if (remoteWriteQueueByDevice.get(deviceId) === write) {
      remoteWriteQueueByDevice.delete(deviceId);
    }
  }
}

export function subscribeToTvRemoteActions(
  deviceId: string,
  onAction: (action: TvRemoteAction) => void
): () => void {
  const subscribedAt = Date.now();
  return onSnapshot(
    doc(db, 'tv_devices', deviceId),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as any;
      const action = data?.remoteAction as TvRemoteAction | undefined;
      const lastActionId = lastRemoteActionIdByDevice.get(deviceId);
      if (!isFreshTvRemoteAction(action, lastActionId, subscribedAt)) return;
      lastRemoteActionIdByDevice.set(deviceId, action.actionId);
      onAction(action);
    },
    (err) => {
      console.warn('TV remote action listener error:', err);
    }
  );
}
