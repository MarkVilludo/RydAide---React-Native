import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLaunchSteps } from '../utils/launchSteps';
import { AppBootstrapSplash } from './AppBootstrapSplash';

void SplashScreen.preventAutoHideAsync().catch(() => {
  /* Expo Go or web may not support native splash the same way */
});

type Props = {
  children: React.ReactNode;
};

const EXIT_MS = 320;
/** Keep the loading screen at least this long so it reads as intentional, not a flicker. */
const MIN_VISIBLE_MS = 600;
/** Never hold a signed-in user on the loading screen longer than this waiting for the dashboard. */
const DASHBOARD_WAIT_CAP_MS = 6000;
/** Hide the native splash even if the logo's load event never fires. */
const NATIVE_HIDE_FALLBACK_MS = 1500;

/**
 * Launch sequence: native splash → this ONE branded loading screen → the right dashboard.
 *
 * The app renders underneath from the start; the loading screen stays on top until auth is
 * restored AND the role's dashboard has its first data AND the cold-start active-job redirect
 * has run — so no half-loaded or about-to-redirect screen is ever shown.
 */
export function SplashGate({ children }: Props) {
  const { isLoading, user, bootError, retryBootstrap, abandonSession } = useAuth();
  const steps = useLaunchSteps();
  const [showOverlay, setShowOverlay] = useState(true);
  const [capHit, setCapHit] = useState(false);
  const exit = useRef(new Animated.Value(0)).current;
  const mountedAt = useRef(Date.now());
  const nativeHidden = useRef(false);
  const exiting = useRef(false);

  const hideNative = useCallback(() => {
    if (nativeHidden.current) return;
    nativeHidden.current = true;
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(hideNative, NATIVE_HIDE_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [hideNative]);

  const authDone = !isLoading && !bootError;
  const showsDashboard = authDone && user != null && !!user.email_verified_at;
  const hasRecovery = user?.role === 'owner' || user?.role === 'mechanic';

  useEffect(() => {
    if (!showsDashboard) return;
    const t = setTimeout(() => setCapHit(true), DASHBOARD_WAIT_CAP_MS);
    return () => clearTimeout(t);
  }, [showsDashboard]);

  const ready =
    authDone && (!showsDashboard || capHit || (steps.dashboard && (!hasRecovery || steps.recovery)));

  useEffect(() => {
    if (!ready || exiting.current || !showOverlay) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - mountedAt.current));
    const t = setTimeout(() => {
      exiting.current = true;
      hideNative();
      Animated.timing(exit, {
        toValue: 1,
        duration: EXIT_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setShowOverlay(false));
    }, wait);
    return () => clearTimeout(t);
  }, [ready, showOverlay, exit, hideNative]);

  const overlayOpacity = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <View style={styles.root}>
      {children}
      {showOverlay ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.overlay, { opacity: overlayOpacity }]}
          pointerEvents={ready ? 'none' : 'auto'}
        >
          <AppBootstrapSplash
            onLogoReady={hideNative}
            error={bootError}
            retrying={isLoading && !bootError}
            onRetry={retryBootstrap}
            onSignOut={() => void abandonSession()}
            exit={exit}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { zIndex: 9999, elevation: 9999 },
});
