import { StatusBar } from 'expo-status-bar';
import React, { useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppToastHost } from './src/components/AppToast';
import { SplashGate } from './src/components/SplashGate';
import { AuthProvider } from './src/context/AuthContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ensureNotificationHandlerConfigured } from './src/services/expoNotificationsSafe';
import { installGlobalErrorLogging } from './src/utils/logger';
import { safeAreaProviderInitialMetrics } from './src/utils/screenInsets';

installGlobalErrorLogging();
ensureNotificationHandlerConfigured();

export default function App() {
  const initialMetrics = useMemo(() => safeAreaProviderInitialMetrics(), []);

  return (
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <SplashGate>
            <NotificationsProvider>
              <RootNavigator />
              <AppToastHost />
            </NotificationsProvider>
          </SplashGate>
          <StatusBar style="dark" />
        </AuthProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
