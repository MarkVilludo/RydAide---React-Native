import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDistanceKm } from '../utils/distanceKm';

type Props = {
  distanceKm?: number | null;
};

export function HelpRequestMapLegend({ distanceKm }: Props) {
  const label = formatDistanceKm(distanceKm);
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.pin}>📍</Text>
        <Text style={styles.text}>You (mechanic)</Text>
      </View>
      {label ? <Text style={styles.distance}>{label}</Text> : null}
      <Text style={styles.arrow}>↓</Text>
      <View style={styles.row}>
        <Text style={styles.pin}>📍</Text>
        <Text style={styles.text}>Customer</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pin: { fontSize: 16 },
  text: { fontWeight: '600', color: '#334155' },
  distance: { fontWeight: '700', color: '#0284c7', marginVertical: 4 },
  arrow: { fontSize: 18, color: '#94a3b8' },
});
