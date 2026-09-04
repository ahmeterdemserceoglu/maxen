export interface MediaMetadata {
  title: string;
  artist?: string;
  seriesTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  artworkUrl?: string | null;
  durationSeconds: number;
  currentPositionSeconds: number;
  isPlaying: boolean;
  partyCode?: string | null;
  partyViewerCount?: number;
}

export class MediaSessionService {
  private currentMetadata: MediaMetadata | null = null;
  private listeners = new Set<(meta: MediaMetadata | null) => void>();

  updateSession(metadata: Partial<MediaMetadata>) {
    if (!this.currentMetadata && metadata.title) {
      this.currentMetadata = {
        title: metadata.title,
        durationSeconds: metadata.durationSeconds || 0,
        currentPositionSeconds: metadata.currentPositionSeconds || 0,
        isPlaying: metadata.isPlaying ?? true,
        ...metadata,
      } as MediaMetadata;
    } else if (this.currentMetadata) {
      this.currentMetadata = {
        ...this.currentMetadata,
        ...metadata,
      };
    }
    this.notifyListeners();
  }

  clearSession() {
    this.currentMetadata = null;
    this.notifyListeners();
  }

  getSession(): MediaMetadata | null {
    return this.currentMetadata;
  }

  subscribe(listener: (meta: MediaMetadata | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentMetadata);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => {
      try {
        fn(this.currentMetadata);
      } catch (e) {
        console.warn('[MediaSessionService] Listener error:', e);
      }
    });
  }
}

export const mediaSessionService = new MediaSessionService();
