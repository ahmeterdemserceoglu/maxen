import { useUiStore } from '../src/store/uiStore';

describe('UI Store & Navigation State Unit Tests', () => {
  beforeEach(() => {
    useUiStore.getState().resetAllUi();
  });

  it('should initialize with default states', () => {
    const state = useUiStore.getState();
    expect(state.activeTab).toBe('home');
    expect(state.activeDetail).toBeNull();
    expect(state.activeActor).toBeNull();
    expect(state.activeVideo).toBeNull();
    expect(state.showReelsModal).toBe(false);
    expect(state.showComingSoonModal).toBe(false);
    expect(state.showDiscoveryHub).toBe(false);
    expect(state.showJoinPartyModal).toBe(false);
    expect(state.activeWatchParty).toBeNull();
    expect(state.returnToModal).toBeNull();
  });

  it('should manage openDetail and closeDetail with origin preservation', () => {
    const store = useUiStore.getState();

    // Open detail from reels
    store.openDetail({ id: '123', type: 'movie' }, 'reels');

    let current = useUiStore.getState();
    expect(current.activeDetail).toEqual({ id: '123', type: 'movie' });
    expect(current.returnToModal).toBe('reels');
    expect(current.showReelsModal).toBe(false);

    // Close detail should restore reels modal
    store.closeDetail();

    current = useUiStore.getState();
    expect(current.activeDetail).toBeNull();
    expect(current.showReelsModal).toBe(true);
    expect(current.returnToModal).toBeNull();
  });

  it('should manage active video player lifecycle', () => {
    const store = useUiStore.getState();
    const media = { id: 999, title: 'Inception', type: 'movie' };

    store.openVideo(media, 'comingSoon');

    let current = useUiStore.getState();
    expect(current.activeVideo).toEqual(media);
    expect(current.returnToModal).toBe('comingSoon');

    store.closeVideo();

    current = useUiStore.getState();
    expect(current.activeVideo).toBeNull();
    expect(current.showComingSoonModal).toBe(true);
  });

  it('should manage Watch Party room state and modal opening', () => {
    const store = useUiStore.getState();
    const mockRoom: any = {
      code: '8X9K2P',
      hostId: 'user_123',
      hostName: 'Ahmet',
      media: { id: 550, title: 'Fight Club', type: 'movie' },
      currentTime: 120,
      isPlaying: true,
      updatedAt: Date.now(),
      participants: [{ uid: 'user_123', name: 'Ahmet', isHost: true }],
      chatMessages: [],
    };

    // Open Watch Party with room
    store.openWatchParty(mockRoom);

    let current = useUiStore.getState();
    expect(current.activeVideo).toEqual(mockRoom.media);
    expect(current.activeWatchParty).toEqual(mockRoom);

    // Test Join Party Modal toggle
    store.setShowJoinPartyModal(true);
    expect(useUiStore.getState().showJoinPartyModal).toBe(true);

    store.setShowJoinPartyModal(false);
    expect(useUiStore.getState().showJoinPartyModal).toBe(false);

    // Reset should clear watch party
    store.resetAllUi();
    expect(useUiStore.getState().activeWatchParty).toBeNull();
    expect(useUiStore.getState().showJoinPartyModal).toBe(false);
  });

  it('should clear all modals when clearModals is called', () => {
    const store = useUiStore.getState();
    store.openDetail({ id: '1', type: 'movie' });
    store.openActor({ name: 'Leonardo DiCaprio', tmdbId: '6193' });
    store.openReels();
    store.setShowJoinPartyModal(true);

    store.clearModals();

    const current = useUiStore.getState();
    expect(current.activeDetail).toBeNull();
    expect(current.activeActor).toBeNull();
    expect(current.showReelsModal).toBe(false);
    expect(current.showDiscoveryHub).toBe(false);
    expect(current.showJoinPartyModal).toBe(false);
  });

  it('should toggle isMiniPlayer state correctly', () => {
    const store = useUiStore.getState();
    expect(store.isMiniPlayer).toBe(false);

    store.setIsMiniPlayer(true);
    expect(useUiStore.getState().isMiniPlayer).toBe(true);

    store.closeVideo();
    expect(useUiStore.getState().isMiniPlayer).toBe(false);
  });

  it('should dispatch and reset remoteActionSignal correctly', () => {
    const store = useUiStore.getState();
    expect(store.remoteActionSignal).toBeNull();

    // Dispatch play_pause
    store.dispatchRemoteAction('play_pause');
    let current = useUiStore.getState();
    expect(current.remoteActionSignal).not.toBeNull();
    expect(current.remoteActionSignal?.action).toBe('play_pause');
    expect(current.remoteActionSignal?.timestamp).toBeGreaterThan(0);

    // Dispatch seek_forward with payload
    store.dispatchRemoteAction('seek_forward', { seconds: 10 });
    current = useUiStore.getState();
    expect(current.remoteActionSignal?.action).toBe('seek_forward');
    expect(current.remoteActionSignal?.payload).toEqual({ seconds: 10 });

    // Reset should clear remoteActionSignal
    store.resetAllUi();
    expect(useUiStore.getState().remoteActionSignal).toBeNull();
  });
});
