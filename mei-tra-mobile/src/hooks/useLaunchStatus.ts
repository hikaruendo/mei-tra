import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { subscribeAppLifecycle } from '@/lib/app-lifecycle';
import {
  checkStoreVersion,
  getStoreUrl,
  type StorePlatform,
  type StoreVersionCheck,
} from '@/lib/app-version';
import {
  getLaunchBundleStatus,
  OTA_CHECK_TIMEOUT_MS,
  OTA_DOWNLOAD_TIMEOUT_MS,
} from '@/lib/ota-update';

export type LaunchStatus =
  | { kind: 'checking' }
  | { kind: 'downloading'; progress: number }
  | { kind: 'store-update'; store: StorePlatform; storeUrl: string | null }
  | { kind: 'ready' };

const storePlatform: StorePlatform | null =
  Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null;

/**
 * The launch sequence: block an outdated binary, then wait for expo-updates'
 * launch download and restart into it. The OTA step runs once per cold start;
 * a return to the foreground only re-checks the store version, so a game in
 * progress is never restarted.
 */
export function useLaunchStatus(): LaunchStatus {
  const [storeCheck, setStoreCheck] = useState<StoreVersionCheck | 'pending'>(
    storePlatform ? 'pending' : 'current',
  );
  const [bundleSettled, setBundleSettled] = useState(!storePlatform);
  const updates = Updates.useUpdates();
  const bundle = getLaunchBundleStatus(updates, Updates.isEnabled);

  useEffect(() => {
    if (!storePlatform) return;
    const platform = storePlatform;
    let active = true;
    let latestCheck = 0;

    const recheckStoreVersion = async (isColdStart: boolean) => {
      const checkId = ++latestCheck;
      const result = await checkStoreVersion(platform);
      if (!active || checkId !== latestCheck) return;
      // An unreadable minimum lets a cold start through, but never lifts a
      // block already shown: going offline must not unlock an outdated build.
      setStoreCheck((previous) =>
        result !== 'unknown' ? result : isColdStart ? 'unknown' : previous,
      );
    };

    void recheckStoreVersion(true);
    const unsubscribe = subscribeAppLifecycle((snapshot, previous) => {
      if (snapshot.appState === 'active' && previous.appState !== 'active') {
        void recheckStoreVersion(false);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (bundleSettled) return;
    if (bundle === 'continue') {
      setBundleSettled(true);
      return;
    }
    if (bundle === 'restart') {
      Updates.reloadAsync().catch((error: unknown) => {
        console.warn('[Updates] Restart into the new bundle failed:', error);
        setBundleSettled(true);
      });
      return;
    }
    // Past the limit, the download carries on natively and applies next launch.
    const timer = setTimeout(
      () => setBundleSettled(true),
      bundle === 'downloading' ? OTA_DOWNLOAD_TIMEOUT_MS : OTA_CHECK_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [bundle, bundleSettled]);

  if (storeCheck === 'outdated' && storePlatform) {
    return {
      kind: 'store-update',
      store: storePlatform,
      storeUrl: getStoreUrl(storePlatform),
    };
  }
  if (storeCheck === 'pending') return { kind: 'checking' };
  if (!bundleSettled) {
    return bundle === 'checking'
      ? { kind: 'checking' }
      : { kind: 'downloading', progress: Math.round((updates.downloadProgress ?? 0) * 100) };
  }
  return { kind: 'ready' };
}
