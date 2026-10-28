import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { HelpRequest } from '../api/helpRequests';

type Props = {
  progress: NonNullable<HelpRequest['search_progress']>;
};

export function HelpSearchProgressCard({ progress }: Props) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.card}>
      <Text style={styles.message}>{progress.message}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, progress.progress_percent)}%` }]} />
      </View>
      <Text style={styles.meta}>
        Step {progress.current_wave} of {progress.total_waves} · up to {progress.search_radius_km_max} km
      </Text>
      <View style={styles.stats}>
        <Stat label="Notified" value={progress.mechanics_notified_total} />
        <Stat label="Awaiting reply" value={progress.mechanics_awaiting_response} highlight />
        <Stat label="Declined" value={progress.mechanics_declined} />
      </View>
      <Animated.Text style={[styles.hint, { opacity: pulse }]}>
        A mechanic must accept before you see their profile.
      </Animated.Text>
    </View>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  message: { fontSize: 16, fontWeight: '600', color: '#0f172a', lineHeight: 22 },
  track: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginTop: 14,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: '#0284c7', borderRadius: 4 },
  meta: { marginTop: 8, fontSize: 13, color: '#64748b' },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  statValueHighlight: { color: '#0284c7' },
  statLabel: { fontSize: 11, color: '#64748b', marginTop: 4, textAlign: 'center' },
  hint: { marginTop: 14, fontSize: 13, color: '#0369a1', textAlign: 'center' },
});
