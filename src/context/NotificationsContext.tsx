import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { registerPushToken } from '../api/pushTokens';
import { useAuth } from './AuthContext';
import {
  navigateFromNotification,
  navigationFromPushData,
  setPendingNotificationNavigation,
} from '../navigation/notificationNavigation';
import { getExpoNotificationsModule, isPushNativeAvailable } from '../services/expoNotificationsSafe';
import {
  addPushTokenListener,
  getExpoPushToken,
  requestPushPermissions,
  setCurrentPushToken,
} from '../services/pushNotifications';

type PushContextValue = {
  pushAvailable: boolean;
  pushToken: string | null;
  registerDevicePush: () => Promise<void>;
};

const PushNotificationsContext = createContext<PushContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const pushTokenRef = useRef<string | null>(null);
  const pushAvailable = isPushNativeAvailable();

  const registerDevicePush = useCallback(async () => {
    if (!user || !pushAvailable) {
      return;
    }
    try {
      await requestPushPermissions();
      const token = await getExpoPushToken();
      if (!token) {
        return;
      }
      pushTokenRef.current = token;
      setCurrentPushToken(token);
      setPushToken(token);
      try {
        await registerPushToken(token);
      } catch {
        /* auth or network */
      }
    } catch {
      /* Native push / WorkManager failures must not kill the session after login. */
    }
  }, [pushAvailable, user]);

  useEffect(() => {
    if (!user) {
      setPushToken(null);
      pushTokenRef.current = null;
      setCurrentPushToken(null);
      return;
    }
    void registerDevicePush().catch(() => {});
  }, [user, registerDevicePush]);

  useEffect(() => {
    if (!user || !pushAvailable) {
      return;
    }
    try {
      return addPushTokenListener((token) => {
        pushTokenRef.current = token;
        setCurrentPushToken(token);
        setPushToken(token);
        void registerPushToken(token).catch(() => {});
      });
    } catch {
      return undefined;
    }
  }, [pushAvailable, user]);

  useEffect(() => {
    const Notifications = getExpoNotificationsModule();
    if (!user || !Notifications) {
      return;
    }

    const handleResponse = (response: import('expo-notifications').NotificationResponse) => {
      try {
        const data = response.notification.request.content.data as Record<string, unknown> | undefined;
        const nav = navigationFromPushData(data);
        if (nav) {
          void navigateFromNotification(user, nav);
        }
      } catch {
        /* ignore malformed notification payloads */
      }
    };

    let responseSub: { remove: () => void } | undefined;
    try {
      responseSub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    } catch {
      return;
    }

    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) {
          return;
        }
        const data = response.notification.request.content.data as Record<string, unknown> | undefined;
        const nav = navigationFromPushData(data);
        if (nav) {
          setPendingNotificationNavigation(nav);
        }
      })
      .catch(() => {});

    return () => {
      responseSub?.remove();
    };
  }, [pushAvailable, user]);

  useEffect(() => {
    if (!user || !pushAvailable) {
      return;
    }
    const onState = (state: AppStateStatus) => {
      if (state === 'active') {
        void registerDevicePush().catch(() => {});
      }
    };
    const sub = AppState.addEventListener('change', onState);
    return () => sub.remove();
  }, [pushAvailable, registerDevicePush, user]);

  const value = useMemo(
    () => ({
      pushAvailable,
      pushToken,
      registerDevicePush,
    }),
    [pushAvailable, pushToken, registerDevicePush],
  );

  return <PushNotificationsContext.Provider value={value}>{children}</PushNotificationsContext.Provider>;
}

/** Push-only — no in-app notification center. */
export function usePushNotifications(): PushContextValue {
  const ctx = useContext(PushNotificationsContext);
  if (!ctx) {
    throw new Error('usePushNotifications must be used within NotificationsProvider');
  }
  return ctx;
}
