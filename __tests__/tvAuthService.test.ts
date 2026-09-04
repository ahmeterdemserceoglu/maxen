import {
  generatePairingCode,
  TvSessionData,
} from '../src/services/tvAuthService';

describe('TV Auth & Pairing Service Unit Tests', () => {
  describe('Pairing Code Generation', () => {
    it('should generate a 6-character pairing code by default', () => {
      const code = generatePairingCode();
      expect(code).toHaveLength(6);
    });

    it('should support custom code length', () => {
      expect(generatePairingCode(4)).toHaveLength(4);
      expect(generatePairingCode(8)).toHaveLength(8);
    });

    it('should only use readable characters and exclude ambiguous ones (0, O, 1, I)', () => {
      for (let i = 0; i < 100; i++) {
        const code = generatePairingCode(6);
        expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
        expect(code).not.toContain('0');
        expect(code).not.toContain('O');
        expect(code).not.toContain('1');
        expect(code).not.toContain('I');
      }
    });

    it('should produce unique codes on subsequent calls', () => {
      const codeSet = new Set<string>();
      for (let i = 0; i < 50; i++) {
        codeSet.add(generatePairingCode(6));
      }
      expect(codeSet.size).toBe(50);
    });
  });

  describe('TV Session Lifecycle & Validation', () => {
    it('should correctly set initial session data with 5 minutes expiration', () => {
      const now = Date.now();
      const code = generatePairingCode(6);
      const session: TvSessionData = {
        code,
        status: 'pending',
        createdAt: now,
        expiresAt: now + 5 * 60 * 1000,
      };

      expect(session.status).toBe('pending');
      expect(session.expiresAt - session.createdAt).toBe(300000);
      expect(session.userId).toBeUndefined();
    });

    it('should validate active sessions vs expired sessions', () => {
      const now = Date.now();
      const activeSession: TvSessionData = {
        code: 'XYZ892',
        status: 'pending',
        createdAt: now,
        expiresAt: now + 60000, // 1 min left
      };

      const isExpired = (session: TvSessionData, time: number) => time > session.expiresAt;

      expect(isExpired(activeSession, now)).toBe(false);
      expect(isExpired(activeSession, now + 120000)).toBe(true);
    });

    it('should transform pending session to authenticated session on mobile confirmation', () => {
      const now = Date.now();
      const session: TvSessionData = {
        code: 'MAX999',
        status: 'pending',
        createdAt: now - 10000,
        expiresAt: now + 290000,
      };

      const authenticateSession = (
        curr: TvSessionData,
        userId: string,
        userEmail?: string,
        profileId?: string,
        userDisplayName?: string
      ): TvSessionData => ({
        ...curr,
        status: 'authenticated',
        userId,
        userEmail: userEmail || '',
        userDisplayName: userDisplayName || '',
        profileId: profileId || '',
        authenticatedAt: Date.now(),
      });

      const updated = authenticateSession(
        session,
        'user_12345',
        'ahmet@test.com',
        'prof_adult',
        'Ahmet Erdem'
      );

      expect(updated.status).toBe('authenticated');
      expect(updated.userId).toBe('user_12345');
      expect(updated.userEmail).toBe('ahmet@test.com');
      expect(updated.profileId).toBe('prof_adult');
      expect(updated.userDisplayName).toBe('Ahmet Erdem');
      expect(updated.authenticatedAt).toBeGreaterThan(0);
    });
  });

  describe('Deep Linking URL Parsing for TV Pairing', () => {
    function parseTvPairingUrl(url: string): { code: string | null; isValid: boolean } {
      if (!url) return { code: null, isValid: false };
      
      const match = url.match(/[?&]code=([a-zA-Z0-9]{6})/);
      if (match && match[1]) {
        return {
          code: match[1].toUpperCase(),
          isValid: true,
        };
      }
      return { code: null, isValid: false };
    }

    it('should parse custom scheme deep link maxen://tv-pair?code=ABCDEF', () => {
      const result = parseTvPairingUrl('maxen://tv-pair?code=XYZ789');
      expect(result.isValid).toBe(true);
      expect(result.code).toBe('XYZ789');
    });

    it('should normalize lowercase code from QR to uppercase', () => {
      const result = parseTvPairingUrl('maxen://tv-pair?code=abc234');
      expect(result.isValid).toBe(true);
      expect(result.code).toBe('ABC234');
    });

    it('should reject invalid or truncated code parameters', () => {
      expect(parseTvPairingUrl('maxen://tv-pair?code=123').isValid).toBe(false);
      expect(parseTvPairingUrl('maxen://tv-pair').isValid).toBe(false);
      expect(parseTvPairingUrl('').isValid).toBe(false);
    });

    it('should parse HTTP/HTTPS fallback QR URLs', () => {
      const result = parseTvPairingUrl('https://maxen.tv/pair?code=K7X9PQ&source=qr');
      expect(result.isValid).toBe(true);
      expect(result.code).toBe('K7X9PQ');
    });
  });
});
