import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDistanceKm } from '../utils/distanceKm';

type Props = {
  distanceKm: number | null | undefined;
  compact?: boolean;
  locationUnavailable?: boolean;
  fromServicePin?: boolean;
};

export function MechanicCustomerDistance({
  distanceKm,
  compact,
  locationUnavailable,
  fromServicePin,
}: Props) {
  const label = formatDistanceKm(distanceKm);

  if (label) {
    return (
      <View style={[styles.wrap, compact && styles.wrapCompact]}>
        <Text style={styles.value}>{label}</Text>
        <Text style={styles.sub}>
          {fromServicePin ? 'From your service pin to the customer' : 'From you to the customer'}
        </Text>
      </View>
    );
  }

  if (locationUnavailable) {
    return (
      <View style={[styles.wrap, styles.wrapMuted, compact && styles.wrapCompact]}>
        <Text style={styles.unavailable}>Turn on location to see your distance to this customer.</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  wrapCompact: {
    marginBottom: 8,
    paddingVertical: 8,
  },
  wrapMuted: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  value: { fontSize: 22, fontWeight: '800', color: '#0369a1' },
  sub: { fontSize: 13, color: '#0284c7', marginTop: 2, fontWeight: '600' },
  unavailable: { fontSize: 13, color: '#64748b', lineHeight: 18 },
});
