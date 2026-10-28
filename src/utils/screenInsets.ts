import Constants from 'expo-constants';
import { Dimensions, Platform, StatusBar } from 'react-native';
import {
  initialWindowMetrics,
  type Metrics,
} from 'react-native-safe-area-context';

/** Ensures SafeAreaProvider renders children immediately (required by React Navigation). */
export function safeAreaProviderInitialMetrics(): Metrics {
  if (initialWindowMetrics != null) {
    return initialWindowMetrics;
  }
  const { width = 0, height = 0 } = Dimensions.get('window');
  return {
    frame: { x: 0, y: 0, width, height },
    insets: {
      top: statusBarTopInset(),
      left: 0,
      right: 0,
      bottom: Platform.OS === 'ios' ? 34 : 20,
    },
  };
}

/** Top inset for overlay UI under transparent headers (no safe-area hook). */
export function statusBarTopInset(): number {
  if (Platform.OS === 'android') {
    return StatusBar.currentHeight ?? 0;
  }
  return Constants.statusBarHeight ?? 47;
}

/** Modest bottom padding (sheet footers, cancel buttons). */
export function compactBottomInset(): number {
  return Platform.OS === 'ios' ? 8 : 4;
}

/** Full home-indicator clearance for modals and toasts. */
export function homeIndicatorBottomInset(): number {
  return Platform.OS === 'ios' ? 34 : 0;
}
