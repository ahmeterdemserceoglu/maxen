import { create } from 'zustand';
import { WatchPartyRoom } from '@/services/watchPartyService';

export type TabKey = 'home' | 'media' | 'social' | 'search' | 'settings' | 'movies' | 'tv';
export type ModalSource = 'reels' | 'comingSoon' | null;

export interface DetailItem {
  id: string | number;
  type?: 'movie' | 'tv';
  [key: string]: any;
}

export interface ActorItem {
  name: string;
  tmdbId?: string | number | null;
  profileUrl?: string;
  [key: string]: any;
}

export interface UiState {
  // Navigation & Modal States
  activeTab: TabKey;
  activeDetail: DetailItem | null;
  activeActor: ActorItem | null;
  previousDetailForActor: DetailItem | null;
  activeVideo: any | null;
  isMiniPlayer: boolean;
  activeWatchParty: WatchPartyRoom | null;
  showJoinPartyModal: boolean;
  showDiscoveryHub: boolean;
  showReelsModal: boolean;
  showComingSoonModal: boolean;
  showDownloadsModal: boolean;
  showVirtualRemoteModal: boolean;
  returnToModal: ModalSource;
  pendingFriendRequestsCount: number;
  remoteActionSignal: { action: string; payload?: any; timestamp: number } | null;
  sidebarActiveNodeId: number | null;
  heroPlayBtnNodeId: number | null;
  firstRowFirstCardNodeId: number | null;

  // Basic Setters (backward compatibility)
  setSidebarActiveNodeId: (id: number | null) => void;
  setHeroPlayBtnNodeId: (id: number | null) => void;
  setFirstRowFirstCardNodeId: (id: number | null) => void;
  setActiveTab: (tab: TabKey) => void;
  setActiveDetail: (detail: DetailItem | null) => void;
  setActiveActor: (actor: ActorItem | null) => void;
  setActiveVideo: (video: any | null) => void;
  setIsMiniPlayer: (isMini: boolean) => void;
  setActiveWatchParty: (party: WatchPartyRoom | null) => void;
  setShowJoinPartyModal: (show: boolean) => void;
  setShowDiscoveryHub: (show: boolean) => void;
  setShowReelsModal: (show: boolean) => void;
  setShowComingSoonModal: (show: boolean) => void;
  setShowDownloadsModal: (show: boolean) => void;
  setShowVirtualRemoteModal: (show: boolean) => void;
  setReturnToModal: (source: ModalSource) => void;
  setPendingFriendRequestsCount: (count: number) => void;
  dispatchRemoteAction: (action: string, payload?: any) => void;

  // High-level atomic navigation actions
  openDetail: (detail: DetailItem, returnTo?: ModalSource) => void;
  closeDetail: () => void;
  openActor: (actor: ActorItem, preserveReturnTo?: boolean) => void;
  closeActor: () => void;
  openVideo: (video: any, returnTo?: ModalSource) => void;
  closeVideo: () => void;
  openWatchParty: (party: WatchPartyRoom) => void;
  closeWatchParty: () => void;
  openDiscoveryHub: () => void;
  closeDiscoveryHub: () => void;
  openReels: () => void;
  closeReels: () => void;
  openComingSoon: () => void;
  closeComingSoon: () => void;
  openDownloads: () => void;
  closeDownloads: () => void;

  // Teardown & Reset
  clearModals: () => void;
  resetAllUi: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  activeTab: 'home',
  activeDetail: null,
  activeActor: null,
  previousDetailForActor: null,
  activeVideo: null,
  isMiniPlayer: false,
  activeWatchParty: null,
  showJoinPartyModal: false,
  showDiscoveryHub: false,
  showReelsModal: false,
  showComingSoonModal: false,
  showDownloadsModal: false,
  showVirtualRemoteModal: false,
  returnToModal: null,
  pendingFriendRequestsCount: 0,
  remoteActionSignal: null,
  sidebarActiveNodeId: null,
  heroPlayBtnNodeId: null,
  firstRowFirstCardNodeId: null,

