import type { UseUpdatesReturnType } from 'expo-updates';

export const OTA_CHECK_TIMEOUT_MS = 8000;
export const OTA_DOWNLOAD_TIMEOUT_MS = 60000;

export type LaunchBundleStatus = 'checking' | 'downloading' | 'restart' | 'continue';

type StartupState = Pick<
  UseUpdatesReturnType,
  'isStartupProcedureRunning' | 'isDownloading' | 'isUpdatePending' | 'restartCount'
>;

/**
 * Reads expo-updates' own launch check instead of starting a second one, which
 * the native queue would only run after it. A restart already happened when
 * `restartCount` is non-zero, so a still-pending update is left for the next
 * launch rather than retried in a loop.
 */
export function getLaunchBundleStatus(
  state: StartupState,
  updatesEnabled: boolean,
): LaunchBundleStatus {
  if (!updatesEnabled) return 'continue';
  if (state.isUpdatePending) return state.restartCount === 0 ? 'restart' : 'continue';
  if (!state.isStartupProcedureRunning) return 'continue';
  return state.isDownloading ? 'downloading' : 'checking';
}
