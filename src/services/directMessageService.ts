import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

export interface DirectMessage {
  id: string;
  senderUid: string;
  senderName: string;
  senderUsername: string;
  type: 'text' | 'media_card' | 'party_invite';
  text?: string;
  media?: {
    tmdbId: string;
    title: string;
    type: 'movie' | 'tv';
    posterUrl?: string | null;
    rating?: string;
    year?: string;
    seasonNum?: number;
    episodeNum?: number;
  };
  partyCode?: string;
  createdAt: number;
}

export interface DirectConversation {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  lastMessage?: string;
  lastMessageAt?: number;
  updatedAt: number;
}

/**
 * Generates a deterministic unique conversation ID between two users.
 */
export function getConversationId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

/**
 * Sends a 1-on-1 direct message (Text, Media Recommendation Card, or Watch Party Invite).
 */
export async function sendDirectMessage(
  sender: { uid: string; displayName: string; username: string },
  recipient: { uid: string; displayName: string; username: string },
  payload: {
    type?: 'text' | 'media_card' | 'party_invite';
    text?: string;
    media?: DirectMessage['media'];
    partyCode?: string;
  }
): Promise<string> {
  const convId = getConversationId(sender.uid, recipient.uid);
  const convRef = doc(db, 'direct_conversations', convId);
  const messagesRef = collection(db, 'direct_conversations', convId, 'messages');
  const newMsgDoc = doc(messagesRef);

  const messageType = payload.type || 'text';
  const now = Date.now();

  const messageData: DirectMessage = {
    id: newMsgDoc.id,
    senderUid: sender.uid,
    senderName: sender.displayName || sender.username || 'Kullanıcı',
    senderUsername: sender.username || 'user',
    type: messageType,
    text: payload.text || '',
    media: payload.media,
    partyCode: payload.partyCode,
    createdAt: now,
  };

  let previewText = payload.text || '';
  if (messageType === 'media_card' && payload.media?.title) {
    previewText = `🎬 ${payload.media.title} önerisi`;
  } else if (messageType === 'party_invite') {
    previewText = `🍿 Birlikte İzleme Daveti`;
  }

  // 1. Write the message document
  await setDoc(newMsgDoc, {
    ...messageData,
    serverCreatedAt: serverTimestamp(),
  });

  // 2. Update parent conversation metadata
  await setDoc(
    convRef,
    {
      id: convId,
      participants: [sender.uid, recipient.uid],
      participantNames: {
        [sender.uid]: sender.displayName || sender.username,
        [recipient.uid]: recipient.displayName || recipient.username,
      },
      lastMessage: previewText,
      lastMessageAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  return newMsgDoc.id;
}

/**
 * Subscribes in real-time to direct messages in a conversation.
 */
export function subscribeToDirectMessages(
  convId: string,
  onUpdate: (messages: DirectMessage[]) => void
) {
  const messagesRef = collection(db, 'direct_conversations', convId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(100));

  return onSnapshot(
    q,
    (snap) => {
      const msgs: DirectMessage[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          senderUid: data.senderUid,
          senderName: data.senderName,
          senderUsername: data.senderUsername,
          type: data.type || 'text',
          text: data.text || '',
          media: data.media,
          partyCode: data.partyCode,
          createdAt: data.createdAt || 0,
        };
      });
      onUpdate(msgs);
    },
    (err) => {
      console.warn('Direct messages subscription error:', err);
    }
  );
}
