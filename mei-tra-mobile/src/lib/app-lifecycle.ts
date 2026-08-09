import NetInfo from '@react-native-community/netinfo';
import { AppState, Platform, type AppStateStatus } from 'react-native';

export interface AppLifecycleSnapshot {
  appState: AppStateStatus;
  isOnline: boolean;
}

export type AppLifecycleListener = (
  snapshot: AppLifecycleSnapshot,
  previous: AppLifecycleSnapshot,
) => void;

const listeners = new Set<AppLifecycleListener>();
let initialized = false;
let snapshot: AppLifecycleSnapshot = {
  appState: AppState.currentState ?? 'active',
  isOnline: true,
};

const notify = (next: Partial<AppLifecycleSnapshot>) => {
  const previous = snapshot;
  const nextSnapshot = { ...snapshot, ...next };
  if (
    nextSnapshot.appState === previous.appState &&
    nextSnapshot.isOnline === previous.isOnline
  ) {
    return;
  }

  snapshot = nextSnapshot;
  listeners.forEach((listener) => listener(snapshot, previous));
};

const initialize = () => {
  if (initialized) return;
  initialized = true;

  AppState.addEventListener('change', (appState) => {
    notify({ appState });
  });

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;

    notify({ isOnline: window.navigator.onLine });
    window.addEventListener('online', () => notify({ isOnline: true }));
    window.addEventListener('offline', () => notify({ isOnline: false }));
    return;
  }

  NetInfo.addEventListener((state) => {
    notify({
      isOnline:
        state.isConnected === true && state.isInternetReachable !== false,
    });
  });
};

export const getAppLifecycleSnapshot = (): AppLifecycleSnapshot => {
  initialize();
  return snapshot;
};

export const subscribeAppLifecycle = (
  listener: AppLifecycleListener,
): (() => void) => {
  initialize();
  listeners.add(listener);
  return () => listeners.delete(listener);
};
