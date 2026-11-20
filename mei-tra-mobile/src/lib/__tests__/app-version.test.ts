import { readFileSync } from 'fs';
import { join } from 'path';

import {
  checkStoreVersion,
  getStoreUrl,
  isOlderThan,
  parseVersion,
  type AppVersion,
} from '../app-version';

jest.mock('@/lib/config', () => ({
  config: { publicWebBaseUrl: 'https://web.example', appStoreId: '123' },
}));
jest.mock('expo-constants', () => ({
  expoConfig: { version: '0.1.2', android: { package: 'com.example.app' } },
}));

const v = (value: string): AppVersion => parseVersion(value)!;

describe('parseVersion', () => {
  it('accepts dotted numbers only', () => {
    expect(parseVersion('0.1.10')).toEqual([0, 1, 10]);
    expect(parseVersion('latest')).toBeNull();
    expect(parseVersion(12)).toBeNull();
    expect(parseVersion(undefined)).toBeNull();
  });
});

describe('isOlderThan', () => {
  it.each([
    ['0.1.1', '0.1.2', true],
    ['0.1.9', '0.1.10', true],
    ['0.9.0', '1.0', true],
    ['0.1.2', '0.1.2', false],
    ['0.1.3', '0.1.2', false],
    ['1.0', '1.0.0', false],
  ])('%s older than %s → %s', (installed, minimum, expected) => {
    expect(isOlderThan(v(installed), v(minimum))).toBe(expected);
  });
});

describe('getStoreUrl', () => {
  it('links each platform to its store listing', () => {
    expect(getStoreUrl('ios')).toBe('https://apps.apple.com/app/id123');
    expect(getStoreUrl('android')).toBe(
      'https://play.google.com/store/apps/details?id=com.example.app',
    );
  });
});

describe('checkStoreVersion', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const respond = (body: unknown, ok = true) =>
    fetchMock.mockResolvedValue({ ok, json: async () => body });

  it('compares the installed build with the platform minimum', async () => {
    respond({ minimumVersion: { ios: '0.1.3', android: '0.1.2' } });

    await expect(checkStoreVersion('ios')).resolves.toBe('outdated');
    await expect(checkStoreVersion('android')).resolves.toBe('current');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://web.example/mobile-version.json',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('reports unknown when the minimum is missing, malformed, or unreachable', async () => {
    respond({}, false);
    await expect(checkStoreVersion('ios')).resolves.toBe('unknown');

    respond({ minimumVersion: { ios: 'next' } });
    await expect(checkStoreVersion('ios')).resolves.toBe('unknown');

    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(checkStoreVersion('ios')).resolves.toBe('unknown');
  });
});

describe('published minimum versions', () => {
  const root = join(__dirname, '../../../..');
  const published = JSON.parse(
    readFileSync(join(root, 'mei-tra-frontend/public/mobile-version.json'), 'utf8'),
  ) as { minimumVersion: Record<string, string> };
  const appVersion = v(
    (JSON.parse(readFileSync(join(root, 'mei-tra-mobile/app.json'), 'utf8')) as {
      expo: { version: string };
    }).expo.version,
  );

  it.each(['ios', 'android'])(
    'never require a %s version newer than this app',
    (platform) => {
      const minimum = parseVersion(published.minimumVersion[platform]);
      expect(minimum).not.toBeNull();
      expect(isOlderThan(appVersion, minimum!)).toBe(false);
    },
  );
});