  setSidebarActiveNodeId: (sidebarActiveNodeId) => set({ sidebarActiveNodeId }),
  setHeroPlayBtnNodeId: (heroPlayBtnNodeId) => set({ heroPlayBtnNodeId }),
  setFirstRowFirstCardNodeId: (firstRowFirstCardNodeId) => set({ firstRowFirstCardNodeId }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setActiveDetail: (activeDetail) => set({ activeDetail }),
  setActiveActor: (activeActor) => set({ activeActor }),
  setActiveVideo: (activeVideo) => set({ activeVideo }),
  setIsMiniPlayer: (isMiniPlayer) => set({ isMiniPlayer }),
  setActiveWatchParty: (activeWatchParty) => set({ activeWatchParty }),
  setShowJoinPartyModal: (showJoinPartyModal) => set({ showJoinPartyModal }),
  setShowDiscoveryHub: (showDiscoveryHub) => set({ showDiscoveryHub }),
  setShowReelsModal: (showReelsModal) => set({ showReelsModal }),
  setShowComingSoonModal: (showComingSoonModal) => set({ showComingSoonModal }),
  setShowDownloadsModal: (showDownloadsModal) => set({ showDownloadsModal }),
  setShowVirtualRemoteModal: (showVirtualRemoteModal) => set({ showVirtualRemoteModal }),
  setReturnToModal: (returnToModal) => set({ returnToModal }),
  setPendingFriendRequestsCount: (pendingFriendRequestsCount) => set({ pendingFriendRequestsCount }),
  dispatchRemoteAction: (action, payload) =>
    set({ remoteActionSignal: { action, payload, timestamp: Date.now() } }),

  openDetail: (detail, returnTo) => {
    set((state) => ({
      activeDetail: detail,
      activeActor: null,
      previousDetailForActor: null,
      returnToModal: returnTo !== undefined ? returnTo : state.returnToModal,
    }));
  },

  closeDetail: () => {
    const { returnToModal } = get();
    set({
      activeDetail: null,
      showReelsModal: returnToModal === 'reels',
      showComingSoonModal: returnToModal === 'comingSoon',
      returnToModal: null,
    });
  },

  openActor: (actor, preserveReturnTo = true) => {
    set((state) => ({
      activeActor: actor,
      previousDetailForActor: state.activeDetail || state.previousDetailForActor || null,
      activeDetail: null,
      returnToModal: preserveReturnTo ? state.returnToModal : null,
    }));
  },

  closeActor: () => {
    const { returnToModal, previousDetailForActor } = get();
    set({
      activeActor: null,
      activeDetail: previousDetailForActor || null,
      previousDetailForActor: null,
      showReelsModal: returnToModal === 'reels',
      showComingSoonModal: returnToModal === 'comingSoon',
      returnToModal: null,
    });
  },

  openVideo: (video, returnTo) => {
    set((state) => ({
      activeVideo: video,
      isMiniPlayer: false,
      activeDetail: null,
      returnToModal: returnTo !== undefined ? returnTo : state.returnToModal,
    }));
  },

  closeVideo: () => {
    const { returnToModal } = get();
    set({
      activeVideo: null,
      isMiniPlayer: false,
      activeWatchParty: null,
      showReelsModal: returnToModal === 'reels',
      showComingSoonModal: returnToModal === 'comingSoon',
      returnToModal: null,
    });
  },

  openWatchParty: (party) => {
    set({
      activeWatchParty: party,
      activeVideo: party.media,
      activeDetail: null,
    });
  },

  closeWatchParty: () => {
    set({
      activeWatchParty: null,
      activeVideo: null,
    });
  },

  openDiscoveryHub: () => set({ showDiscoveryHub: true }),
  closeDiscoveryHub: () => set({ showDiscoveryHub: false }),

  openReels: () => set({
    showReelsModal: true,
    showComingSoonModal: false,
    showDiscoveryHub: false,
  }),
  closeReels: () => set({ showReelsModal: false }),

  openComingSoon: () => set({
    showComingSoonModal: true,
    showReelsModal: false,
    showDiscoveryHub: false,
    showDownloadsModal: false,
  }),
  closeComingSoon: () => set({ showComingSoonModal: false }),

  openDownloads: () => set({
    showDownloadsModal: true,
    showComingSoonModal: false,
    showReelsModal: false,
    showDiscoveryHub: false,
  }),
  closeDownloads: () => set({ showDownloadsModal: false }),

  clearModals: () => set({
    activeDetail: null,
    activeActor: null,
    activeVideo: null,
    activeWatchParty: null,
    showJoinPartyModal: false,
    showDiscoveryHub: false,
    showReelsModal: false,
    showComingSoonModal: false,
    showDownloadsModal: false,
    returnToModal: null,
  }),

  resetAllUi: () => set({
    activeTab: 'home',
    activeDetail: null,
    activeActor: null,
    activeVideo: null,
    activeWatchParty: null,
    showJoinPartyModal: false,
    showDiscoveryHub: false,
    showReelsModal: false,
    showComingSoonModal: false,
    showDownloadsModal: false,
    returnToModal: null,
    remoteActionSignal: null,
  }),
}));
