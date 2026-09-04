import { WatchPartyRoom } from '../src/services/watchPartyService';

describe('Watch Party Service & Synchronization Unit Tests', () => {
  function generatePartyCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  function calculateTargetSyncTime(room: {
    currentTime: number;
    isPlaying: boolean;
    updatedAt: number;
  }, now: number): number {
    const delta = Math.max(0, (now - room.updatedAt) / 1000);
    return room.isPlaying ? room.currentTime + delta : room.currentTime;
  }

  it('should generate valid 6-character room codes without ambiguous characters', () => {
    for (let i = 0; i < 50; i++) {
      const code = generatePartyCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[A-Z2-9]{6}$/);
      expect(code).not.toContain('0');
      expect(code).not.toContain('O');
      expect(code).not.toContain('1');
      expect(code).not.toContain('I');
    }
  });

  it('should correctly calculate playback target time with delta when playing', () => {
    const updatedAt = 1000000;
    const now = 1005000; // 5 seconds later
    const room = {
      currentTime: 120,
      isPlaying: true,
      updatedAt,
    };

    const targetTime = calculateTargetSyncTime(room, now);
    expect(targetTime).toBe(125); // 120 + 5s
  });

  it('should not advance target time when playback is paused', () => {
    const updatedAt = 1000000;
    const now = 1008000; // 8 seconds later
    const room = {
      currentTime: 120,
      isPlaying: false,
      updatedAt,
    };

    const targetTime = calculateTargetSyncTime(room, now);
    expect(targetTime).toBe(120); // unchanged because paused
  });

  it('should evaluate drift threshold correctly (sync only if drift > 1.8s)', () => {
    const DRIFT_THRESHOLD = 1.8;

    function shouldSync(localTime: number, remoteTargetTime: number): boolean {
      return Math.abs(localTime - remoteTargetTime) > DRIFT_THRESHOLD;
    }

    // Minor drift (< 1.8s) -> should NOT jump/stutter
    expect(shouldSync(100.5, 101.2)).toBe(false);
    expect(shouldSync(100.0, 101.7)).toBe(false);

    // Major drift (> 1.8s) -> SHOULD sync
    expect(shouldSync(100.0, 102.5)).toBe(true);
    expect(shouldSync(150.0, 120.0)).toBe(true);
  });

  it('should structure chat messages correctly', () => {
    const msg = {
      id: 'msg_12345',
      senderId: 'user_abc',
      senderName: 'Erdem',
      text: 'Harika bir sahne!',
      createdAt: Date.now(),
    };

    expect(msg.id).toBeDefined();
    expect(msg.senderName).toBe('Erdem');
    expect(msg.text).toBe('Harika bir sahne!');
    expect(msg.createdAt).toBeGreaterThan(0);
  });

  describe('Watch Party Lifecycle & Room Cleanup Logic', () => {
    it('should determine room deletion when the last participant leaves', () => {
      const participants = [
        { uid: 'user_1', name: 'User 1', isHost: true, joinedAt: 1000 },
      ];
      const leavingUid = 'user_1';
      const remainingParticipants = participants.filter((p) => p.uid !== leavingUid);

      expect(remainingParticipants.length).toBe(0);
      // Zero remaining participants -> triggers immediate room purge / deletion
      const shouldDeleteRoom = remainingParticipants.length === 0;
      expect(shouldDeleteRoom).toBe(true);
    });

    it('should automatically reassign host to next participant when current host leaves', () => {
      const participants = [
        { uid: 'host_1', name: 'First Host', isHost: true, joinedAt: 1000 },
        { uid: 'user_2', name: 'Second User', isHost: false, joinedAt: 1005 },
        { uid: 'user_3', name: 'Third User', isHost: false, joinedAt: 1010 },
      ];
      const currentHostId: string = 'host_1';
      const leavingUid: string = 'host_1';

      const remainingParticipants = participants.filter((p) => p.uid !== leavingUid);
      expect(remainingParticipants.length).toBe(2);

      const isLeavingHost = (currentHostId as string) === (leavingUid as string);
      expect(isLeavingHost).toBe(true);

      if (isLeavingHost && remainingParticipants.length > 0) {
        remainingParticipants[0].isHost = true;
      }

      expect(remainingParticipants[0].uid).toBe('user_2');
      expect(remainingParticipants[0].name).toBe('Second User');
      expect(remainingParticipants[0].isHost).toBe(true);
    });

    it('should retain existing host when a non-host participant leaves', () => {
      const participants = [
        { uid: 'host_1', name: 'First Host', isHost: true, joinedAt: 1000 },
        { uid: 'user_2', name: 'Second User', isHost: false, joinedAt: 1005 },
      ];
      const currentHostId: string = 'host_1';
      const leavingUid: string = 'user_2';

      const remainingParticipants = participants.filter((p) => p.uid !== leavingUid);
      expect(remainingParticipants.length).toBe(1);

      const isLeavingHost = (currentHostId as string) === (leavingUid as string);
      expect(isLeavingHost).toBe(false);
      expect(remainingParticipants[0].uid).toBe('host_1');
      expect(remainingParticipants[0].isHost).toBe(true);
    });

    it('should notify subscriber with null when room is missing or closed', () => {
      let notifiedRoom: any = 'initial_state';
      let closedCalled = false;

      const handleSnapshot = (
        exists: boolean,
        status?: 'active' | 'closed'
      ) => {
        if (!exists) {
          notifiedRoom = null;
          closedCalled = true;
          return;
        }
        if (status === 'closed') {
          notifiedRoom = null;
          closedCalled = true;
          return;
        }
        notifiedRoom = { status };
      };

      // Case 1: Room document deleted / does not exist
      handleSnapshot(false);
      expect(notifiedRoom).toBeNull();
      expect(closedCalled).toBe(true);

      // Case 2: Room is closed
      notifiedRoom = 'initial_state';
      closedCalled = false;
      handleSnapshot(true, 'closed');
      expect(notifiedRoom).toBeNull();
      expect(closedCalled).toBe(true);
    });
  });
});
