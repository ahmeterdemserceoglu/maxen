export interface UserProfileDoc {
  uid: string;
  username: string; // e.g. "ahmet"
  displayName: string;
  email: string;
  avatarColor?: string;
  hidePresence?: boolean;
  createdAt: number;
}

export interface UserPresence {
  uid: string;
  username: string;
  displayName: string;
  status: 'online' | 'watching' | 'offline';
  media?: {
    id: string | number;
    tmdbId?: string;
    title: string;
    type: 'movie' | 'tv';
    posterUrl?: string | null;
    seasonNum?: number;
    episodeNum?: number;
  } | null;
  lastSeen: number;
}

export type FriendStatus = 'pending_sent' | 'pending_received' | 'accepted';

export interface FriendRelation {
  friendUid: string;
  friendUsername: string;
  friendDisplayName: string;
  status: FriendStatus;
  updatedAt: number;
}

export interface WatchPartyInvite {
  id: string;
  senderUid: string;
  senderUsername: string;
  senderDisplayName: string;
  roomCode: string;
  media: any;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}

export interface UsernameAvailabilityResult {
  available: boolean;
  reason?: string;
}
