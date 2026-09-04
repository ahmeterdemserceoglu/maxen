import { useEffect } from 'react';
import { DeviceEventEmitter, Platform } from 'react-native';

export type TVKeyEventType =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'select'
  | 'playPause'
  | 'play'
  | 'pause'
  | 'fastForward'
  | 'rewind'
  | 'channelUp'
  | 'channelDown'
  | 'menu'
  | 'info';

export interface TVKeyEventPayload {
  eventType: TVKeyEventType;
  keyCode: number;
  action: number;
}

/**
 * Android TV fiziksel uzaktan kumanda ve medya tuşlarını dinleyen hook.
 * Native MainActivity.kt tarafından emit edilen 'TVKeyEvent' olaylarını yakalar.
 */
export function useTVKeyEvent(handler: (event: TVKeyEventPayload) => void, enabled: boolean = true) {
  useEffect(() => {
    if (!Platform.isTV && Platform.OS !== 'android') return;
    if (!enabled) return;

    const sub = DeviceEventEmitter.addListener('TVKeyEvent', (evt: TVKeyEventPayload) => {
      if (evt && evt.eventType) {
        handler(evt);
      }
    });

    return () => {
      sub.remove();
    };
  }, [handler, enabled]);
}
