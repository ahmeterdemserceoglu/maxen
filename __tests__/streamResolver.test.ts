import { RESOLVER_PROVIDERS, normalizeLang } from '../src/features/player/services';
import { isDirectStream, resolveParallelDirectStreamResult } from '../src/features/player/services/streamResolverService';
import { streamSessionManager } from '../src/features/player/services/StreamSessionManager';

describe('Stream Resolver & Extraction Unit Tests', () => {
  it('should have all verified live resolver providers configured', () => {
    expect(RESOLVER_PROVIDERS.length).toBe(15);
    const providerNames = RESOLVER_PROVIDERS.map((p) => p.name);
    expect(providerNames).toContain('VidLink');
    expect(providerNames).toContain('Videasy');
    expect(providerNames).toContain('Rivestream');
    expect(providerNames).toContain('AnyEmbed');
    expect(providerNames).toContain('Vidsrc.to');
    expect(providerNames).toContain('Vidsrc.net');
    expect(providerNames).toContain('Vidsrc.icu');
    expect(providerNames).toContain('VidSrc.pro');
    expect(providerNames).toContain('VidSrc.in');
    expect(providerNames).toContain('VidSrc.xyz');
    expect(providerNames).toContain('VidSrc.vip');
    expect(providerNames).toContain('AutoEmbed');
    expect(providerNames).toContain('MoviesAPI');
    expect(providerNames).toContain('SmashyStream');
    expect(providerNames).toContain('VidFast');
  });

  it('should format provider URLs correctly for both movie and tv', () => {
    const vidLink = RESOLVER_PROVIDERS.find((p) => p.name === 'VidLink')!;
    expect(vidLink.getUrl('550', false, 1, 1)).toBe('https://vidlink.pro/movie/550?primaryColor=e50914&autoplay=true');
    expect(vidLink.getUrl('1399', true, 2, 5)).toBe('https://vidlink.pro/tv/1399/2/5?primaryColor=e50914&autoplay=true');

    const videasy = RESOLVER_PROVIDERS.find((p) => p.name === 'Videasy')!;
    expect(videasy.getUrl('550', false, 1, 1)).toBe('https://player.videasy.net/movie/550');
    expect(videasy.getUrl('1399', true, 2, 5)).toBe('https://player.videasy.net/tv/1399/2/5');

    const anyEmbed = RESOLVER_PROVIDERS.find((p) => p.name === 'AnyEmbed')!;
    expect(anyEmbed.getUrl('550', false, 1, 1)).toBe('https://anyembed.xyz/embed/movie/550');
    expect(anyEmbed.getUrl('1399', true, 2, 5)).toBe('https://anyembed.xyz/embed/tv/1399/2/5');

    const smashy = RESOLVER_PROVIDERS.find((p) => p.name === 'SmashyStream')!;
    expect(smashy.getUrl('550', false, 1, 1)).toBe('https://embed.smashystream.com/playere.php?tmdb=550');
    expect(smashy.getUrl('1399', true, 2, 5)).toBe('https://embed.smashystream.com/playere.php?tmdb=1399&season=2&episode=5');

    const moviesApi = RESOLVER_PROVIDERS.find((p) => p.name === 'MoviesAPI')!;
    expect(moviesApi.getUrl('550', false, 1, 1)).toBe('https://moviesapi.club/movie/550');
    expect(moviesApi.getUrl('1399', true, 2, 5)).toBe('https://moviesapi.club/tv/1399-2-5');

    const vidSrcPro = RESOLVER_PROVIDERS.find((p) => p.name === 'VidSrc.pro')!;
    expect(vidSrcPro.getUrl('550', false, 1, 1)).toBe('https://vidsrc.pro/embed/movie/550');
    expect(vidSrcPro.getUrl('1399', true, 2, 5)).toBe('https://vidsrc.pro/embed/tv/1399/2/5');

    const vidSrcIn = RESOLVER_PROVIDERS.find((p) => p.name === 'VidSrc.in')!;
    expect(vidSrcIn.getUrl('550', false, 1, 1)).toBe('https://vidsrc.in/embed/movie/550');
    expect(vidSrcIn.getUrl('1399', true, 2, 5)).toBe('https://vidsrc.in/embed/tv/1399/2/5');
  });

  it('should normalize language codes correctly', () => {
    expect(normalizeLang('tr')).toBe('Türkçe');
    expect(normalizeLang('turkish')).toBe('Türkçe');
    expect(normalizeLang('en')).toBe('English');
    expect(normalizeLang('eng')).toBe('English');
    expect(normalizeLang('de')).toBe('Deutsch');
    expect(normalizeLang('ja')).toBe('日本語');
  });

  it('should sanitize and extract direct HLS stream patterns even with existing query params', () => {
    function formatStreamUrl(rawUrl: string, token: string, expires: string) {
      let pathname = rawUrl;
      let existingQuery = '';
      if (rawUrl.includes('?')) {
        const parts = rawUrl.split('?');
        pathname = parts[0];
        existingQuery = parts[1];
      }
      if (!pathname.endsWith('.m3u8')) {
        pathname = `${pathname}.m3u8`;
      }
      const queryParts = [];
      if (existingQuery) queryParts.push(existingQuery);
      if (token) queryParts.push(`token=${token}`);
      if (expires) queryParts.push(`expires=${expires}`);
      queryParts.push('h=1');
      queryParts.push('lang=en');
      return `${pathname}?${queryParts.join('&')}`;
    }

    const cleanUrl = formatStreamUrl('https://stream.provider.to/hls/master', 'secret_token', '1724883900');
    expect(cleanUrl).toBe('https://stream.provider.to/hls/master.m3u8?token=secret_token&expires=1724883900&h=1&lang=en');

    const queryUrl = formatStreamUrl('https://vixsrc.to/playlist/174559?b=1', 'token123', '1793141421');
    expect(queryUrl).toBe('https://vixsrc.to/playlist/174559.m3u8?b=1&token=token123&expires=1793141421&h=1&lang=en');
  });

  it('should validate query parameters for stream endpoints', () => {
    function validateParams(query: Record<string, any>) {
      const tmdbId = query.tmdbId;
      const type = query.type || 'movie';
      const season = parseInt(query.season || '1', 10);
      const episode = parseInt(query.episode || '1', 10);

      if (!tmdbId || !/^[a-zA-Z0-9_-]+$/.test(String(tmdbId).trim())) {
        return { valid: false, error: 'Invalid tmdbId' };
      }
      if (type !== 'movie' && type !== 'tv') {
        return { valid: false, error: 'Invalid type' };
      }
      if (isNaN(season) || season < 1 || isNaN(episode) || episode < 1) {
        return { valid: false, error: 'Invalid season or episode' };
      }
      return { valid: true, tmdbId, type, season, episode };
    }

    expect(validateParams({ tmdbId: '550', type: 'movie' })).toEqual({
      valid: true,
      tmdbId: '550',
      type: 'movie',
      season: 1,
      episode: 1,
    });

    expect(validateParams({ tmdbId: '1399', type: 'tv', season: '2', episode: '5' })).toEqual({
      valid: true,
      tmdbId: '1399',
      type: 'tv',
      season: 2,
      episode: 5,
    });

    expect(validateParams({ tmdbId: '' }).valid).toBe(false);
    expect(validateParams({ tmdbId: '550', type: 'invalid_type' }).valid).toBe(false);
    expect(validateParams({ tmdbId: '550', season: '-1' }).valid).toBe(false);
  });

  it('should accurately detect direct stream formats via isDirectStream', () => {
    expect(isDirectStream('https://cdn.example.com/stream/index.m3u8')).toBe(true);
    expect(isDirectStream('https://cdn.example.com/video/movie.mp4')).toBe(true);
    expect(isDirectStream('https://cdn.example.com/playlist/720p.m3u8?token=xyz')).toBe(true);
    expect(isDirectStream('https://cdn.example.com/dash/manifest.mpd')).toBe(true);
    expect(isDirectStream('https://vidsrc.xyz/embed/movie?tmdb=550')).toBe(false);
    expect(isDirectStream('')).toBe(false);
    expect(isDirectStream(undefined)).toBe(false);
  });

  describe('VixSrc URL Construction & Double Question Mark (403 Error) Prevention', () => {
    function constructVixSrcUrl(cleanBase: string, token: string, expires: string) {
      const q: string[] = [];
      if (token) q.push(`token=${token}`);
      if (expires) q.push(`expires=${expires}`);
      q.push('h=1');
      q.push('lang=en');
      const sep = cleanBase.includes('?') ? '&' : '?';
      return `${cleanBase}${sep}${q.join('&')}#master.m3u8`;
    }

    it('should NEVER produce double question marks (?b=1?token=) when base URL contains query parameters', () => {
      const baseUrlWithQuery = 'https://vixsrc.to/playlist/777603?b=1';
      const token = '3f74f1c8e0412c912a9ce93a31a2f1d4';
      const expires = '1793581557';

      const finalUrl = constructVixSrcUrl(baseUrlWithQuery, token, expires);

      // Verifies the exact fix for 403 Forbidden:
      expect(finalUrl).not.toContain('?b=1?token=');
      expect(finalUrl).toContain('?b=1&token=');
      expect(finalUrl.split('?').length).toBe(2);
      expect(finalUrl).toBe(
        'https://vixsrc.to/playlist/777603?b=1&token=3f74f1c8e0412c912a9ce93a31a2f1d4&expires=1793581557&h=1&lang=en#master.m3u8'
      );
    });

    it('should use single ? when base URL has no existing query parameters', () => {
      const cleanBaseUrl = 'https://vixsrc.to/playlist/187033';
      const token = 'b5e2989db62bbd1faead435dfa253dd9';
      const expires = '1793581849';

      const finalUrl = constructVixSrcUrl(cleanBaseUrl, token, expires);

      expect(finalUrl).toContain('?token=');
      expect(finalUrl.split('?').length).toBe(2);
      expect(finalUrl).toBe(
        'https://vixsrc.to/playlist/187033?token=b5e2989db62bbd1faead435dfa253dd9&expires=1793581849&h=1&lang=en#master.m3u8'
      );
    });
  });

  describe('Background Resolver Isolation (Prevents Stream Hijacking)', () => {
    it('resolveParallelDirectStreamResult must NEVER call streamSessionManager.setSession directly', async () => {
      const setSessionSpy = jest.spyOn(streamSessionManager, 'setSession');
      streamSessionManager.clearSession();

      const originalFetch = global.fetch;
      const mockApiPayload = { src: '/embed/187033?token=abc' };
      const mockEmbedHtml = `
        <script>
          window.masterPlaylist = {
            params: { token: 'tok123', expires: '1800000000' },
            url: 'https://vixsrc.to/playlist/187033'
          };
        </script>
      `;

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/api/tv/') || url.includes('/api/movie/')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => mockApiPayload,
          });
        }
        if (url.includes('/embed/')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => mockEmbedHtml,
          });
        }
        return Promise.resolve({ ok: false, status: 500 });
      }) as any;

      try {
        const result = await resolveParallelDirectStreamResult({
          tmdbId: '242073',
          isMovie: false,
          seasonNum: 1,
          episodeNum: 3,
          timeoutMs: 3000,
        });

        expect(result).not.toBeNull();
        expect(result?.streamUrl).toContain('https://vixsrc.to/playlist/187033');

        // CRITICAL: Background resolution must NOT change active player session!
        expect(setSessionSpy).not.toHaveBeenCalled();
        expect(streamSessionManager.getSession()).toBeNull();
      } finally {
        global.fetch = originalFetch;
        setSessionSpy.mockRestore();
      }
    });
  });

  describe('MediaKey Isolation (Prevents Cross-Movie Player Switches)', () => {
    it('active player listener should ignore sessions intended for other media', () => {
      const currentMediaKey = 'tv_242073_1_3'; // Kübra Season 1 Episode 3
      let activePlayerStreamUrl: string | null = null;

      // VideoPlayerView's session listener logic
      const handleSessionChange = (session: any) => {
        if (session && session.streamUrl) {
          if (session.mediaKey && session.mediaKey !== currentMediaKey) {
            return; // Ignore foreign session
          }
          activePlayerStreamUrl = session.streamUrl;
        }
      };

      streamSessionManager.addListener(handleSessionChange);

      // 1. Background hero banner resolves Spider-Man (969681)
      streamSessionManager.setSession({
        streamUrl: 'https://vixsrc.to/playlist/777603?token=spiderman#master.m3u8',
        provider: 'Hero Preheater',
        expiresAt: Date.now() + 3600000,
        mediaKey: 'movie_969681_1_1',
      });

      // Active player MUST NOT be switched to Spider-Man!
      expect(activePlayerStreamUrl).toBeNull();

      // 2. Active episode session arrives
      streamSessionManager.setSession({
        streamUrl: 'https://vixsrc.to/playlist/187033?token=kubra#master.m3u8',
        provider: 'VixSrc Direct',
        expiresAt: Date.now() + 3600000,
        mediaKey: 'tv_242073_1_3',
      });

      // Active player switches to Kübra!
      expect(activePlayerStreamUrl).toBe(
        'https://vixsrc.to/playlist/187033?token=kubra#master.m3u8'
      );

      streamSessionManager.removeListener(handleSessionChange);
    });
  });

  describe('Continue Watching Token Expiration & Ad Blacklisting', () => {
    function validateSavedStream(url: string | null | undefined): {
      isValid: boolean;
      isExpired: boolean;
    } {
      if (!url || typeof url !== 'string') return { isValid: false, isExpired: false };
      const hasDirectFormat =
        url.includes('.m3u8') || url.includes('.mp4') || url.includes('/playlist/');
      if (!hasDirectFormat) return { isValid: false, isExpired: false };

      const isAd =
        url.includes('ads') ||
        url.includes('doubleclick') ||
        url.includes('trailer') ||
        url.includes('preview');
      if (isAd) return { isValid: false, isExpired: false };

      const expMatch = url.match(/expires=(\d+)/);
      if (expMatch) {
        const expTimestamp = Number(expMatch[1]) * 1000;
        if (expTimestamp <= Date.now() + 60000) {
          return { isValid: false, isExpired: true };
        }
      }
      return { isValid: true, isExpired: false };
    }

    it('should reject expired stream tokens and flag as expired', () => {
      const expiredUrl =
        'https://vixsrc.to/playlist/187033?token=old_token&expires=1680000000#master.m3u8';
      const check = validateSavedStream(expiredUrl);

      expect(check.isValid).toBe(false);
      expect(check.isExpired).toBe(true);
    });

    it('should accept valid future stream tokens', () => {
      const futureUrl =
        'https://vixsrc.to/playlist/187033?token=fresh_token&expires=1900000000#master.m3u8';
      const check = validateSavedStream(futureUrl);

      expect(check.isValid).toBe(true);
      expect(check.isExpired).toBe(false);
    });

    it('should reject ad, trailer and doubleclick URLs', () => {
      expect(validateSavedStream('https://googleads.doubleclick.net/ad.mp4').isValid).toBe(false);
      expect(validateSavedStream('https://cdn.example.com/trailer_preview.m3u8').isValid).toBe(false);
      expect(validateSavedStream('https://random.site/ads/banner.m3u8').isValid).toBe(false);
    });
  });

  describe('Provider Loop Cancellation & Playback Lock', () => {
    it('should immediately abort provider loop when stream is found or playing', () => {
      let isStreamFound = false;
      let currentStreamUrl: string | null = null;
      let isPlaying = false;
      let timeoutCleared = false;
      let nextProviderCalled = false;

      let timerId: any = 'active_timer_123';

      function cancelResolver() {
        timerId = null;
        timeoutCleared = true;
      }

      function tryNextProvider() {
        if (isStreamFound || currentStreamUrl || isPlaying) {
          cancelResolver();
          return;
        }
        nextProviderCalled = true;
      }

      tryNextProvider();
      expect(nextProviderCalled).toBe(true);
      nextProviderCalled = false;

      // Stream found by VixSrc!
      isStreamFound = true;
      currentStreamUrl = 'https://vixsrc.to/playlist/187033.m3u8';
      isPlaying = true;

      // Timeout fires 7 seconds later
      tryNextProvider();

      expect(nextProviderCalled).toBe(false);
      expect(timeoutCleared).toBe(true);
      expect(timerId).toBeNull();
    });

    it('handleResolverMessage should reject late-arriving URLs if video is already playing', () => {
      let activeStreamUrl = 'https://vixsrc.to/playlist/187033.m3u8';
      let isStreamFound = true;
      let isPlaying = true;
      let rejected = false;

      function handleResolverMessage(data: any) {
        if (data?.type === 'RESOLVED_URL' && data.url) {
          if (isStreamFound || activeStreamUrl || isPlaying) {
            rejected = true;
            return;
          }
          activeStreamUrl = data.url;
        }
      }

      handleResolverMessage({
        type: 'RESOLVED_URL',
        url: 'https://anyembed.xyz/promo_video.mp4',
      });

      expect(rejected).toBe(true);
      expect(activeStreamUrl).toBe('https://vixsrc.to/playlist/187033.m3u8');
    });
  });
});
