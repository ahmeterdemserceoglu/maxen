export const RESOLVER_PROVIDERS = [
  {
    name: 'VidLink',
    getUrl: (id: string, isTv: boolean, s: number, e: number) =>
      isTv
        ? `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=e50914&autoplay=true`
        : `https://vidlink.pro/movie/${id}?primaryColor=e50914&autoplay=true`,
  },
  {
    name: 'Videasy',
    getUrl: (id: string, isTv: boolean, s: number, e: number) =>
      isTv
        ? `https://player.videasy.net/tv/${id}/${s}/${e}`
        : `https://player.videasy.net/movie/${id}`,
  },
  {
    name: 'Rivestream',
    getUrl: (id: string, isTv: boolean, s: number, e: number) =>
      isTv
        ? `https://rivestream.live/embed?type=series&id=${id}&season=${s}&episode=${e}`
        : `https://rivestream.live/embed?type=movie&id=${id}`,
  },
  {
    name: 'AnyEmbed',
    getUrl: (id: string, isTv: boolean, s: number, e: number) =>
      isTv
        ? `https://anyembed.xyz/embed/tv/${id}/${s}/${e}`
        : `https://anyembed.xyz/embed/movie/${id}`,
  },
  {
    name: 'Vidsrc.to',
    getUrl: (id: string, isTv: boolean, s: number, e: number) =>
      isTv
        ? `https://vidsrc.to/embed/tv/${id}/${s}/${e}`
        : `https://vidsrc.to/embed/movie/${id}`,
  },
  {
    name: 'Vidsrc.net',
    getUrl: (id: string, isTv: boolean, s: number, e: number) =>
      isTv
        ? `https://vidsrc.net/embed/tv/${id}/${s}/${e}`
        : `https://vidsrc.net/embed/movie/${id}`,
  },
  {
    name: 'Vidsrc.icu',
    getUrl: (id: string, isTv: boolean, s: number, e: number) =>
      isTv
        ? `https://vidsrc.icu/embed/tv/${id}/${s}/${e}`
        : `https://vidsrc.icu/embed/movie/${id}`,
  },
  {
    name: 'VidSrc.pro',
    getUrl: (id: string, isTv: boolean, s: number, e: number) =>
      isTv
        ? `https://vidsrc.pro/embed/tv/${id}/${s}/${e}`
        : `https://vidsrc.pro/embed/movie/${id}`,
  },
  {
    name: 'VidSrc.in',
    getUrl: (id: string, isTv: boolean, s: number, e: number) =>
      isTv
        ? `https://vidsrc.in/embed/tv/${id}/${s}/${e}`
        : `https://vidsrc.in/embed/movie/${id}`,
  },
  {
    name: 'VidSrc.xyz',
    getUrl: (id: string, isTv: boolean, s: number, e: number) =>
      isTv
        ? `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${s}&episode=${e}`
        : `https://vidsrc.xyz/embed/movie?tmdb=${id}`,
  },
  {
    name: 'VidSrc.vip',
    getUrl: (id: string, isTv: boolean, s: number, e: number) =>
      isTv
        ? `https://vidsrc.vip/embed/tv/${id}/${s}/${e}`
        : `https://vidsrc.vip/embed/movie/${id}`,
  },
  {
    name: 'AutoEmbed',
    getUrl: (id: string, isTv: boolean, s: number, e: number) =>
      isTv
        ? `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`
        : `https://player.autoembed.cc/embed/movie/${id}`,
  },
  {
    name: 'MoviesAPI',
    getUrl: (id: string, isTv: boolean, s: number, e: number) =>
      isTv
        ? `https://moviesapi.club/tv/${id}-${s}-${e}`
        : `https://moviesapi.club/movie/${id}`,
  },
  {
    name: 'SmashyStream',
    getUrl: (id: string, isTv: boolean, s: number, e: number) =>
      isTv
        ? `https://embed.smashystream.com/playere.php?tmdb=${id}&season=${s}&episode=${e}`
        : `https://embed.smashystream.com/playere.php?tmdb=${id}`,
  },
  {
    name: 'VidFast',
    getUrl: (id: string, isTv: boolean, s: number, e: number) =>
      isTv
        ? `https://vidfast.pro/embed/tv/${id}/${s}/${e}`
        : `https://vidfast.pro/embed/movie/${id}`,
  },
];

