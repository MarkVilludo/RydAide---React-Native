import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
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

const EXIT_MS = 520;
const EXIT_EASE = Easing.bezierFn(0.33, 0, 0.2, 1);
/** Ensures branded splash animation is visible on fast reload / cached session (ms). */
const MIN_SPLASH_VISIBLE_MS = 900;

/**
 * Keeps the native splash visible until auth bootstrap finishes, then eases into the app.
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
      exitProgress.value = 0;
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

  const overlayStyle = useAnimatedStyle(() => {
    const p = exitProgress.value;
    return {
      opacity: interpolate(p, [0, 1], [1, 0]),
      transform: [{ scale: interpolate(p, [0, 1], [1, 1.04]) }],
    };
  });

  return (
    <>
      {children}
      {showOverlay ? (
        <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents={isLoading ? 'auto' : 'none'}>
          <AppBootstrapSplash />
        </Animated.View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
});
