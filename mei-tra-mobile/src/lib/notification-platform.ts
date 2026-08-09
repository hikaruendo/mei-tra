import type * as Notifications from 'expo-notifications';

export type NotificationResponseHandler = (
  response: Notifications.NotificationResponse,
) => void;

export interface NotificationPlatform {
  setAndroidNotificationChannel: () => Promise<void>;
  getPermissions: () => ReturnType<typeof Notifications.getPermissionsAsync>;
  requestPermissions: () => ReturnType<typeof Notifications.requestPermissionsAsync>;
  getExpoPushToken: (
    projectId: string,
  ) => ReturnType<typeof Notifications.getExpoPushTokenAsync>;
  unregisterForNotifications: () => Promise<void>;
  setupNotificationHandling: (
    responseHandler: NotificationResponseHandler,
    foregroundBehavior: Notifications.NotificationBehavior,
  ) => () => void;
}

type NotificationPermissions = Awaited<
  ReturnType<typeof Notifications.getPermissionsAsync>
>;

const deniedPermissions = (): NotificationPermissions =>
  ({ status: 'denied' }) as NotificationPermissions;

export const notificationPlatform: NotificationPlatform = {
  setAndroidNotificationChannel: async () => undefined,
  getPermissions: async () => deniedPermissions(),
  requestPermissions: async () => deniedPermissions(),
  getExpoPushToken: async () => {
    throw new Error('Push notifications are not supported on web.');
  },
  unregisterForNotifications: async () => undefined,
  setupNotificationHandling: () => () => undefined,
};
