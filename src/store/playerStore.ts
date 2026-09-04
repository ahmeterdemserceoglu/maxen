import { create } from 'zustand';

export interface SubtitleTrack {
  label: string;
  lang: string;
  url: string;
  content?: string;
  fileId?: number;
}

export interface EmbedProvider {
  name: string;
  getUrl: (id: string, isTv: boolean, s: number, e: number) => string;
}

interface PlayerState {
  status: 'idle' | 'resolving' | 'playing' | 'error';
  streamSource: 'hls' | 'embed' | null;
  currentEmbedProvider: string | null;
  subtitleTrack: SubtitleTrack | null;
  subtitleOffset: number; // in milliseconds
  progress: number;
  duration: number;
  streamUrl: string | null;
  resolving: boolean;
  isSeeking: boolean;
  subtitles: SubtitleTrack[];
  
  // Actions
  setStatus: (status: PlayerState['status']) => void;
  setStreamSource: (source: PlayerState['streamSource']) => void;
  setCurrentEmbedProvider: (provider: string | null) => void;
  setSubtitleTrack: (track: SubtitleTrack | null) => void;
  setSubtitleOffset: (offset: number) => void;
  updateProgress: (positionSeconds: number, durationSeconds: number) => void;
  setStreamUrl: (url: string | null) => void;
  setResolving: (resolving: boolean) => void;
  setIsSeeking: (isSeeking: boolean) => void;
  setSubtitles: (subtitles: SubtitleTrack[]) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>()((set) => ({
  status: 'idle',
  streamSource: null,
  currentEmbedProvider: null,
  subtitleTrack: null,
  subtitleOffset: 0,
  progress: 0,
  duration: 0,
  streamUrl: null,
  resolving: false,
  isSeeking: false,
  subtitles: [],

  setStatus: (status) => set({ status }),
  setStreamSource: (streamSource) => set({ streamSource }),
  setCurrentEmbedProvider: (currentEmbedProvider) => set({ currentEmbedProvider }),
  setSubtitleTrack: (subtitleTrack) => set({ subtitleTrack }),
  setSubtitleOffset: (subtitleOffset) => set({ subtitleOffset }),
  updateProgress: (progress, duration) => set({ progress, duration }),
  setStreamUrl: (streamUrl) => set({ streamUrl }),
  setResolving: (resolving) => set({ resolving }),
  setIsSeeking: (isSeeking) => set({ isSeeking }),
  setSubtitles: (subtitles) => set({ subtitles }),
  reset: () => set({
    status: 'idle',
    streamSource: null,
    currentEmbedProvider: null,
    subtitleTrack: null,
    subtitleOffset: 0,
    progress: 0,
    duration: 0,
    streamUrl: null,
    resolving: false,
    isSeeking: false,
    subtitles: [],
  }),
}));
