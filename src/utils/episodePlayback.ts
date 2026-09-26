/**
 * A direct stream URL, progress value, or preheated response belongs to one
 * exact episode. Never carry those fields to another episode.
 */
export function withoutStaleEpisodePlayback(media: Record<string, any>): Record<string, any> {
  const {
    savedStreamUrl: _savedStreamUrl,
    savedStreamHeaders: _savedStreamHeaders,
    preheatedData: _preheatedData,
    progress: _progress,
    durationSeconds: _durationSeconds,
    ...identityAndMetadata
  } = media;

  return {
    ...identityAndMetadata,
    positionSeconds: 0,
  };
}

/** Returns a player-synchronised countdown only inside the final window. */
export function getNextEpisodeCountdownSeconds(
  currentTime: number,
  duration: number,
  windowSeconds = 10
): number | null {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return null;
  const remaining = duration - currentTime;
  if (remaining <= 0 || remaining > windowSeconds) return null;
  return Math.max(1, Math.ceil(remaining));
}
