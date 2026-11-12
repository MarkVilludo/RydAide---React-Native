import React, { useEffect } from 'react';
import { ActivityIndicator, Dimensions, Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/** App icon — same as stores / launcher (roadside brand mark). */
const APP_ICON = require('../../assets/icon.png');

const ENTER_DURATION = 480;
const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

/**
 * Full-screen launch presentation shown while auth restores the session.
 * Uses explicit window bounds so Android absolute overlays stay centered.
 */
export function AppBootstrapSplash() {
  const enterT = useSharedValue(0);

  useEffect(() => {
    enterT.value = withTiming(1, { duration: ENTER_DURATION, easing: Easing.out(Easing.cubic) });
  }, [enterT]);

  const contentStyle = useAnimatedStyle(() => {
    const t = enterT.value;
    return {
      opacity: interpolate(t, [0, 0.35, 1], [0, 1, 1], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(t, [0, 1], [10, 0], Extrapolation.CLAMP) }],
    };
  });

  return (
    <View style={styles.root} pointerEvents="none">
      <Animated.View style={[styles.center, contentStyle]}>
        <View style={styles.logoWrap}>
          <Image source={APP_ICON} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
        </View>
        <Text style={styles.title}>RydAid</Text>
        <Text style={styles.subtitle}>Getting things ready…</Text>
        <ActivityIndicator style={styles.spinner} size="large" color="#0284c7" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoWrap: {
    marginBottom: 16,
  },
  logo: {
    width: 112,
    height: 112,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '600',
    color: '#0284c7',
    textAlign: 'center',
  },
  spinner: {
    marginTop: 28,
  },
});
