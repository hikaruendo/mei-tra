import 'react-native-url-polyfill/auto';

import { Platform } from 'react-native';
import { createClient, processLock } from '@supabase/supabase-js';

import {
  getAppLifecycleSnapshot,
  subscribeAppLifecycle,
} from '@/lib/app-lifecycle';
import {
  clearPersistedAuthSession,
  SUPABASE_AUTH_STORAGE_KEY,
} from '@/lib/auth-session';
import { config } from '@/lib/config';
import { secureStorage } from '@/lib/secure-storage';

export const supabase = createClient(
  config.supabaseUrl,
  config.supabasePublishableKey,
  {
    auth: {
      ...(Platform.OS === 'web' ? {} : { storage: secureStorage }),
      storageKey: SUPABASE_AUTH_STORAGE_KEY,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  },
);

const removeAuthStorageItem = async (key: string): Promise<void> => {
  if (Platform.OS === 'web') {
    if (typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.removeItem(key);
    }
    return;
  }

  await secureStorage.removeItem(key);
};

export const clearLocalAuthSession = async (): Promise<void> => {
  await clearPersistedAuthSession({ removeItem: removeAuthStorageItem });
};

if (Platform.OS !== 'web') {
  const syncAutoRefresh = ({ appState, isOnline }: ReturnType<typeof getAppLifecycleSnapshot>) => {
    if (appState === 'active' && isOnline) {
      supabase.auth.startAutoRefresh();
      return;
    }

    supabase.auth.stopAutoRefresh();
  };

  syncAutoRefresh(getAppLifecycleSnapshot());
  subscribeAppLifecycle(syncAutoRefresh);
}
