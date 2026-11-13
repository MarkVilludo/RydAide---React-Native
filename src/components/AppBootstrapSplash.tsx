import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { BootError } from '../context/AuthContext';
import { LAUNCH_BACKGROUND, LAUNCH_LOGO, LAUNCH_LOGO_SIZE } from '../constants/launchBrand';

const { width: W, height: H } = Dimensions.get('window');
/** Logo sits exactly where the native splash draws it: centred in the window. */
const LOGO_TOP = (H - LAUNCH_LOGO_SIZE) / 2;
const SLOW_AFTER_MS = 4000;

type Props = {
  /** Fires once the logo has drawn — the moment it's safe to hide the native splash. */
  onLogoReady?: () => void;
  error?: BootError | null;
  retrying?: boolean;
  onRetry?: () => void;
  onSignOut?: () => void;
  /** 0 → 1 while the screen fades away into the app. */
  exit?: Animated.Value;
};

function errorCopy(error: BootError): { title: string; body: string } {
  switch (error) {
    case 'network':
      return { title: 'You seem to be offline', body: 'Check your internet connection, then try again.' };
    case 'timeout':
      return { title: 'This is taking too long', body: 'RydAid couldn’t load your account. Check your connection and try again.' };
    default:
      return { title: 'Something went wrong', body: 'We couldn’t load your account right now. Please try again.' };
  }
}

/**
 * The one branded loading screen between the native splash and the dashboard.
 * Same background and logo position as the native splash, so the hand-off is seamless.
 */
export function AppBootstrapSplash({ onLogoReady, error, retrying, onRetry, onSignOut, exit }: Props) {
  const ripple = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const textIn = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const [slow, setSlow] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const readySent = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
    const t = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    Animated.timing(textIn, {
      toValue: 1,
      duration: 420,
      delay: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    if (reduceMotion) return;
    const loops = [
      Animated.loop(
        Animated.timing(ripple, { toValue: 1, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(breathe, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(breathe, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.timing(bar, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduceMotion, ripple, breathe, textIn, bar]);

  const logoReady = () => {
    if (readySent.current) return;
    readySent.current = true;
    onLogoReady?.();
  };

  const exitV = exit ?? new Animated.Value(0);
  const logoScale = Animated.multiply(
    breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }),
    exitV.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }),
  );
  const ringStyle = (offset: number) => {
    const p = Animated.modulo(Animated.add(ripple, offset), 1);
    return {
      opacity: p.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.28, 0] }),
      transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.9, 2.3] }) }],
    };
  };
  const textStyle = {
    opacity: textIn,
    transform: [{ translateY: textIn.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  };
  const barX = bar.interpolate({ inputRange: [0, 1], outputRange: [-60, 120] });

  const copy = error ? errorCopy(error) : null;

  return (
    <View style={styles.root} accessibilityViewIsModal>
      <StatusBar style="light" />
      {!error && !reduceMotion ? (
        <>
          <Animated.View pointerEvents="none" style={[styles.ring, ringStyle(0)]} />
          <Animated.View pointerEvents="none" style={[styles.ring, ringStyle(0.5)]} />
        </>
      ) : null}
      <Animated.View style={[styles.logoBox, { transform: [{ scale: logoScale }] }]} pointerEvents="none">
        <Image
          source={LAUNCH_LOGO}
          style={styles.logo}
          resizeMode="contain"
          fadeDuration={0}
          onLoad={logoReady}
          onLayout={logoReady}
          accessible
          accessibilityLabel="RydAid"
          accessibilityIgnoresInvertColors
        />
      </Animated.View>

      <Animated.View style={[styles.below, textStyle]}>
        <Text style={styles.word} accessibilityElementsHidden importantForAccessibility="no">
          RydAid
        </Text>
        {copy ? (
          <View style={styles.errorBox} accessibilityRole="alert" accessibilityLiveRegion="assertive">
            <Text style={styles.errorTitle}>{copy.title}</Text>
            <Text style={styles.errorBody}>{copy.body}</Text>
            <Pressable
              onPress={onRetry}
              disabled={retrying}
              style={({ pressed }) => [styles.retryBtn, (pressed || retrying) && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Try again"
              accessibilityState={{ busy: Boolean(retrying), disabled: Boolean(retrying) }}
            >
              {retrying ? (
                <ActivityIndicator color={LAUNCH_BACKGROUND} />
              ) : (
                <Text style={styles.retryText}>Try again</Text>
              )}
            </Pressable>
            {onSignOut ? (
              <Pressable onPress={onSignOut} style={styles.linkBtn} accessibilityRole="button">
                <Text style={styles.linkText}>Sign in with a different account</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            <Text style={styles.status} accessibilityRole="progressbar" accessibilityLiveRegion="polite">
              {slow ? 'Still working on it…' : 'Getting things ready…'}
            </Text>
            <View style={styles.track}>
              {reduceMotion ? (
                <View style={[styles.fill, styles.fillStatic]} />
              ) : (
                <Animated.View style={[styles.fill, { transform: [{ translateX: barX }] }]} />
              )}
            </View>
          </>
        )}
      </Animated.View>
    </View>
  );
}

const RING = LAUNCH_LOGO_SIZE * 1.1;

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: W,
    height: H,
    backgroundColor: LAUNCH_BACKGROUND,
  },
  ring: {
    position: 'absolute',
    left: (W - RING) / 2,
    top: LOGO_TOP + (LAUNCH_LOGO_SIZE - RING) / 2,
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  logoBox: {
    position: 'absolute',
    left: (W - LAUNCH_LOGO_SIZE) / 2,
    top: LOGO_TOP,
    width: LAUNCH_LOGO_SIZE,
    height: LAUNCH_LOGO_SIZE,
  },
  logo: { width: LAUNCH_LOGO_SIZE, height: LAUNCH_LOGO_SIZE },
  below: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: LOGO_TOP + LAUNCH_LOGO_SIZE + 28,
    alignItems: 'center',
  },
  word: { fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: -0.4 },
  status: { marginTop: 8, fontSize: 15, fontWeight: '600', color: '#e0f2fe' },
  track: {
    marginTop: 16,
    width: 120,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  fill: { width: 60, height: 4, borderRadius: 2, backgroundColor: '#ffffff' },
  fillStatic: { width: 120, opacity: 0.6 },
  errorBox: { marginTop: 14, alignItems: 'center', maxWidth: 340 },
  errorTitle: { fontSize: 18, fontWeight: '800', color: '#ffffff', textAlign: 'center' },
  errorBody: { marginTop: 6, fontSize: 14, lineHeight: 20, color: '#e0f2fe', textAlign: 'center' },
  retryBtn: {
    marginTop: 18,
    minWidth: 200,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  retryText: { fontSize: 16, fontWeight: '800', color: LAUNCH_BACKGROUND },
  pressed: { opacity: 0.8 },
  linkBtn: { minHeight: 44, justifyContent: 'center', marginTop: 6, paddingHorizontal: 12 },
  linkText: { fontSize: 14, fontWeight: '700', color: '#ffffff', textDecorationLine: 'underline' },
});
