import { StatusBar } from 'expo-status-bar';
import React, { useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppToastHost } from './src/components/AppToast';
import { AuthProvider } from './src/context/AuthContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ensureNotificationHandlerConfigured } from './src/services/expoNotificationsSafe';
import { safeAreaProviderInitialMetrics } from './src/utils/screenInsets';

ensureNotificationHandlerConfigured();

export default function App() {
  const initialMetrics = useMemo(() => safeAreaProviderInitialMetrics(), []);

  return (
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <NotificationsProvider>
            <RootNavigator />
            <AppToastHost />
          </NotificationsProvider>
          <StatusBar style="dark" />
        </AuthProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
