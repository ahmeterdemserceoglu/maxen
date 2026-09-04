import { parseSubtitles, timeToSeconds } from '../src/features/player/services';

describe('Subtitle Parser & Timestamp Unit Tests', () => {
  it('should parse time strings to seconds accurately', () => {
    expect(timeToSeconds('00:00:05.500')).toBeCloseTo(5.5, 3);
    expect(timeToSeconds('00:01:30.000')).toBeCloseTo(90.0, 3);
    expect(timeToSeconds('01:15:20.250')).toBeCloseTo(4520.25, 3);
    expect(timeToSeconds('00:00:10,500')).toBeCloseTo(10.5, 3); // SRT comma separator
  });

  it('should parse SRT subtitle text into structured cue items', () => {
    const srtContent = `
1
00:00:01,000 --> 00:00:04,000
Merhaba dünya!

2
00:00:05,500 --> 00:00:08,200
Maxen ile kesintisiz izle.
`;

    const cues = parseSubtitles(srtContent);

    expect(cues).toHaveLength(2);
    expect(cues[0].start).toBeCloseTo(1.0, 2);
    expect(cues[0].end).toBeCloseTo(4.0, 2);
    expect(cues[0].text).toBe('Merhaba dünya!');

    expect(cues[1].start).toBeCloseTo(5.5, 2);
    expect(cues[1].end).toBeCloseTo(8.2, 2);
    expect(cues[1].text).toBe('Maxen ile kesintisiz izle.');
  });

  it('should parse VTT subtitle text and strip formatting tags', () => {
    const vttContent = `WEBVTT

00:00:02.000 --> 00:00:06.000
<b><i>Harika bir film deneyimi</i></b>
`;

    const cues = parseSubtitles(vttContent);

    expect(cues.length).toBeGreaterThanOrEqual(1);
    expect(cues[0].start).toBeCloseTo(2.0, 2);
    expect(cues[0].end).toBeCloseTo(6.0, 2);
    expect(cues[0].text).toContain('Harika bir film deneyimi');
  });

  it('should return empty array for empty subtitle content', () => {
    expect(parseSubtitles('')).toEqual([]);
  });
});
