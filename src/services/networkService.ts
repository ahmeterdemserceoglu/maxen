import { AppState, AppStateStatus, Platform } from 'react-native';

type NetworkListener = (isOnline: boolean) => void;

class NetworkService {
  private isOnline: boolean = true;
  private listeners: Set<NetworkListener> = new Set();
  private checkInterval: any = null;
  private currentCheckPromise: Promise<boolean> | null = null;

  constructor() {
    this.init();
  }

  private init() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      window.addEventListener('online', () => {
        this.updateStatus(true);
      });
      window.addEventListener('offline', () => {
        this.updateStatus(false);
      });
    }

    this.checkConnectivity();

    AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        this.checkConnectivity();
      }
    });

    this.startPolling();
  }

  private startPolling() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.checkInterval = setInterval(() => {
      this.checkConnectivity();
    }, 6000);
  }

  public destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  public async checkConnectivity(): Promise<boolean> {
    if (this.currentCheckPromise) {
      return this.currentCheckPromise;
    }

    this.currentCheckPromise = (async () => {
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          // Tarayıcı ortamında cross-origin Google generate_204 isteği CORS hatası verir.
          // Tarayıcının yerleşik navigator.onLine durumunu ve same-origin probe kontrolünü kullanıyoruz.
          if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            this.updateStatus(false);
            return false;
          }
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500);
            const res = await fetch('/favicon.png?_t=' + Date.now(), {
              method: 'HEAD',
              cache: 'no-store',
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const status = res.ok || res.status === 200 || res.status === 304;
            this.updateStatus(status);
            return status;
          } catch {
            const status = typeof navigator !== 'undefined' ? navigator.onLine : false;
            this.updateStatus(status);
            return status;
          }
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const res = await fetch('https://clients3.google.com/generate_204?_t=' + Date.now(), {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const status = res.status === 204 || res.status === 200;
        this.updateStatus(status);
        return status;
      } catch {
        this.updateStatus(false);
        return false;
      } finally {
        this.currentCheckPromise = null;
      }
    })();

    return this.currentCheckPromise;
  }

  private updateStatus(newStatus: boolean) {
    if (this.isOnline !== newStatus) {
      this.isOnline = newStatus;
      this.listeners.forEach((listener) => {
        try {
          listener(newStatus);
        } catch (e) {
          console.warn('[NetworkService] listener error:', e);
        }
      });
    }
  }

  public getStatus(): boolean {
    return this.isOnline;
  }

  public subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    listener(this.isOnline);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const networkService = new NetworkService();
