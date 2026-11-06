import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/** App icon — same as stores / launcher (roadside brand mark). */
const APP_ICON = require('../../assets/icon.png');

const ENTER_DURATION = 640;

/**
 * Full-screen launch presentation shown while auth restores the session.
 * Kept visually aligned with app.config splash (bg #f8fafc, centered mark).
 */
export function AppBootstrapSplash() {
  const enterT = useSharedValue(0);
  const logoIdle = useSharedValue(0);
  const shimmer = useSharedValue(0.35);
  const loaderSpin = useSharedValue(0);

  useEffect(() => {
    loaderSpin.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.linear }),
      -1,
      false,
    );
    enterT.value = withTiming(1, { duration: ENTER_DURATION, easing: Easing.out(Easing.cubic) });
    logoIdle.value = withDelay(
      ENTER_DURATION,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );
    shimmer.value = withDelay(
      320,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 950, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.35, { duration: 950, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
  }, [enterT, loaderSpin, logoIdle, shimmer]);

  const logoIntroStyle = useAnimatedStyle(() => {
    const t = enterT.value;
    const scale = interpolate(t, [0, 0.45, 1], [0.78, 1.02, 1], Extrapolation.CLAMP);
    const opacity = interpolate(t, [0, 0.2, 1], [0, 1, 1], Extrapolation.CLAMP);
    const idle = interpolate(logoIdle.value, [0, 1], [1, 1.035], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ scale: scale * idle }],
    };
  });

  const titleStyle = useAnimatedStyle(() => {
    const t = enterT.value;
    return {
      opacity: interpolate(t, [0, 0.35, 0.55, 1], [0, 0, 1, 1], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(t, [0, 0.55, 1], [14, 4, 0], Extrapolation.CLAMP) },
      ],
    };
  });

  const subtitleStyle = useAnimatedStyle(() => {
    const baseOp = interpolate(enterT.value, [0, 0.5, 0.72, 1], [0, 0, 1, 1], Extrapolation.CLAMP);
    const pulse = interpolate(shimmer.value, [0.35, 1], [0.55, 1], Extrapolation.CLAMP);
    return {
      opacity: baseOp * pulse,
      transform: [
        {
          translateY: interpolate(enterT.value, [0, 0.72, 1], [10, 3, 0], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const ringStyle = useAnimatedStyle(() => {
    const t = enterT.value;
    const pulse = interpolate(logoIdle.value, [0, 1], [0.96, 1.08], Extrapolation.CLAMP);
    return {
      opacity: interpolate(t, [0.15, 0.5, 1], [0, 0.35, 0.22], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(t, [0, 1], [0.85, 1]) * pulse }],
    };
  });

  const loaderRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${loaderSpin.value * 360}deg` }],
    opacity: interpolate(enterT.value, [0, 0.25, 1], [0, 1, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={styles.center}>
        <View style={styles.hero}>
          <Animated.View style={[styles.ring, ringStyle]} />
          <Animated.View style={[styles.loaderTrack, loaderRingStyle]} />
          <Animated.View style={[styles.logoWrap, logoIntroStyle]}>
            <Image source={APP_ICON} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
          </Animated.View>
        </View>
        <Animated.Text style={[styles.title, titleStyle]}>RydAid</Animated.Text>
        <Animated.Text style={[styles.subtitle, subtitleStyle]}>Getting things ready…</Animated.Text>
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <SplashDot key={i} index={i} enterT={enterT} />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

function SplashDot({
  index,
  enterT,
}: {
  index: number;
  enterT: SharedValue<number>;
}) {
  const phase = useSharedValue(0);

  useEffect(() => {
    phase.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [phase]);

  const style = useAnimatedStyle(() => {
    const baseEnter = interpolate(enterT.value, [0, 0.55 + index * 0.08, 1], [0, 1, 1], Extrapolation.CLAMP);
    const wave = interpolate(phase.value, [0, 1], [0, -7], Extrapolation.CLAMP);
    const stagger = Math.sin(phase.value * Math.PI + index * 0.85);
    return {
      opacity: interpolate(baseEnter, [0, 1], [0, 0.35 + index * 0.2]),
      transform: [{ translateY: wave + stagger * 3.5 }],
    };
  });

  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    backgroundColor: '#f8fafc',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  hero: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  loaderTrack: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 4,
    borderColor: '#e2e8f0',
    borderTopColor: '#0284c7',
    borderRightColor: '#38bdf8',
  },
  ring: {
    position: 'absolute',
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 2,
    borderColor: 'rgba(2, 132, 199, 0.22)',
    backgroundColor: 'rgba(240, 249, 255, 0.5)',
  },
  logoWrap: {
    marginBottom: 0,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '600',
    color: '#0284c7',
  },
  dots: {
    flexDirection: 'row',
    marginTop: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94a3b8',
    marginHorizontal: 4,
  },
});
