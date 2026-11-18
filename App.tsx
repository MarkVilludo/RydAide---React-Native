import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppToastHost } from './src/components/AppToast';
import { LAUNCH_BACKGROUND } from './src/constants/launchBrand';
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

  useEffect(() => {
    // Native splash can leave a black window until JS hides it (especially off Metro / bridgeless).
    if (Platform.OS === 'android') {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: LAUNCH_BACKGROUND }}>
        {/* Mounted first so the loading screen's light status bar sits on top until it closes. */}
        <StatusBar style="dark" />
        <AuthProvider>
          <SplashGate>
            <NotificationsProvider>
              <RootNavigator />
              <AppToastHost />
            </NotificationsProvider>
          </SplashGate>
        </AuthProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
