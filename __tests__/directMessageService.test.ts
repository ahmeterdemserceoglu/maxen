import {
  getConversationId,
  sendDirectMessage,
  DirectMessage,
} from '../src/services/directMessageService';
import * as firestore from 'firebase/firestore';

jest.mock('../src/config/firebase', () => ({
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(() => ({})),
  doc: jest.fn((...args: any[]) => ({ id: 'mock_msg_123', path: args.join('/') })),
  setDoc: jest.fn().mockResolvedValue(undefined),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => 'MOCK_SERVER_TIMESTAMP'),
}));

describe('Direct Message Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConversationId', () => {
    it('should generate identical conversation IDs regardless of user order', () => {
      const id1 = getConversationId('uid_alice_123', 'uid_bob_456');
      const id2 = getConversationId('uid_bob_456', 'uid_alice_123');

      expect(id1).toBe(id2);
      expect(id1).toBe('uid_alice_123_uid_bob_456');
    });

    it('should handle alphanumeric and special character UIDs correctly', () => {
      const id = getConversationId('user_z', 'user_a');
      expect(id).toBe('user_a_user_z');
    });
  });

  describe('sendDirectMessage', () => {
    it('should send a text message and update conversation metadata', async () => {
      const sender = { uid: 'user_1', displayName: 'Ahmet', username: 'ahmet' };
      const recipient = { uid: 'user_2', displayName: 'Mehmet', username: 'mehmet' };

      const msgId = await sendDirectMessage(sender, recipient, {
        type: 'text',
        text: 'Selam, nasılsın?',
      });

      expect(msgId).toBe('mock_msg_123');
      expect(firestore.setDoc).toHaveBeenCalledTimes(2);

      // Verify message payload
      expect(firestore.setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          id: 'mock_msg_123',
          senderUid: 'user_1',
          senderName: 'Ahmet',
          senderUsername: 'ahmet',
          type: 'text',
          text: 'Selam, nasılsın?',
        })
      );
    });

    it('should send a media recommendation card payload', async () => {
      const sender = { uid: 'user_1', displayName: 'Ahmet', username: 'ahmet' };
      const recipient = { uid: 'user_2', displayName: 'Mehmet', username: 'mehmet' };

      const mediaPayload = {
        tmdbId: '157336',
        title: 'Interstellar',
        type: 'movie' as const,
        posterUrl: 'https://image.tmdb.org/t/p/w300/interstellar.jpg',
        rating: '8.7',
        year: '2014',
      };

      const msgId = await sendDirectMessage(sender, recipient, {
        type: 'media_card',
        media: mediaPayload,
      });

      expect(msgId).toBe('mock_msg_123');

      // Verify media payload structure
      expect(firestore.setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'media_card',
          media: mediaPayload,
        })
      );

      // Verify conversation preview text
      expect(firestore.setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          lastMessage: '🎬 Interstellar önerisi',
        }),
        { merge: true }
      );
    });

    it('should send a watch party invite payload', async () => {
      const sender = { uid: 'user_1', displayName: 'Ahmet', username: 'ahmet' };
      const recipient = { uid: 'user_2', displayName: 'Mehmet', username: 'mehmet' };

      const msgId = await sendDirectMessage(sender, recipient, {
        type: 'party_invite',
        partyCode: 'MX789K',
      });

      expect(msgId).toBe('mock_msg_123');
      expect(firestore.setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'party_invite',
          partyCode: 'MX789K',
        })
      );
    });
  });
});
