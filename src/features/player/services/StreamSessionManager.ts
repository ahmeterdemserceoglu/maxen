export interface StreamSession {
  streamUrl: string;
  provider: string;
  expiresAt: number;
  headers?: Record<string, string>;
  referer?: string;
  mediaKey?: string;
}

type EventListener = (session: StreamSession | null) => void;
type RefreshHandler = () => Promise<void>;

class StreamSessionManager {
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

  public setSession(session: StreamSession) {
    this.session = session;
    this.notifyListeners();
    this.scheduleRefresh();
  }

  public clearSession() {
    this.session = null;
    this.clearRefresh();
    this.notifyListeners();
  }
  
  public setRefreshHandler(handler: RefreshHandler) {
    this.refreshHandler = handler;
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
    if (!this.refreshHandler) {
      console.warn('[StreamSessionManager] No refresh handler attached!');
      return;
    }
    
    console.log('[StreamSessionManager] Executing background stream refresh...');
    try {
      await this.refreshHandler();
      // On success, refreshHandler should internally call setSession which handles scheduling and notifying.
    } catch (e) {
      console.error('[StreamSessionManager] Background refresh ERROR:', e);
    }
  }
}

export const streamSessionManager = StreamSessionManager.getInstance();
