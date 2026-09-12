import { Platform, findNodeHandle } from 'react-native';

/**
 * Safely resolves a native TV node handle for D-pad directional navigation.
 * On web or non-TV platforms, findNodeHandle is not supported and throws;
 * this function returns undefined safely without crashing React render.
 */
export function getTVNodeHandle(componentOrRef: any): number | undefined {
  if (Platform.OS === 'web' || !Platform.isTV || !componentOrRef) {
    return undefined;
  }
  try {
    const target = componentOrRef?.current ?? componentOrRef;
    if (!target) return undefined;
    const id = findNodeHandle(target);
    return typeof id === 'number' && id > 0 ? id : undefined;
  } catch {
    return undefined;
  }
}

/** Host View.focus() is a text-input command; TV controls need the TV command. */
export function requestTVFocus(componentOrRef: any): void {
  const target = componentOrRef?.current ?? componentOrRef;
  if (!target) return;
  if (Platform.isTV) target.requestTVFocus?.();
  else target.focus?.();
}
