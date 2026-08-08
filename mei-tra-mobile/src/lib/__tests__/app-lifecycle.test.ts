import {
  getAppLifecycleSnapshot,
  subscribeAppLifecycle,
} from '@/lib/app-lifecycle';

const mockAppStateListeners: ((state: 'active' | 'background') => void)[] =
  [];
const mockNetworkListeners: ((state: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}) => void)[] = [];

jest.mock('react-native', () => ({
  AppState: {
    currentState: 'background',
    addEventListener: jest.fn(
      (_event: string, listener: (state: 'active' | 'background') => void) => {
        mockAppStateListeners.push(listener);
        return { remove: jest.fn() };
      },
    ),
  },
  Platform: { OS: 'ios' },
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(
      (listener: (state: {
        isConnected: boolean | null;
        isInternetReachable: boolean | null;
      }) => void) => {
        mockNetworkListeners.push(listener);
        return jest.fn();
      },
    ),
  },
}));

describe('app lifecycle', () => {
  it('publishes foreground and network transitions', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeAppLifecycle(listener);

    expect(getAppLifecycleSnapshot()).toEqual({
      appState: 'background',
      isOnline: true,
    });

    mockAppStateListeners[0]?.('active');
    expect(listener).toHaveBeenLastCalledWith(
      { appState: 'active', isOnline: true },
      { appState: 'background', isOnline: true },
    );

    mockNetworkListeners[0]?.({
      isConnected: false,
      isInternetReachable: false,
    });
    expect(getAppLifecycleSnapshot()).toEqual({
      appState: 'active',
      isOnline: false,
    });

    unsubscribe();
    mockAppStateListeners[0]?.('background');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
