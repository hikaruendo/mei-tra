import { fetchMinimumVersion, isOlderThan } from '../app-version';

jest.mock('@/lib/config', () => ({
  config: { publicWebBaseUrl: 'https://web.example' },
}));
jest.mock('expo-constants', () => ({ expoConfig: { version: '0.1.2' } }));

describe('isOlderThan', () => {
  it.each([
    ['0.1.1', '0.1.2', true],
    ['0.1.9', '0.1.10', true],
    ['0.9.0', '1.0', true],
    ['0.1.2', '0.1.2', false],
    ['0.1.3', '0.1.2', false],
    ['1.0', '1.0.0', false],
  ])('%s older than %s → %s', (installed, minimum, expected) => {
    expect(isOlderThan(installed, minimum)).toBe(expected);
  });

  it('never blocks on a version it cannot read', () => {
    expect(isOlderThan('0.1.1', 'latest')).toBe(false);
    expect(isOlderThan('dev', '0.1.2')).toBe(false);
  });
});

describe('fetchMinimumVersion', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const respond = (body: unknown, ok = true) =>
    fetchMock.mockResolvedValue({ ok, json: async () => body });

  it('reads the platform minimum from the web app', async () => {
    respond({ minimumVersion: { ios: '0.1.3', android: '0.1.2' } });

    await expect(fetchMinimumVersion('ios')).resolves.toBe('0.1.3');
    await expect(fetchMinimumVersion('android')).resolves.toBe('0.1.2');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://web.example/mobile-version.json',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('returns null when the file is missing, malformed, or unreachable', async () => {
    respond({}, false);
    await expect(fetchMinimumVersion('ios')).resolves.toBeNull();

    respond({ minimumVersion: { ios: 'next' } });
    await expect(fetchMinimumVersion('ios')).resolves.toBeNull();

    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(fetchMinimumVersion('ios')).resolves.toBeNull();
  });
});
