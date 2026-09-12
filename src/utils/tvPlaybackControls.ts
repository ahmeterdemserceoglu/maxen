export type TVPlaybackIntent = 'reveal' | 'rewind' | 'forward' | 'toggle' | 'play' | 'pause' | 'settings' | 'episodes' | 'next' | 'info' | null;

/** D-pad belongs to focused controls whenever a menu or the control bar is visible. */
export function getTVPlaybackIntent(key: string, state: { controlsVisible: boolean; menuOpen: boolean; isMovie: boolean }): TVPlaybackIntent {
  if (state.menuOpen) return null;
  if (key === 'playPause') return 'toggle';
  if (key === 'play' || key === 'pause' || key === 'info') return key;
  if (key === 'fastForward') return 'forward';
  if (key === 'rewind') return 'rewind';
  if (key === 'menu') return 'settings';
  if (state.controlsVisible) return null;
  if (['left', 'right', 'up', 'down', 'select'].includes(key)) return 'reveal';
  return null;
}
