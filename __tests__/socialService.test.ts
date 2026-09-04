import {
  validateUsernameFormat,
  createPresencePayload,
  formatRelativeTime,
  USERNAME_REGEX,
  isUsernameOwnedByOther,
} from '../src/services/socialService';
import { FriendStatus, FriendRelation, UserPresence } from '../src/types/social';

describe('Social & Presence Service Unit Tests', () => {
  describe('Username Format Validation', () => {
    it('should validate correctly formatted usernames (3-15 chars, lowercase, numbers, underscore)', () => {
      const validUsernames = [
        'abc',
        'maxen',
        'ahmet',
        'erdem_123',
        'user_name',
        'gamer_2026',
        '_test_',
        '12345',
        'abcdefghijklmno', // exactly 15 chars
        'a1_b2_c3_d4',
      ];

      validUsernames.forEach((username) => {
        const result = validateUsernameFormat(username);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(USERNAME_REGEX.test(username)).toBe(true);
      });
    });

    it('should reject usernames that are too short (< 3 characters)', () => {
      const shortUsernames = ['', 'a', 'ab', '  '];

      shortUsernames.forEach((username) => {
        const result = validateUsernameFormat(username);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should reject usernames that are too long (> 15 characters)', () => {
      const longUsernames = [
        'abcdefghijklmnop', // 16 chars
        'very_long_username_here',
        '1234567890123456',
      ];

      longUsernames.forEach((username) => {
        const result = validateUsernameFormat(username);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('en fazla 15');
      });
    });

    it('should reject usernames containing uppercase letters', () => {
      const uppercaseUsernames = ['User', 'AHMET', 'MaxenApp', 'Erdem_123', 'adminA'];

      uppercaseUsernames.forEach((username) => {
        const result = validateUsernameFormat(username);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('küçük harf');
      });
    });

    it('should reject usernames containing invalid characters or spaces', () => {
      const invalidChars = [
        'user@name',
        'user.name',
        'user-name',
        'user name',
        'user#1',
        'user!app',
        'user$money',
        'user%test',
        'user*star',
        'user/test',
        'user(test)',
      ];

      invalidChars.forEach((username) => {
        const result = validateUsernameFormat(username);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should safely handle non-string or falsy input', () => {
      expect(validateUsernameFormat(null as any).valid).toBe(false);
      expect(validateUsernameFormat(undefined as any).valid).toBe(false);
    });

    it('should treat a username as available when it already belongs to the same account uid', () => {
      expect(isUsernameOwnedByOther('uid_a', 'uid_a')).toBe(false);
      expect(isUsernameOwnedByOther(null, 'uid_a')).toBe(false);
      expect(isUsernameOwnedByOther(undefined, 'uid_a')).toBe(false);
    });

    it('should treat a username as taken when it belongs to a different account', () => {
      expect(isUsernameOwnedByOther('uid_other', 'uid_a')).toBe(true);
      expect(isUsernameOwnedByOther('uid_other', undefined)).toBe(true);
    });
  });

  describe('Presence Payload Generation', () => {
    it('should generate a valid online presence payload without media', () => {
      const user = {
        uid: 'user_123',
        username: '@ahmet',
        displayName: 'Ahmet Erdem',
      };

      const presence: UserPresence = createPresencePayload(user, 'online');

      expect(presence.uid).toBe('user_123');
      expect(presence.username).toBe('ahmet'); // stripped leading @
      expect(presence.displayName).toBe('Ahmet Erdem');
      expect(presence.status).toBe('online');
      expect(presence.media).toBeNull();
      expect(presence.lastSeen).toBeGreaterThan(0);
    });

    it('should generate a watching presence payload with movie metadata', () => {
      const user = {
        uid: 'user_456',
        username: 'cinephile',
        displayName: 'Cinephile',
      };

      const media = {
        id: 550,
        tmdbId: '550',
        title: 'Fight Club',
        type: 'movie',
        poster_path: 'https://image.tmdb.org/t/p/w500/bptfVGEQuv6vDTIMVCHjJ9Dz8PX.jpg',
      };

      const presence: UserPresence = createPresencePayload(user, 'watching', media);

      expect(presence.uid).toBe('user_456');
      expect(presence.status).toBe('watching');
      expect(presence.media).toBeDefined();
      expect(presence.media?.title).toBe('Fight Club');
      expect(presence.media?.type).toBe('movie');
      expect(presence.media?.tmdbId).toBe('550');
      expect(presence.media?.posterUrl).toBe(media.poster_path);
    });

    it('should generate a watching presence payload with TV episode metadata', () => {
      const user = {
        uid: 'user_789',
        username: 'tv_fan',
        displayName: 'TV Fan',
      };

      const tvMedia = {
        id: 1399,
        title: 'Game of Thrones',
        type: 'tv',
        posterUrl: 'https://image.tmdb.org/t/p/w500/got.jpg',
        seasonNumber: 1,
        episodeNumber: 1,
      };

      const presence: UserPresence = createPresencePayload(user, 'watching', tvMedia);

      expect(presence.status).toBe('watching');
      expect(presence.media?.type).toBe('tv');
      expect(presence.media?.title).toBe('Game of Thrones');
      expect(presence.media?.seasonNum).toBe(1);
      expect(presence.media?.episodeNum).toBe(1);
    });

    it('should clear media when status is offline or idle', () => {
      const user = {
        uid: 'user_000',
        username: 'offline_user',
        displayName: 'Offline User',
      };

      const presence: UserPresence = createPresencePayload(user, 'offline', {
        title: 'Some Movie',
      });

      expect(presence.status).toBe('offline');
      expect(presence.media).toBeNull();
    });

    it('should format relative timestamps in Turkish correctly', () => {
      const now = Date.now();

      expect(formatRelativeTime(0)).toBe('Bilinmiyor');
      expect(formatRelativeTime(now - 20 * 1000)).toBe('Az önce');
      expect(formatRelativeTime(now - 5 * 60 * 1000)).toBe('5 dk önce');
      expect(formatRelativeTime(now - 2 * 60 * 60 * 1000)).toBe('2 saat önce');
      expect(formatRelativeTime(now - 25 * 60 * 60 * 1000)).toBe('Dün');
      expect(formatRelativeTime(now - 3 * 24 * 60 * 60 * 1000)).toBe('3 gün önce');
    });
  });

  describe('Friend Relationship Status Transformations', () => {
    function simulateFriendRequest(
      sender: { uid: string; username: string; displayName: string },
      receiver: { uid: string; username: string; displayName: string },
      now = Date.now()
    ): { senderRelation: FriendRelation; receiverRelation: FriendRelation } {
      const senderRelation: FriendRelation = {
        friendUid: receiver.uid,
        friendUsername: receiver.username,
        friendDisplayName: receiver.displayName,
        status: 'pending_sent',
        updatedAt: now,
      };

      const receiverRelation: FriendRelation = {
        friendUid: sender.uid,
        friendUsername: sender.username,
        friendDisplayName: sender.displayName,
        status: 'pending_received',
        updatedAt: now,
      };

      return { senderRelation, receiverRelation };
    }

    function simulateAcceptRequest(
      senderRelation: FriendRelation,
      receiverRelation: FriendRelation,
      now = Date.now()
    ): { senderRelation: FriendRelation; receiverRelation: FriendRelation } {
      return {
        senderRelation: {
          ...senderRelation,
          status: 'accepted' as FriendStatus,
          updatedAt: now,
        },
        receiverRelation: {
          ...receiverRelation,
          status: 'accepted' as FriendStatus,
          updatedAt: now,
        },
      };
    }

    it('should set pending_sent for sender and pending_received for recipient on friend request', () => {
      const userA = { uid: 'uid_a', username: 'alice', displayName: 'Alice' };
      const userB = { uid: 'uid_b', username: 'bob', displayName: 'Bob' };

      const { senderRelation, receiverRelation } = simulateFriendRequest(userA, userB);

      expect(senderRelation.friendUid).toBe(userB.uid);
      expect(senderRelation.friendUsername).toBe(userB.username);
      expect(senderRelation.status).toBe('pending_sent');

      expect(receiverRelation.friendUid).toBe(userA.uid);
      expect(receiverRelation.friendUsername).toBe(userA.username);
      expect(receiverRelation.status).toBe('pending_received');
    });

    it('should transform both relations to accepted when request is accepted', () => {
      const userA = { uid: 'uid_a', username: 'alice', displayName: 'Alice' };
      const userB = { uid: 'uid_b', username: 'bob', displayName: 'Bob' };

      const initial = simulateFriendRequest(userA, userB);
      const accepted = simulateAcceptRequest(
        initial.senderRelation,
        initial.receiverRelation
      );

      expect(accepted.senderRelation.status).toBe('accepted');
      expect(accepted.receiverRelation.status).toBe('accepted');
      expect(accepted.senderRelation.friendUid).toBe(userB.uid);
      expect(accepted.receiverRelation.friendUid).toBe(userA.uid);
    });

    it('should ensure symmetry across friend relations', () => {
      const userA = { uid: 'uid_a', username: 'alice', displayName: 'Alice' };
      const userB = { uid: 'uid_b', username: 'bob', displayName: 'Bob' };

      const initial = simulateFriendRequest(userA, userB);
      const accepted = simulateAcceptRequest(
        initial.senderRelation,
        initial.receiverRelation
      );

      // Symmetrical friend status
      expect(accepted.senderRelation.status).toBe(accepted.receiverRelation.status);
      expect(accepted.senderRelation.status).toBe('accepted');
    });
  });

  describe('Friend Profile Inspection & Privacy Verification', () => {
    it('should deny activity access to non-friends and pending friends', () => {
      const userA = 'user_1';
      const userB = 'user_2';

      const mockRelations: Record<string, FriendStatus> = {
        'user_1_user_2': 'pending_sent',
        'user_1_stranger': 'none' as any,
      };

      const checkAccess = (u1: string, u2: string) => {
        const key = `${u1}_${u2}`;
        return mockRelations[key] === 'accepted';
      };

      expect(checkAccess(userA, userB)).toBe(false);
      expect(checkAccess(userA, 'stranger')).toBe(false);
    });

    it('should grant activity access only to accepted friends', () => {
      const userA = 'user_1';
      const userB = 'user_2';

      const mockRelations: Record<string, FriendStatus> = {
        'user_1_user_2': 'accepted',
      };

      const checkAccess = (u1: string, u2: string) => {
        const key = `${u1}_${u2}`;
        return mockRelations[key] === 'accepted';
      };

      expect(checkAccess(userA, userB)).toBe(true);
    });
  });
});
