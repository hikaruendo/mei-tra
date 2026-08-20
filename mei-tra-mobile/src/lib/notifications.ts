import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import type * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type {
  PushPlatform,
  RegisterPushTokenInput,
} from '@meitra/contracts/push';

import { config } from '@/lib/config';

import {
  notificationPlatform,
  type NotificationResponseHandler,
} from './notification-platform';
import { t } from '@/i18n';

const DEVICE_ID_KEY = 'meitra.notifications.deviceId';
const REGISTRATION_KEY = 'meitra.notifications.registration';
const REQUEST_TIMEOUT_MS = 5000;

export type NotificationRegistrationStatus =
  | 'registered'
  | 'unsupported'
  | 'not-requested'
  | 'permission-denied'
  | 'missing-project-id'
  | 'failed';

interface NotificationRegistrationOptions {
  appVersion?: string;
  requestPermission?: boolean;
}

export interface LocalPushRegistration {
  deviceId: string;
  platform: PushPlatform;
  expoPushToken: string;
}

export interface NotificationRegistrationResult {
  status: NotificationRegistrationStatus;
  message?: string;
}

export type NotificationUnregistrationStatus = 'removed' | 'none' | 'failed';

export const notificationForegroundBehavior = (): Notifications.NotificationBehavior => ({
  shouldShowBanner: true,
  shouldShowList: true,
  shouldPlaySound: true,
  shouldSetBadge: false,
});

export const setupNotificationHandling = (
  responseHandler: NotificationResponseHandler,
): (() => void) => {
  if (!getPlatform()) return () => undefined;
  return notificationPlatform.setupNotificationHandling(
    responseHandler,
    notificationForegroundBehavior(),
  );
};

const getPlatform = (): PushPlatform | null => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') return Platform.OS;
  return null;
};

const getProjectId = (): string | null =>
  Constants.expoConfig?.extra?.eas?.projectId ??
  Constants.easConfig?.projectId ??
  null;

const withTimeout = async <T>(promise: Promise<T>): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Notification request timed out')),
          REQUEST_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

const getDeviceId = async (): Promise<string> => {
  const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (stored?.trim()) return stored;

  const deviceId = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
};

const getLocalRegistration = async (): Promise<LocalPushRegistration | null> => {
  const raw = await AsyncStorage.getItem(REGISTRATION_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const registration = parsed as Partial<LocalPushRegistration>;
    if (
      typeof registration.deviceId !== 'string' ||
      (registration.platform !== 'ios' && registration.platform !== 'android') ||
      typeof registration.expoPushToken !== 'string'
    ) {
      return null;
    }
    return registration as LocalPushRegistration;
  } catch {
    return null;
  }
};

const saveLocalRegistration = async (
  registration: LocalPushRegistration,
): Promise<void> => {
  await AsyncStorage.setItem(REGISTRATION_KEY, JSON.stringify(registration));
};

export const clearLocalNotificationRegistration = async (): Promise<void> => {
  await AsyncStorage.removeItem(REGISTRATION_KEY).catch(() => undefined);
};

const requestApi = async (
  path: string,
  accessToken: string,
  init: RequestInit,
): Promise<Response> =>
  withTimeout(
    fetch(`${config.backendUrl}/api${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...init.headers,
      },
    }),
  );

export const registerForPushNotifications = async (
  accessToken: string | null,
  {
    appVersion = Constants.expoConfig?.version,
    requestPermission = false,
  }: NotificationRegistrationOptions = {},
): Promise<NotificationRegistrationResult> => {
  const platform = getPlatform();
  if (!platform || !Device.isDevice) {
    return { status: 'unsupported', message: t('notifications.deviceOnly') };
  }

  try {
    if (Platform.OS === 'android') {
      await notificationPlatform.setAndroidNotificationChannel();
    }

    const current = await notificationPlatform.getPermissions();
    if (current.status !== 'granted' && !requestPermission) {
      return {
        status:
          current.status === 'denied'
            ? 'permission-denied'
            : 'not-requested',
      };
    }

    const permission =
      current.status === 'granted'
        ? current
        : await notificationPlatform.requestPermissions();
    if (permission.status !== 'granted') {
      return {
        status: 'permission-denied',
        message: t('notifications.permissionDenied'),
      };
    }

    if (!accessToken) {
      return { status: 'failed', message: t('notifications.noSession') };
    }

    const projectId = getProjectId();
    if (!projectId) {
      return {
        status: 'missing-project-id',
        message: t('notifications.projectIdMissing'),
      };
    }

    const token = (await notificationPlatform.getExpoPushToken(projectId)).data;
    const registration: LocalPushRegistration = {
      deviceId: await getDeviceId(),
      platform,
      expoPushToken: token,
    };
    const input: RegisterPushTokenInput = {
      ...registration,
      appVersion,
    };

    const response = await requestApi('/push-tokens', accessToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error(`Push token registration failed: ${response.status}`);
    }

    await saveLocalRegistration(registration);
    return { status: 'registered' };
  } catch (error) {
    console.warn('[Notifications] Failed to register push token:', error);
    return {
      status: 'failed',
      message: t('notifications.registerFailed'),
    };
  }
};

export const unregisterPushToken = async (
  accessToken: string | null,
): Promise<NotificationUnregistrationStatus> => {
  const registration = await getLocalRegistration();
  if (!registration) return 'none';

  let removedFromServer = false;
  try {
    if (accessToken) {
      const query = new URLSearchParams({
        deviceId: registration.deviceId,
        platform: registration.platform,
      });
      const response = await requestApi(
        `/push-tokens?${query.toString()}`,
        accessToken,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        throw new Error(`Push token removal failed: ${response.status}`);
      }
      removedFromServer = true;
    }
  } catch (error) {
    console.warn('[Notifications] Failed to remove push token:', error);
  }

  let unregisteredDevice = false;
  try {
    await notificationPlatform.unregisterForNotifications();
    unregisteredDevice = true;
  } catch (error) {
    console.warn(
      '[Notifications] Failed to unregister device notifications:',
      error,
    );
  }

  if (!removedFromServer && !unregisteredDevice) {
    return 'failed';
  }

  await clearLocalNotificationRegistration();
  return 'removed';
};

export const getNotificationRoomId = (
  response: Notifications.NotificationResponse,
): string | null => {
  const data = response.notification.request.content.data;
  if (!data || typeof data !== 'object') return null;
  const roomId = (data as Record<string, unknown>).roomId;
  return typeof roomId === 'string' && roomId.trim() ? roomId : null;
};
