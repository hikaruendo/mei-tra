import { installLatestBundle } from '../ota-update';

jest.mock('expo-updates', () => {
  let enabled = true;
  return {
    get isEnabled() {
      return enabled;
    },
    setEnabled: (value: boolean) => {
      enabled = value;
    },
    checkForUpdateAsync: jest.fn(),
    fetchUpdateAsync: jest.fn(),
    reloadAsync: jest.fn(),
  };
});
jest.mock('@react-native-async-storage/async-storage', () => {
  const storage = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      clear: () => storage.clear(),
      getItem: async (key: string) => storage.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        storage.set(key, value);
      },
    },
  };
});

const mockUpdates = jest.requireMock('expo-updates') as {
  setEnabled: (value: boolean) => void;
  checkForUpdateAsync: jest.Mock;
  fetchUpdateAsync: jest.Mock;
  reloadAsync: jest.Mock;
};
const mockStorage = (
  jest.requireMock('@react-native-async-storage/async-storage') as {
    default: { clear: () => void };
  }
).default;

const onDownloadStart = jest.fn();

beforeEach(() => {
  mockUpdates.setEnabled(true);
  mockUpdates.checkForUpdateAsync.mockReset();
  mockUpdates.fetchUpdateAsync.mockReset().mockResolvedValue({ isNew: true });
  mockUpdates.reloadAsync.mockReset().mockResolvedValue(undefined);
  mockStorage.clear();
  onDownloadStart.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

it('downloads a newer bundle and restarts into it', async () => {
  mockUpdates.checkForUpdateAsync.mockResolvedValue({
    isAvailable: true,
    manifest: { id: 'update-2' },
  });

  await expect(installLatestBundle(onDownloadStart)).resolves.toBe('reloading');
  expect(onDownloadStart).toHaveBeenCalled();
  expect(mockUpdates.reloadAsync).toHaveBeenCalled();
});

it('keeps the running bundle when nothing newer exists', async () => {
  mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: false });

  await expect(installLatestBundle(onDownloadStart)).resolves.toBe('up-to-date');
  expect(mockUpdates.fetchUpdateAsync).not.toHaveBeenCalled();
});

it('does not restart into the same update twice', async () => {
  mockUpdates.checkForUpdateAsync.mockResolvedValue({
    isAvailable: true,
    manifest: { id: 'update-2' },
  });
  await installLatestBundle(onDownloadStart);
  mockUpdates.reloadAsync.mockClear();

  await expect(installLatestBundle(onDownloadStart)).resolves.toBe('up-to-date');
  expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
});

it('lets the app run when the update server fails', async () => {
  mockUpdates.checkForUpdateAsync.mockRejectedValue(new Error('offline'));

  await expect(installLatestBundle(onDownloadStart)).resolves.toBe('up-to-date');
});

it('skips the check in builds without OTA updates', async () => {
  mockUpdates.setEnabled(false);

  await expect(installLatestBundle(onDownloadStart)).resolves.toBe('up-to-date');
  expect(mockUpdates.checkForUpdateAsync).not.toHaveBeenCalled();
});
