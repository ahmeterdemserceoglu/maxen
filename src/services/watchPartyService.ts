import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  increment,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

export interface WatchPartyParticipant {
  uid: string;
  name: string;
  avatarUrl?: string | null;
  isHost: boolean;
  joinedAt: number;
}

export interface WatchPartyMessage {
  id: string;
  senderId: string;
  senderName: string;
  text?: string;
  reaction?: string;
  timestamp: number;
}

export interface WatchPartyRoom {
  code: string;
  hostId: string;
  hostName: string;
  media: any;
  mediaRevision: number;
  isPlaying: boolean;
  currentTime: number;
  updatedAt: number;
  participants: WatchPartyParticipant[];
  chatMessages: WatchPartyMessage[];
  status: 'active' | 'closed';
  expiresAt: number;
}

const PARTY_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function normalizePartyMedia(media: any) {
  return {
    id: media.id || media.tmdbId,
    tmdbId: media.tmdbId || media.id,
    title: media.title || media.name || media.show_title || 'Video',
    show_title: media.show_title || media.SeriesName || media.title || media.name || 'Video',
    type: media.type || (media.season_number || media.seasonNumber ? 'tv' : 'movie'),
    poster_path: media.poster_path || media.posterUrl || '',
    backdrop_path: media.backdrop_path || media.backdropUrl || '',
    seasonNumber: media.seasonNumber || media.season_number || 1,
    episodeNumber: media.episodeNumber || media.episode_number || 1,
    episode_title: media.episode_title || media.episodeTitle || media.name || '',
  };
}

export function generatePartyCode(length = 6): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * PARTY_CHARS.length);
    result += PARTY_CHARS[randomIndex];
  }
  return result;
}

/**
 * Yeni bir Watch Party / Birlikte İzle odası oluşturur
 */
export async function createWatchPartyRoom(
  user: { uid: string; displayName?: string | null; email?: string | null },
  profile: { name?: string; avatarUrl?: string | null } | null,
  media: any,
  initialSeconds = 0,
  isPlaying = true
): Promise<WatchPartyRoom> {
  const code = generatePartyCode(6);
  const now = Date.now();
  const hostName = profile?.name || user.displayName || user.email?.split('@')[0] || 'Kullanıcı';

  const hostParticipant: WatchPartyParticipant = {
    uid: user.uid,
    name: hostName,
    avatarUrl: profile?.avatarUrl || null,
    isHost: true,
    joinedAt: now,
  };

  const roomData: WatchPartyRoom = {
    code,
    hostId: user.uid,
    hostName,
    media: normalizePartyMedia(media),
    mediaRevision: 1,
    isPlaying,
    currentTime: initialSeconds,
    updatedAt: now,
    participants: [hostParticipant],
    chatMessages: [
      {
        id: `sys_${now}`,
        senderId: 'system',
        senderName: 'Sistem',
        text: `🎉 ${hostName} odayı başlattı!`,
        timestamp: now,
      },
    ],
    status: 'active',
    expiresAt: now + 12 * 60 * 60 * 1000, // 12 saat geçerli
  };

  const ref = doc(db, 'watch_parties', code);
  await setDoc(ref, roomData);

  return roomData;
}

/**
 * Mevcut bir Watch Party odasına katılır
 */
export async function joinWatchPartyRoom(
  code: string,
  user: { uid: string; displayName?: string | null; email?: string | null },
  profile: { name?: string; avatarUrl?: string | null } | null
): Promise<{ success: boolean; room?: WatchPartyRoom; error?: string }> {
  try {
    const cleanCode = code.trim().toUpperCase();
    const ref = doc(db, 'watch_parties', cleanCode);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return { success: false, error: 'Oda bulunamadı. Lütfen kodu kontrol edin.' };
    }

    const room = snap.data() as WatchPartyRoom;

    if (room.status === 'closed') {
      return { success: false, error: 'Bu oda sonlandırılmış.' };
    }

    if (Date.now() > room.expiresAt) {
      return { success: false, error: 'Odanın süresi dolmuş.' };
    }

    const userName = profile?.name || user.displayName || user.email?.split('@')[0] || 'İzleyici';
    const isAlreadyJoined = room.participants.some((p) => p.uid === user.uid);

    if (!isAlreadyJoined) {
      const newParticipant: WatchPartyParticipant = {
        uid: user.uid,
        name: userName,
        avatarUrl: profile?.avatarUrl || null,
        isHost: room.hostId === user.uid,
        joinedAt: Date.now(),
      };

      const joinMessage: WatchPartyMessage = {
        id: `join_${Date.now()}`,
        senderId: 'system',
        senderName: 'Sistem',
        text: `👋 ${userName} odaya katıldı!`,
        timestamp: Date.now(),
      };

      await updateDoc(ref, {
        participants: arrayUnion(newParticipant),
        chatMessages: arrayUnion(joinMessage),
      });

      room.participants.push(newParticipant);
      room.chatMessages.push(joinMessage);
    }

    return { success: true, room };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Odaya katılırken bir hata oluştu.' };
  }
}

