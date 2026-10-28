import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { HelpRequestTracking } from '../api/helpRequests';
import { formatDistanceKm, resolveTrackingDistanceKm } from '../utils/distanceKm';

type Props = {
  tracking?: HelpRequestTracking | null;
  mechanicPermissionDenied?: boolean;
  connectionLost?: boolean;
  viewerRole: 'owner' | 'mechanic';
};

function etaLine(tracking: HelpRequestTracking | null | undefined) {
  if (!tracking?.eta) return null;
  const { label, minutes_min, minutes_max } = tracking.eta;
  if (label === 'Arrived' || label === 'Arriving') return label;
  return `${minutes_min}–${minutes_max} min`;
}

export function ActiveJobLocationSummary({
  tracking,
  mechanicPermissionDenied,
  connectionLost,
  viewerRole,
}: Props) {
  const locStatus = tracking?.mechanic_location_status;
  const distanceLabel = useMemo(() => formatDistanceKm(resolveTrackingDistanceKm(tracking)), [tracking]);

  return (
    <View style={styles.wrap}>
      {connectionLost && (
        <Text style={styles.connectionLost}>Connection lost — showing last known data</Text>
      )}
      {distanceLabel ? (
        <Text style={styles.row}>
          <Text style={styles.label}>Distance: </Text>
          {distanceLabel}
        </Text>
      ) : null}
      {etaLine(tracking) && (
        <Text style={styles.row}>
          <Text style={styles.label}>ETA: </Text>
          {etaLine(tracking)}
        </Text>
      )}
      {tracking?.live_tracking_enabled && (
        <Text style={styles.row}>
          <Text style={styles.label}>Location: </Text>
          Live
        </Text>
      )}
      {locStatus?.label && viewerRole === 'owner' && (
        <Text style={[styles.row, locStatus.is_stale && styles.stale]}>
          <Text style={styles.label}>Mechanic location: </Text>
          {locStatus.label}
        </Text>
      )}
      {viewerRole === 'mechanic' && mechanicPermissionDenied && (
        <Text style={styles.warning}>
          Location access is required to share your location with the customer while you are on the way.
          Customer location is still visible below.
        </Text>
      )}
      {viewerRole === 'mechanic' && !mechanicPermissionDenied && locStatus?.label && (
        <Text style={styles.row}>
          <Text style={styles.label}>Your location: </Text>
          {tracking?.live_tracking_enabled ? locStatus.label : 'Enable on the way to share live location'}
        </Text>
      )}
      {tracking?.eta_disclaimer && <Text style={styles.disclaimer}>{tracking.eta_disclaimer}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 10, gap: 4 },
  row: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  label: { color: '#64748b', fontWeight: '500' },
  stale: { color: '#b45309' },
  warning: { color: '#b45309', marginTop: 6, lineHeight: 20 },
  connectionLost: { color: '#dc2626', fontWeight: '600', marginBottom: 4 },
  disclaimer: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
});
