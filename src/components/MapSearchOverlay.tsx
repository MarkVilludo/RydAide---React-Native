import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  message?: string;
  submessage?: string;
};

/** Grab-style pulsing overlay while searching on the map. */
export function MapSearchOverlay({ visible, message = 'Searching nearby…', submessage }: Props) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.6, duration: 1200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.15, duration: 1200, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.45, duration: 1200, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, opacity, scale]);

  if (!visible) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.pulse, { transform: [{ scale }], opacity }]} />
      <View style={styles.center}>
        <ActivityIndicator color="#0284c7" size="large" />
        <Text style={styles.message}>{message}</Text>
        {submessage ? <Text style={styles.sub}>{submessage}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 250, 252, 0.55)',
    borderRadius: 12,
  },
  pulse: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#0284c7',
  },
  center: { alignItems: 'center', paddingHorizontal: 16 },
  message: { marginTop: 12, fontSize: 16, fontWeight: '700', color: '#0f172a' },
  sub: { marginTop: 4, fontSize: 13, color: '#64748b', textAlign: 'center' },
});
