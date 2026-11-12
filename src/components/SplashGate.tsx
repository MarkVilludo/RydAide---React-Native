import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { AppBootstrapSplash } from './AppBootstrapSplash';

void SplashScreen.preventAutoHideAsync().catch(() => {
  /* Expo Go or web may not support native splash the same way */
});

type Props = {
  children: React.ReactNode;
};

const EXIT_MS = 360;
const EXIT_EASE = Easing.out(Easing.cubic);
const MIN_SPLASH_VISIBLE_MS = 700;
const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

/**
 * Keeps the native splash visible until auth bootstrap finishes, then fades into the app.
 */
export function SplashGate({ children }: Props) {
  const { isLoading } = useAuth();
  const [showOverlay, setShowOverlay] = useState(true);
  const exitProgress = useSharedValue(0);
  const appOpenedAt = useRef(Date.now());

  useEffect(() => {
    if (isLoading) {
      setShowOverlay(true);
      exitProgress.value = 0;
      return;
    }

    let cancelled = false;

    const go = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch {
        /* ignore */
      }
      if (cancelled) {
        return;
      }
      exitProgress.value = withTiming(1, { duration: EXIT_MS, easing: EXIT_EASE }, (finished) => {
        if (finished) {
          runOnJS(setShowOverlay)(false);
        }
      });
    };

    const elapsed = Date.now() - appOpenedAt.current;
    const waitMs = Math.max(0, MIN_SPLASH_VISIBLE_MS - elapsed);
    const timer = setTimeout(() => {
      void go();
    }, waitMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isLoading, exitProgress]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: 1 - exitProgress.value,
  }));

  return (
    <View style={styles.root}>
      {children}
      {showOverlay ? (
        <Animated.View
          style={[styles.overlay, overlayStyle]}
          pointerEvents={isLoading ? 'auto' : 'none'}
        >
          <AppBootstrapSplash />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    zIndex: 9999,
    elevation: 9999,
    backgroundColor: '#f8fafc',
  },
});
