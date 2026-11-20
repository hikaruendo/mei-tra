import Constants from 'expo-constants';

import { config } from './config';

export type StorePlatform = 'ios' | 'android';

const VERSION_PATTERN = /^\d+(\.\d+)*$/;
const FETCH_TIMEOUT_MS = 3000;

export const storeUrls: Record<StorePlatform, string> = {
  ios: 'https://apps.apple.com/app/id6806316511',
  android: 'https://play.google.com/store/apps/details?id=com.kando1.meitra',
};

/** With runtimeVersion `appVersion`, every OTA bundle carries the binary's version. */
export function getInstalledVersion(): string | null {
  return Constants.expoConfig?.version ?? null;
}

/** False whenever either side is unreadable, so a bad value never locks anyone out. */
export function isOlderThan(installed: string, minimum: string): boolean {
  if (!VERSION_PATTERN.test(installed) || !VERSION_PATTERN.test(minimum)) {
    return false;
  }

  const a = installed.split('.').map(Number);
  const b = minimum.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff < 0;
  }
  return false;
}

/**
 * The minimum version is published with the web app, so it can be raised once
 * the new build is live in that platform's store. Returns null when it cannot
 * be read; callers let the app run rather than block on a network problem.
 */
export async function fetchMinimumVersion(
  platform: StorePlatform,
): Promise<string | null> {
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
    const minimum = body.minimumVersion?.[platform];
    return typeof minimum === 'string' && VERSION_PATTERN.test(minimum)
      ? minimum
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