/**
 * Video oynatma, duraklatma ve sarma durumunu tüm izleyicilere senkronize eder
 */
export async function syncWatchPartyPlayback(
  code: string,
  isPlaying: boolean,
  currentTime: number,
  media?: any,
): Promise<void> {
  try {
    const ref = doc(db, 'watch_parties', code.trim().toUpperCase());
    const update: Record<string, any> = {
      isPlaying,
      currentTime,
      updatedAt: Date.now(),
    };
    if (media) {
      update.media = normalizePartyMedia(media);
      update.mediaRevision = increment(1);
    }
    await updateDoc(ref, update);
  } catch (e) {
    console.warn('Watch party playback sync error:', e);
  }
}

/**
 * Odaya canlı emoji reaksiyonu gönderir (ekranda uçuşan emojiler)
 */
export async function sendWatchPartyReaction(
  code: string,
  user: { uid: string; displayName?: string | null },
  profileName: string,
  reactionEmoji: string
): Promise<void> {
  try {
    const ref = doc(db, 'watch_parties', code.trim().toUpperCase());
    const msg: WatchPartyMessage = {
      id: `react_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderId: user.uid,
      senderName: profileName || user.displayName || 'İzleyici',
      reaction: reactionEmoji,
      timestamp: Date.now(),
    };

    await updateDoc(ref, {
      chatMessages: arrayUnion(msg),
    });
  } catch (e) {
    console.warn('Watch party reaction send error:', e);
  }
}

/**
 * Odaya canlı sohbet mesajı gönderir
 */
export async function sendWatchPartyChat(
  code: string,
  user: { uid: string; displayName?: string | null },
  profileName: string,
  text: string
): Promise<void> {
  try {
    const cleanText = text.trim();
    if (!cleanText) return;

    const ref = doc(db, 'watch_parties', code.trim().toUpperCase());
    const msg: WatchPartyMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderId: user.uid,
      senderName: profileName || user.displayName || 'İzleyici',
      text: cleanText,
      timestamp: Date.now(),
    };

    await updateDoc(ref, {
      chatMessages: arrayUnion(msg),
    });
  } catch (e) {
    console.warn('Watch party chat send error:', e);
  }
}

/**
 * Odadan ayrılma veya odayı kapatma
 */
export async function leaveWatchPartyRoom(
  code: string,
  user: { uid: string; displayName?: string | null },
  profileName?: string
): Promise<void> {
  try {
    const cleanCode = code.trim().toUpperCase();
    const ref = doc(db, 'watch_parties', cleanCode);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const room = snap.data() as WatchPartyRoom;
    const remainingParticipants = (room.participants || []).filter((p) => p.uid !== user.uid);

    // Hiç katılımcı kalmadıysa odayı anında veritabanından sil (Zero orphaned rooms)
    if (remainingParticipants.length === 0) {
      await deleteDoc(ref);
      return;
    }

    const isHost = room.hostId === user.uid;
    const leaverName = profileName || user.displayName || 'Bir kullanıcı';
    const leaveMessage: WatchPartyMessage = {
      id: `leave_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderId: 'system',
      senderName: 'Sistem',
      text: `🚪 ${leaverName} odadan ayrıldı.`,
      timestamp: Date.now(),
    };

    // Eğer ayrılan kişi host ise, liderliği sıradaki ilk kullanıcıya devret
    if (isHost) {
      remainingParticipants[0].isHost = true;
      const newHost = remainingParticipants[0];

      await updateDoc(ref, {
        participants: remainingParticipants,
        hostId: newHost.uid,
        hostName: newHost.name,
        chatMessages: arrayUnion(leaveMessage),
      });
    } else {
      // Host değilse sadece katılımcı listesini ve ayrılma mesajını güncelle
      await updateDoc(ref, {
        participants: remainingParticipants,
        chatMessages: arrayUnion(leaveMessage),
      });
    }
  } catch (e) {
    console.warn('Watch party leave error:', e);
  }
}

/**
 * Canlı Watch Party dinleyicisi (Senkronizasyon, Katılımcılar, Sohbet & Reaksiyonlar)
 */
export function subscribeToWatchParty(
  code: string,
  onUpdate: (room: WatchPartyRoom | null) => void,
  onClosed?: () => void
) {
  const cleanCode = code.trim().toUpperCase();
  const ref = doc(db, 'watch_parties', cleanCode);

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        onClosed?.();
        return;
      }
      const data = snap.data() as WatchPartyRoom;

      if (data.status === 'closed') {
        onUpdate(null);
        onClosed?.();
      } else {
        onUpdate(data);
      }
    },
    (err) => {
      console.warn('Watch party subscription error:', err);
      onUpdate(null);
      onClosed?.();
    }
  );
}
