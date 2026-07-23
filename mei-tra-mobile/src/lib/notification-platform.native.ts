import * as Notifications from 'expo-notifications';

import type {
  NotificationPlatform,
  NotificationResponseHandler,
} from './notification-platform';

export const notificationPlatform: NotificationPlatform = {
  setAndroidNotificationChannel: async () => {
    await Notifications.setNotificationChannelAsync('gameplay', {
      name: '対局通知',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  },
  getPermissions: () => Notifications.getPermissionsAsync(),
  requestPermissions: () => Notifications.requestPermissionsAsync(),
  getExpoPushToken: (projectId) =>
    Notifications.getExpoPushTokenAsync({ projectId }),
  setupNotificationHandling: (
    responseHandler: NotificationResponseHandler,
    foregroundBehavior,
  ) => {
    Notifications.setNotificationHandler({
      handleNotification: async () => foregroundBehavior,
    });

    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener(responseHandler);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) responseHandler(response);
    });

    return () => responseSubscription.remove();
  },
};
