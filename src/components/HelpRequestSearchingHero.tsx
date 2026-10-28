import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { formatElapsedSeconds } from '../utils/formatElapsed';

type Props = {
  /** ISO timestamp when the search started (e.g. help request created_at). */
  startedAt: string;
};

function PulseRings() {
  const rings = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    const animations = rings.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 500),
          Animated.timing(value, {
            toValue: 1,
            duration: 2200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [rings]);

  return (
    <View style={ringStyles.wrap} pointerEvents="none">
      {rings.map((value, i) => {
        const scale = value.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.4] });
        const opacity = value.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.5, 0] });
        return (
          <Animated.View key={i} style={[ringStyles.ring, { transform: [{ scale }], opacity }]} />
        );
      })}
      <View style={ringStyles.dotOuter}>
        <View style={ringStyles.dotInner} />
      </View>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  wrap: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: '#0284c7',
  },
  dotOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(2, 132, 199, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0284c7' },
});

/** Animated radar + live wait timer while mechanics are being notified. */
export function HelpRequestSearchingHero({ startedAt }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  useEffect(() => {
    const startMs = new Date(startedAt).getTime();
    const tick = () => {
      if (Number.isNaN(startMs)) {
        setElapsed(0);
        return;
      }
      setElapsed(Math.floor((Date.now() - startMs) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <Animated.View style={[styles.card, { opacity: fade }]}>
      <View style={styles.row}>
        <PulseRings />
        <View style={styles.textCol}>
          <Text style={styles.title}>Searching nearby mechanics</Text>
          <Text style={styles.timerLabel}>Waiting time</Text>
          <Text style={styles.timer}>{formatElapsedSeconds(elapsed)}</Text>
          <Text style={styles.sub}>We notify verified providers until someone accepts.</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  textCol: { flex: 1 },
  title: { fontSize: 16, fontWeight: '800', color: '#0c4a6e' },
  timerLabel: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '700',
    color: '#0369a1',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  timer: { fontSize: 32, fontWeight: '800', color: '#0284c7', fontVariant: ['tabular-nums'] },
  sub: { marginTop: 6, fontSize: 13, color: '#475569', lineHeight: 18 },
});
