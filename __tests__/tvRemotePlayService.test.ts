import {
  filterTvsOnSameNetwork,
  ipv4Prefix,
  isSameLocalNetwork,
  isTvDeviceOnline,
  serializePlayMedia,
  TV_ONLINE_WINDOW_MS,
  type TvDevice,
} from '../src/services/tvRemotePlayService';

describe('TV remote play (same-network cast)', () => {
  describe('ipv4Prefix / isSameLocalNetwork', () => {
    it('extracts a /24 prefix and rejects loopback', () => {
      expect(ipv4Prefix('192.168.1.42')).toBe('192.168.1');
      expect(ipv4Prefix('10.0.0.8')).toBe('10.0.0');
      expect(ipv4Prefix('127.0.0.1')).toBeNull();
      expect(ipv4Prefix('not-an-ip')).toBeNull();
      expect(ipv4Prefix('999.1.1.1')).toBeNull();
    });

    it('treats missing IPs as same network so listing still works', () => {
      expect(isSameLocalNetwork(null, '192.168.1.10')).toBe(true);
      expect(isSameLocalNetwork('192.168.1.10', undefined)).toBe(true);
    });

    it('keeps devices on the same LAN and drops a different subnet', () => {
      expect(isSameLocalNetwork('192.168.1.10', '192.168.1.80')).toBe(true);
      expect(isSameLocalNetwork('192.168.1.10', '192.168.0.80')).toBe(false);
    });
  });

  describe('filterTvsOnSameNetwork', () => {
    const now = 1_700_000_000_000;
    const devices: TvDevice[] = [
      {
        deviceId: 'tv_a',
        ownerUid: 'u1',
        deviceName: 'Salon',
        localIp: '192.168.1.20',
        lastSeen: now - 10_000,
      },
      {
        deviceId: 'tv_offline',
        ownerUid: 'u1',
        deviceName: 'Kapalı',
        localIp: '192.168.1.21',
        lastSeen: now - TV_ONLINE_WINDOW_MS - 5_000,
      },
      {
        deviceId: 'tv_other_lan',
        ownerUid: 'u1',
        deviceName: 'Başka Ağ',
        localIp: '10.0.0.5',
        lastSeen: now - 5_000,
      },
    ];

    it('returns only online TVs on the phone subnet', () => {
      const result = filterTvsOnSameNetwork(devices, '192.168.1.55', now);
      expect(result.map((d) => d.deviceId)).toEqual(['tv_a']);
    });

    it('marks a heartbeat within the window as online', () => {
      expect(isTvDeviceOnline(now - 20_000, now)).toBe(true);
      expect(isTvDeviceOnline(now - TV_ONLINE_WINDOW_MS - 1, now)).toBe(false);
    });
  });

  describe('serializePlayMedia', () => {
    it('serializes a movie with account profile id', () => {
      const payload = serializePlayMedia(
        { id: 550, title: 'Fight Club', type: 'movie', posterUrl: 'https://x/p.jpg' },
        'profile_1'
      );
      expect(payload.profileId).toBe('profile_1');
      expect(payload.type).toBe('movie');
      expect(payload.title).toBe('Fight Club');
      expect(payload.tmdbId).toBe(550);
    });

    it('detects a series episode from season/episode numbers', () => {
      const payload = serializePlayMedia(
        {
          id: '1399-s1e1',
          tmdbId: 1399,
          title: 'Winter Is Coming',
          show_title: 'Game of Thrones',
          seasonNumber: 1,
          episodeNumber: 1,
        },
        'profile_2'
      );
      expect(payload.type).toBe('tv');
      expect(payload.seasonNumber).toBe(1);
      expect(payload.episodeNumber).toBe(1);
      expect(payload.show_title).toBe('Game of Thrones');
    });

    // ── Bug Fix #2 — TV'ye yansıtmada pozisyon iletimi ───────────────────────
    describe('positionSeconds — TV kaldığı yerden başlatma [BUG FIX]', () => {

      it('[BUG FIX] positionSeconds medyadan TV komutuna taşınır', () => {
        // Senaryo: Kullanıcı filmi 10. dakikada TV'ye gönderiyor.
        // VideoPlayerView: media={{ ...media, positionSeconds: Math.floor(currentTime) }}
        const payload = serializePlayMedia(
          { id: 550, type: 'movie', title: 'Fight Club', positionSeconds: 600 },
          'p1'
        );
        expect(payload.positionSeconds).toBe(600);
      });

      it('[BUG FIX] kesirli saniyeler tamsayıya yuvarlanır', () => {
        const payload = serializePlayMedia(
          { id: 550, type: 'movie', title: 'Fight Club', positionSeconds: 183.7 },
          'p1'
        );
        expect(payload.positionSeconds).toBe(183); // Math.floor
      });

      it('[REGRESYON] positionSeconds yoksa (eski format) undefined döner', () => {
        // Eski media nesneleri positionSeconds içermez — bu durumda TV baştan başlatmalı
        const payload = serializePlayMedia(
          { id: 550, type: 'movie', title: 'Fight Club' },
          'p1'
        );
        expect(payload.positionSeconds).toBeUndefined();
      });

      it('positionSeconds 0 veya negatifse iletilmez — TV baştan başlatır', () => {
        const p0 = serializePlayMedia(
          { id: 550, type: 'movie', title: 'Fight Club', positionSeconds: 0 },
          'p1'
        );
        expect(p0.positionSeconds).toBeUndefined();

        const pNeg = serializePlayMedia(
          { id: 550, type: 'movie', title: 'Fight Club', positionSeconds: -5 },
          'p1'
        );
        expect(pNeg.positionSeconds).toBeUndefined();
      });

      it('dizi bölümünü 45. dakikada TV\'ye göndermek doğru pozisyonu taşır', () => {
        // Senaryo: Breaking Bad S02E03'ü izlerken 45. dakikada TV'ye gönderiliyor
        const payload = serializePlayMedia(
          {
            id: 1396,
            type: 'tv',
            show_title: 'Breaking Bad',
            season_number: 2,
            episode_number: 3,
            positionSeconds: 2700, // 45 dakika
          },
          'profile_abc'
        );
        expect(payload.positionSeconds).toBe(2700);
        expect(payload.seasonNumber).toBe(2);
        expect(payload.episodeNumber).toBe(3);
        expect(payload.type).toBe('tv');
      });

      it('TV tarafı startSeconds ile positionSeconds\'ı kullanır — end-to-end akış', () => {
        // app/index.tsx: startSeconds={activeVideo.positionSeconds || 0}
        // Bu test, serializePlayMedia çıktısının positionSeconds'ının
        // VideoPlayerView'e startSeconds olarak iletildiğinde 0'dan büyük olduğunu doğrular

        const mockCurrentTime = 843; // 14 dakika 3 saniye
        const mediaWithCurrentTime = {
          id: 550,
          type: 'movie' as const,
          title: 'Interstellar',
          positionSeconds: Math.floor(mockCurrentTime), // VideoPlayerView'in yaptığı
        };

        const tvCommand = serializePlayMedia(mediaWithCurrentTime, 'p1');

        // TV tarafı activeVideo.positionSeconds || 0 kullanır
        const startSeconds = tvCommand.positionSeconds || 0;
        expect(startSeconds).toBe(843);
        expect(startSeconds).toBeGreaterThan(0); // Baştan başlatmıyor
      });
    });
  });
});
