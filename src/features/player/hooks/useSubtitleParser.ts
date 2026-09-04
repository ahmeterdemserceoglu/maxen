import { useState, useEffect } from 'react';
import { SubtitleTrack } from '@/store/playerStore';

export interface ParsedSubtitle {
  start: number;
  end: number;
  text: string;
}

export function useSubtitleParser(track: SubtitleTrack | null) {
  const [parsedCues, setParsedCues] = useState<ParsedSubtitle[]>([]);

  useEffect(() => {
    if (!track || !track.url) {
      setParsedCues([]);
      return;
    }

    let isCancelled = false;

    const parseTime = (timeStr: string) => {
      // Example: 00:01:23,456 or 00:01:23.456
      const parts = timeStr.replace(',', '.').split(':');
      if (parts.length === 3) {
        return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
      }
      return 0;
    };

    const fetchAndParse = async () => {
      try {
        const res = await fetch(track.url);
        const text = await res.text();
        
        if (isCancelled) return;

        const isVtt = text.includes('WEBVTT') || track.url.endsWith('.vtt');
        const lines = text.split(/\r?\n/);
        const cues: ParsedSubtitle[] = [];
        let i = 0;

        while (i < lines.length) {
          let line = lines[i].trim();
          
          if (!line || line === 'WEBVTT' || !isNaN(Number(line))) {
            i++;
            continue;
          }

          if (line.includes('-->')) {
            const timeParts = line.split('-->');
            const start = parseTime(timeParts[0].trim());
            const end = parseTime(timeParts[1].trim());

            i++;
            let subtitleText = '';
            while (i < lines.length && lines[i].trim() !== '') {
              subtitleText += lines[i].trim() + '\n';
              i++;
            }
            // Clean up VTT tags like <i> or <c.color>
            subtitleText = subtitleText.replace(/<[^>]*>/g, '').trim();

            if (subtitleText) {
              cues.push({ start, end, text: subtitleText });
            }
          } else {
            i++;
          }
        }
        
        setParsedCues(cues);
      } catch (e) {
        console.warn('Failed to parse subtitles', e);
        if (!isCancelled) setParsedCues([]);
      }
    };

    fetchAndParse();

    return () => {
      isCancelled = true;
    };
  }, [track]);

  return parsedCues;
}