export function normalizeLang(lang: string): string {
  const l = lang.trim().toLowerCase();
  if (!l) return lang;

  const langDatabase: Record<string, string> = {
    'tr': 'Türkçe', 'tur': 'Türkçe', 'turkish': 'Türkçe',
    'en': 'English', 'eng': 'English', 'english': 'English',
    'de': 'Deutsch', 'ger': 'Deutsch', 'deu': 'Deutsch', 'german': 'Deutsch',
    'fr': 'Français', 'fre': 'Français', 'fra': 'Français', 'french': 'Français',
    'es': 'Español', 'spa': 'Español', 'spanish': 'Español',
    'it': 'Italiano', 'ita': 'Italiano', 'italian': 'Italiano',
    'ru': 'Русский', 'rus': 'Русский', 'russian': 'Русский',
    'pt': 'Português', 'por': 'Português', 'pob': 'Português (BR)', 'portuguese': 'Português',
    'zh': '中文', 'chi': '中文', 'zho': '中文', 'chinese': '中文', 'cmn': '中文 (Mandarin)',
    'ja': '日本語', 'jpn': '日本語', 'japanese': '日本語',
    'ko': '한국어', 'kor': '한국어', 'korean': '한국어',
    'ar': 'العربية', 'ara': 'العربية', 'arabic': 'العربية',
    'hi': 'हिन्दी', 'hin': 'हिन्दी', 'hindi': 'हिन्दी',
    'cs': 'Čeština', 'cze': 'Čeština', 'ces': 'Čeština', 'czech': 'Čeština',
    'da': 'Dansk', 'dan': 'Dansk', 'danish': 'Dansk',
    'el': 'Ελληνικά', 'gre': 'Ελληνικά', 'ell': 'Ελληνικά', 'greek': 'Ελληνικά',
    'fi': 'Suomi', 'fin': 'Suomi', 'finnish': 'Suomi',
    'he': 'עברית', 'heb': 'עברית', 'hebrew': 'עברית',
    'id': 'Bahasa Indonesia', 'ind': 'Bahasa Indonesia', 'indonesian': 'Bahasa Indonesia',
    'no': 'Norsk', 'nob': 'Norsk Bokmål', 'nor': 'Norsk', 'norwegian': 'Norsk',
    'nl': 'Nederlands', 'dut': 'Nederlands', 'nld': 'Nederlands', 'dutch': 'Nederlands',
    'pl': 'Polski', 'pol': 'Polski', 'polish': 'Polski',
    'ro': 'Română', 'rum': 'Română', 'ron': 'Română', 'romanian': 'Română',
    'sv': 'Svenska', 'swe': 'Svenska', 'swee': 'Svenska', 'swedish': 'Svenska',
    'th': 'ไทย', 'tha': 'ไทย', 'thai': 'ไทย',
    'vi': 'Tiếng Việt', 'vie': 'Tiếng Việt', 'vietnamese': 'Tiếng Việt',
    'af': 'Afrikaans', 'afr': 'Afrikaans',
    'bg': 'Български', 'bul': 'Български', 'bulgarian': 'Български',
    'hr': 'Hrvatski', 'hrv': 'Hrvatski', 'croatian': 'Hrvatski',
    'hu': 'Magyar', 'hun': 'Magyar', 'hungarian': 'Magyar',
    'sk': 'Slovenčina', 'slk': 'Slovenčina', 'slovak': 'Slovenčina',
    'sl': 'Slovenščina', 'slv': 'Slovenščina', 'slovenian': 'Slovenščina',
    'sr': 'Српски', 'srp': 'Српски', 'serbian': 'Српски',
    'uk': 'Українська', 'ukr': 'Українська', 'ukrainian': 'Українська',
  };

  return langDatabase[l] || lang;
}

export function timeToSeconds(timeStr: string) {
  const parts = timeStr.split(':');
  if (parts.length === 3) {
    const h = parseFloat(parts[0]);
    const m = parseFloat(parts[1]);
    const s = parseFloat(parts[2].replace(',', '.'));
    return h * 3600 + m * 60 + s;
  } else if (parts.length === 2) {
    const m = parseFloat(parts[0]);
    const s = parseFloat(parts[1].replace(',', '.'));
    return m * 60 + s;
  }
  return 0;
}

export function parseSubtitles(text: string) {
  const isVtt = text.trim().startsWith('WEBVTT');
  const blocks = text.split(/\n\s*\n/);
  const cues: any[] = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    let timeLineIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timeLineIndex = i;
        break;
      }
    }

    if (timeLineIndex !== -1) {
      const timeLine = lines[timeLineIndex];
      const parts = timeLine.split('-->');
      if (parts.length === 2) {
        const start = timeToSeconds(parts[0]);
        const end = timeToSeconds(parts[1]);

        const textLines = lines.slice(timeLineIndex + 1);
        const subText = textLines
          .join('\n')
          .replace(/<[^>]*>/g, '')
          .replace(/\{[^}]*\}/g, '')
          .trim();

        if (subText && !isNaN(start) && !isNaN(end) && end > start) {
          cues.push({ text: subText, start, end });
        }
      }
    }
  }
  return cues;
}


export async function isProviderAlive(providerUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s timeout
    const res = await fetch(providerUrl, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeoutId);
    return res.status >= 200 && res.status < 400;
  } catch (e) {
    return false;
  }
}

export * from './services/StreamPreheater';

