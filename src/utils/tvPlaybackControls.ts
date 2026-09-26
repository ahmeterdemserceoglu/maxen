export type TVPlaybackIntent = 'reveal' | 'rewind' | 'forward' | 'toggle' | 'play' | 'pause' | 'settings' | 'episodes' | 'next' | 'info' | null;

export type TVPlaybackState = {
  controlsVisible: boolean;
  menuOpen: boolean;
  isMovie: boolean;
  timelineFocused: boolean;
};

/** Directional seeking belongs exclusively to the focused timeline. */
export function getTVPlaybackIntent(key: string, state: TVPlaybackState): TVPlaybackIntent {
  if (state.menuOpen) return null;
  if (key === 'playPause') return 'toggle';
  if (key === 'play' || key === 'pause' || key === 'info') return key;
  if (key === 'fastForward') return 'forward';
  if (key === 'rewind') return 'rewind';
  if (key === 'menu') return 'settings';
  if (state.timelineFocused && key === 'left') return 'rewind';
  if (state.timelineFocused && key === 'right') return 'forward';
  if (key === 'select' && (!state.controlsVisible || state.timelineFocused)) return 'toggle';
  if (state.controlsVisible) return null;
  if (['left', 'right', 'up', 'down'].includes(key)) return 'reveal';
  return null;
}

/** Holding a D-pad seek key accelerates in predictable stages. */
export function getTVSeekStepSeconds(repeatCount: number): number {
  if (repeatCount >= 24) return 60;
  if (repeatCount >= 12) return 30;
  if (repeatCount >= 5) return 20;
  return 10;
}

export function getVirtualRemotePlaybackIntent(
  action: string,
  state: TVPlaybackState,
): TVPlaybackIntent {
  if (action === 'play_pause') return 'toggle';
  if (action === 'seek_forward') return 'forward';
  if (action === 'seek_backward') return 'rewind';
  const keyMap: Record<string, string> = {
    dpad_left: 'left',
    dpad_right: 'right',
    dpad_up: 'up',
    dpad_down: 'down',
    dpad_center: 'select',
  };
  const key = keyMap[action];
  return key ? getTVPlaybackIntent(key, state) : null;
}

export type PlayerFocusTarget = 'countdown' | 'action' | 'timeline' | null;

export function getPreferredPlayerFocusTarget(state: {
  countdownVisible: boolean;
  actionVisible: boolean;
  controlsVisible: boolean;
}): PlayerFocusTarget {
  if (state.countdownVisible) return 'countdown';
  if (state.actionVisible) return 'action';
  if (state.controlsVisible) return 'timeline';
  return null;
}
