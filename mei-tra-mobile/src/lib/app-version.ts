import Constants from 'expo-constants';

import { config } from './config';

export type StorePlatform = 'ios' | 'android';

/** Numeric parts of a dotted version. Strings are parsed once, at the edge. */
export type AppVersion = readonly number[];

/** `unknown` means the minimum could not be read; callers decide whether that blocks. */
export type StoreVersionCheck = 'current' | 'outdated' | 'unknown';

const FETCH_TIMEOUT_MS = 3000;

export function parseVersion(value: unknown): AppVersion | null {
  if (typeof value !== 'string' || !/^\d+(\.\d+)*$/.test(value)) return null;
  return value.split('.').map(Number);
}

export function isOlderThan(installed: AppVersion, minimum: AppVersion): boolean {
  for (let i = 0; i < Math.max(installed.length, minimum.length); i++) {
    const diff = (installed[i] ?? 0) - (minimum[i] ?? 0);
    if (diff !== 0) return diff < 0;
  }
  return false;
}

export function getStoreUrl(platform: StorePlatform): string | null {
  if (platform === 'ios') return `https://apps.apple.com/app/id${config.appStoreId}`;
  const androidPackage = Constants.expoConfig?.android?.package;
  return androidPackage
    ? `https://play.google.com/store/apps/details?id=${androidPackage}`
    : null;
}

async function fetchMinimumVersion(platform: StorePlatform): Promise<AppVersion | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.publicWebBaseUrl}/mobile-version.json`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const body = (await response.json()) as {
      minimumVersion?: Partial<Record<StorePlatform, unknown>>;
    };
    return parseVersion(body.minimumVersion?.[platform]);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Compares this binary with the minimum published alongside the web app, which
 * is raised only once the new build is live in that platform's store.
 */
export async function checkStoreVersion(
  platform: StorePlatform,
): Promise<StoreVersionCheck> {
  // With runtimeVersion `appVersion`, every OTA bundle carries the binary's version.
  const installed = parseVersion(Constants.expoConfig?.version);
  const minimum = await fetchMinimumVersion(platform);
  if (!installed || !minimum) return 'unknown';
  return isOlderThan(installed, minimum) ? 'outdated' : 'current';
}
