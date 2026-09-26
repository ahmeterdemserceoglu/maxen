import type { TvRemoteAction } from '@/services/tvRemotePlayService';

export const REMOTE_ACTION_REPLAY_GRACE_MS = 1500;

export function isFreshTvRemoteAction(
  action: TvRemoteAction | undefined,
  lastActionId: string | undefined,
  subscribedAt: number
): action is TvRemoteAction {
  if (!action?.actionId || !action.type) return false;
  if (action.actionId === lastActionId) return false;
  if (!Number.isFinite(action.requestedAt)) return false;
  return action.requestedAt >= subscribedAt - REMOTE_ACTION_REPLAY_GRACE_MS;
}
