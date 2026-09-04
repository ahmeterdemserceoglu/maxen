export function progressKey(profileId: string): string {
  return `MAXEN_LOCAL_PROGRESS_${profileId}`;
}

export function searchHistoryKey(profileId: string): string {
  return `@maxen_search_history_${profileId}`;
}

export function activeProfileKey(userId: string): string {
  return `@maxen_active_profile_${userId}`;
}
