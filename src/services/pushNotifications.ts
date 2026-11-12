import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import {
  ensureNotificationHandlerConfigured,
  getExpoNotificationsModule,
  isPushNativeAvailable,
} from './expoNotificationsSafe';

let androidChannelReady = false;
let currentPushToken: string | null = null;

export function getCurrentPushToken(): string | null {
  return currentPushToken;
}

export function setCurrentPushToken(token: string | null): void {
  currentPushToken = token;
}

async function ensureAndroidChannel(): Promise<void> {
  const Notifications = getExpoNotificationsModule();
  if (Platform.OS !== 'android' || androidChannelReady || !Notifications) {
    return;
  }
  await Notifications.setNotificationChannelAsync('help-requests', {
    name: 'HELP requests',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
  androidChannelReady = true;
}

export async function requestPushPermissions(): Promise<boolean> {
  if (!isPushNativeAvailable() || !Device.isDevice) {
    return false;
  }

  try {
    ensureNotificationHandlerConfigured();
    const Notifications = getExpoNotificationsModule();
    if (!Notifications) {
      return false;
    }

    await ensureAndroidChannel();

    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') {
      return true;
    }

    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });

    return requested.status === 'granted';
  } catch {
    return false;
  }
}

export async function getExpoPushToken(): Promise<string | null> {
  if (!isPushNativeAvailable() || !Device.isDevice) {
    return null;
  }

  const Notifications = getExpoNotificationsModule();
  if (!Notifications) {
    return null;
  }

  const granted = await requestPushPermissions();
  if (!granted) {
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;

  if (!projectId) {
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId: String(projectId) });
    return token.data;
  } catch {
    return null;
  }
}

export function addPushTokenListener(onToken: (token: string) => void): () => void {
  const Notifications = getExpoNotificationsModule();
  if (!Notifications) {
    return () => {};
  }
  const sub = Notifications.addPushTokenListener(({ data }) => {
    if (typeof data === 'string') {
      onToken(data);
    }
  });
  return () => sub.remove();
}
