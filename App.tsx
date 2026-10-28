import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppToastHost } from './src/components/AppToast';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { safeAreaProviderInitialMetrics } from './src/utils/screenInsets';

const initialMetrics = safeAreaProviderInitialMetrics();

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <RootNavigator />
          <AppToastHost />
          <StatusBar style="dark" />
        </AuthProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
