import { isRunningInExpoGo } from 'expo';

/** Push native code is not in Expo Go (SDK 53+). Use a dev/production build for FCM. */
export function isPushNativeAvailable(): boolean {
  return !isRunningInExpoGo();
}

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null | undefined;

export function getExpoNotificationsModule(): NotificationsModule | null {
  if (!isPushNativeAvailable()) {
    return null;
  }
  if (cached !== undefined) {
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

export function ensureNotificationHandlerConfigured(): void {
  const Notifications = getExpoNotificationsModule();
  if (!Notifications) {
    return;
  }
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
