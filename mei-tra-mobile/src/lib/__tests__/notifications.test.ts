import * as Notifications from 'expo-notifications';

import {
  getNotificationRoomId,
  registerForPushNotifications,
  setupNotificationHandling,
  unregisterPushToken,
} from '@/lib/notifications';

const mockStorage = new Map<string, string>();
let mockIsDevice = true;
let mockPlatformOS: 'ios' | 'android' | 'web' = 'ios';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorage.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockStorage.delete(key);
    }),
  },
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'device-1'),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '0.1.0',
      extra: { eas: { projectId: 'project-1' } },
    },
    easConfig: { projectId: 'project-1' },
  },
}));

jest.mock('expo-device', () => ({
  get isDevice() {
    return mockIsDevice;
  },
}));

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

jest.mock('expo-notifications', () => ({
  PermissionStatus: { GRANTED: 'granted', UNDETERMINED: 'undetermined' },
  AndroidImportance: { DEFAULT: 3 },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  unregisterForNotificationsAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
}));

jest.mock('@/lib/config', () => ({
  config: {
    backendUrl: 'https://backend.example.com',
  },
}));

const fetchMock = jest.fn();

describe('notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
    mockPlatformOS = 'ios';
    mockIsDevice = true;
    fetchMock.mockReset();
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: Notifications.PermissionStatus.GRANTED,
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: Notifications.PermissionStatus.GRANTED,
    });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: 'ExpoPushToken[token-1]',
    });
    (
      Notifications.unregisterForNotificationsAsync as jest.Mock
    ).mockResolvedValue(undefined);
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('does not install notification handlers or listeners on web', () => {
    mockPlatformOS = 'web';

    const cleanup = setupNotificationHandling(jest.fn());

    expect(Notifications.setNotificationHandler).not.toHaveBeenCalled();
    expect(
      Notifications.addNotificationResponseReceivedListener,
    ).not.toHaveBeenCalled();
    cleanup();
  });

  it('installs native notification handling and cleans up the listener', () => {
    const remove = jest.fn();
    (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValueOnce({
      remove,
    });

    const responseHandler = jest.fn();
    const cleanup = setupNotificationHandling(responseHandler);

    expect(Notifications.setNotificationHandler).toHaveBeenCalledWith({
      handleNotification: expect.any(Function),
    });
    expect(
      Notifications.addNotificationResponseReceivedListener,
    ).toHaveBeenCalledWith(responseHandler);
    cleanup();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('does not register a simulator token', async () => {
    mockIsDevice = false;

    await expect(registerForPushNotifications('access-token')).resolves.toEqual({
      status: 'unsupported',
      message: '実機でのみ通知を登録できます。',
    });
    expect(fetchMock).not.toHaveBeenCalled();

    mockIsDevice = true;
  });

  it('registers a physical-device token and unregisters it on logout', async () => {
    await expect(registerForPushNotifications('access-token')).resolves.toEqual({
      status: 'registered',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.example.com/api/push-tokens',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      }),
    );

    await expect(unregisterPushToken('access-token')).resolves.toBe('removed');
    expect(Notifications.unregisterForNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/push-tokens?deviceId=device-1&platform='),
      expect.objectContaining({
        method: 'DELETE',
        headers: { Authorization: 'Bearer access-token' },
      }),
    );
    await expect(unregisterPushToken('access-token')).resolves.toBe('none');
  });

  it('waits for an explicit action before requesting notification permission', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: Notifications.PermissionStatus.UNDETERMINED,
    });

    await expect(registerForPushNotifications('access-token')).resolves.toEqual({
      status: 'not-requested',
    });
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    await expect(
      registerForPushNotifications('access-token', {
        requestPermission: true,
      }),
    ).resolves.toEqual({ status: 'registered' });
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not register after permission denial and extracts room links safely', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'denied',
    });

    await expect(registerForPushNotifications('access-token')).resolves.toMatchObject({
      status: 'permission-denied',
    });
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    const response = {
      notification: {
        request: {
          identifier: 'notification-1',
          content: { data: { type: 'turn', roomId: 'room-1' } },
        },
      },
    } as unknown as Notifications.NotificationResponse;
    expect(getNotificationRoomId(response)).toBe('room-1');
  });

  it('unregisters the device when remote removal fails', async () => {
    await registerForPushNotifications('access-token');
    fetchMock.mockRejectedValueOnce(new Error('offline'));

    await expect(unregisterPushToken('access-token')).resolves.toBe('removed');
    await expect(unregisterPushToken('access-token')).resolves.toBe('none');
  });

  it('keeps local notification state when server and device removal both fail', async () => {
    await registerForPushNotifications('access-token');
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    (
      Notifications.unregisterForNotificationsAsync as jest.Mock
    ).mockRejectedValueOnce(new Error('native removal failed'));

    await expect(unregisterPushToken('access-token')).resolves.toBe('failed');

    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    await expect(unregisterPushToken('access-token')).resolves.toBe('removed');
    await expect(unregisterPushToken('access-token')).resolves.toBe('none');
  });
});
