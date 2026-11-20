import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';

const CHECK_TIMEOUT_MS = 8000;
const DOWNLOAD_TIMEOUT_MS = 60000;
const ATTEMPTED_KEY = 'meitra.ota.attempted-update';

export type OtaResult = 'up-to-date' | 'reloading';

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);

/**
 * Downloads a newer OTA bundle and restarts into it, so the top screen always
 * opens on the latest JavaScript. Any failure or timeout lets the current
 * bundle run: a slow network must not keep anyone out of the app.
 */
export async function installLatestBundle(
  onDownloadStart: () => void,
): Promise<OtaResult> {
  if (!Updates.isEnabled) return 'up-to-date';

  try {
    const check = await withTimeout(Updates.checkForUpdateAsync(), CHECK_TIMEOUT_MS);
    if (!check || (!check.isAvailable && !check.isRollBackToEmbedded)) {
      return 'up-to-date';
    }

    // If restarting into this update already failed once, it would only fail
    // again in a loop; carry on with the bundle that is running.
    const target = check.manifest?.id ?? 'rollback';
    if ((await AsyncStorage.getItem(ATTEMPTED_KEY).catch(() => null)) === target) {
      return 'up-to-date';
    }

    onDownloadStart();
    const fetched = await withTimeout(Updates.fetchUpdateAsync(), DOWNLOAD_TIMEOUT_MS);
    if (!fetched) return 'up-to-date';

    await AsyncStorage.setItem(ATTEMPTED_KEY, target).catch(() => undefined);
    await Updates.reloadAsync();
    return 'reloading';
  } catch (error) {
    console.warn('[Updates] Launch update failed:', error);
    return 'up-to-date';
  }
}
