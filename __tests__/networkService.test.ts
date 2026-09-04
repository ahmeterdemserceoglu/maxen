import { networkService } from '../src/services/networkService';

describe('NetworkService & Offline Mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    networkService.destroy();
  });

  test('networkService initializes and reports status', () => {
    const status = networkService.getStatus();
    expect(typeof status).toBe('boolean');
  });

  test('networkService subscribe receives current status', () => {
    const listener = jest.fn();
    const unsub = networkService.subscribe(listener);

    expect(listener).toHaveBeenCalled();
    expect(typeof listener.mock.calls[0][0]).toBe('boolean');

    unsub();
  });

  test('networkService checkConnectivity returns boolean', async () => {
    // Mock global fetch for testing
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      status: 204,
    } as any);

    const isOnline = await networkService.checkConnectivity();
    expect(isOnline).toBe(true);

    // Mock fetch error (offline / airplane mode)
    global.fetch = jest.fn().mockRejectedValue(new Error('Network request failed'));
    const isOffline = await networkService.checkConnectivity();
    expect(isOffline).toBe(false);

    global.fetch = originalFetch;
  });
});
