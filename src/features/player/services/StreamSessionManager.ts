export interface StreamSession {
  streamUrl: string;
  provider: string;
  expiresAt: number;
  headers?: Record<string, string>;
  referer?: string;
  mediaKey: string;
}

type EventListener = (session: StreamSession | null) => void;
type RefreshHandler = { mediaKey: string; run: () => Promise<void> };

export class StreamSessionManager {
  private session: StreamSession | null = null;
  private listeners: EventListener[] = [];
  private refreshTimeout: ReturnType<typeof setTimeout> | null = null;
  private refreshHandler: RefreshHandler | null = null;
  
  private static instance: StreamSessionManager;

  public static getInstance(): StreamSessionManager {
    if (!StreamSessionManager.instance) {
      StreamSessionManager.instance = new StreamSessionManager();
    }
    return StreamSessionManager.instance;
  }

  public getSession(): StreamSession | null {
    return this.session;
  }

  public setSession(session: StreamSession): boolean {
    if (!session.mediaKey) {
      console.warn('[StreamSessionManager] Media key olmadan stream oturumu reddedildi.');
      return false;
    }
    this.session = session;
    this.notifyListeners();
    this.scheduleRefresh();
    return true;
  }

  public clearSession(mediaKey?: string): boolean {
    if (mediaKey && this.session?.mediaKey !== mediaKey) return false;
    this.session = null;
    this.clearRefresh();
    this.notifyListeners();
    return true;
  }
  
  public setRefreshHandler(mediaKey: string, handler: () => Promise<void>) {
    this.refreshHandler = { mediaKey, run: handler };
  }

  public clearRefreshHandler(mediaKey: string): boolean {
    if (this.refreshHandler?.mediaKey !== mediaKey) return false;
    this.refreshHandler = null;
    return true;
  }

  public addListener(listener: EventListener) {
    this.listeners.push(listener);
    listener(this.session);
  }

  public removeListener(listener: EventListener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  private notifyListeners() {
    this.listeners.forEach(l => l(this.session));
  }

  private scheduleRefresh() {
    this.clearRefresh();
    if (!this.session || !this.session.expiresAt) return;

    const now = Date.now();
    const timeUntilExpiry = this.session.expiresAt - now;
    
    // Eğer süre çoktan dolduysa veya az kaldıysa
    if (timeUntilExpiry <= 0) {
      console.log('[StreamSessionManager] Token already expired.');
      this.executeRefresh();
      return;
    }

    // Süre dolmasına 5 dakika kala yenile
    const timeUntilRefresh = timeUntilExpiry - 5 * 60 * 1000;

    if (timeUntilRefresh > 0) {
      console.log(`[StreamSessionManager] Token refresh scheduled in ${Math.round(timeUntilRefresh / 1000 / 60)} minutes.`);
      this.refreshTimeout = setTimeout(() => {
        this.executeRefresh();
      }, timeUntilRefresh);
      if (typeof (this.refreshTimeout as any)?.unref === 'function') {
        (this.refreshTimeout as any).unref();
      }
    } else {
      console.log(`[StreamSessionManager] Token expires in less than 5 mins, refreshing now.`);
      this.executeRefresh();
    }
  }

  private clearRefresh() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }

  private async executeRefresh() {
    const handler = this.refreshHandler;
    const activeMediaKey = this.session?.mediaKey;
    if (!handler || !activeMediaKey || handler.mediaKey !== activeMediaKey) {
      console.warn('[StreamSessionManager] No refresh handler attached!');
      return;
    }
    
    console.log('[StreamSessionManager] Executing background stream refresh...');
    try {
      await handler.run();
      // On success, refreshHandler should internally call setSession which handles scheduling and notifying.
    } catch (e) {
      console.error('[StreamSessionManager] Background refresh ERROR:', e);
    }
  }
}

export const streamSessionManager = StreamSessionManager.getInstance();
