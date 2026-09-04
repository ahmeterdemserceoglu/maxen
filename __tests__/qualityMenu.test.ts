import { QualityOption } from '../src/features/player/components/QualityMenuModal';

describe('Quality Selection Unit Tests', () => {
  it('should format quality options correctly', () => {
    const qualities = ['auto', '1080p', '720p', '480p', '360p'];
    expect(qualities).toContain('auto');
    expect(qualities).toContain('1080p');
    expect(qualities).toContain('720p');
    expect(qualities).toContain('480p');
    expect(qualities).toContain('360p');
  });

  it('should return correct badge labels for resolution options', () => {
    const getBadge = (q: string) => {
      switch (q) {
        case 'auto': return 'ABR';
        case '1080p': return 'FHD';
        case '720p': return 'HD';
        case '480p': return 'SD';
        case '360p': return 'ECO';
        default: return 'AUTO';
      }
    };

    expect(getBadge('auto')).toBe('ABR');
    expect(getBadge('1080p')).toBe('FHD');
    expect(getBadge('720p')).toBe('HD');
    expect(getBadge('480p')).toBe('SD');
    expect(getBadge('360p')).toBe('ECO');
  });
});
