import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { HelpRequestTracking } from '../api/helpRequests';
import { formatDistanceKm, formatMapDistanceKm, resolveTrackingDistanceKm } from '../utils/distanceKm';

type Props = {
  tracking?: HelpRequestTracking | null;
  mechanicPermissionDenied?: boolean;
  connectionLost?: boolean;
  viewerRole: 'owner' | 'mechanic';
  /** Single-line summary for active job one-pager layouts. */
  compact?: boolean;
  /** Used in compact mode when tracking has no distance yet (e.g. live GPS). */
  fallbackDistanceKm?: number | null;
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
  compact = false,
  fallbackDistanceKm,
}: Props) {
  const locStatus = tracking?.mechanic_location_status;
  const distanceLabel = useMemo(() => {
    const km = resolveTrackingDistanceKm(tracking) ?? fallbackDistanceKm;
    const format = viewerRole === 'owner' ? formatMapDistanceKm : formatDistanceKm;
    return format(km);
  }, [tracking, fallbackDistanceKm, viewerRole]);

  if (compact) {
    const parts: string[] = [];
    if (connectionLost) {
      parts.push('Connection lost');
    }
    if (distanceLabel) {
      parts.push(distanceLabel);
    }
    const eta = etaLine(tracking);
    if (viewerRole === 'mechanic' && eta) {
      parts.push(`ETA ${eta}`);
    }
    if (viewerRole === 'owner' && locStatus?.is_stale) {
      parts.push('Location updating…');
    }
    if (viewerRole === 'mechanic' && mechanicPermissionDenied) {
      parts.push('Turn on location to share live position');
    } else if (viewerRole === 'mechanic' && locStatus?.label && tracking?.live_tracking_enabled) {
      parts.push(locStatus.label);
    }
    if (parts.length === 0) {
      return null;
    }
    return (
      <Text style={styles.compactLine} numberOfLines={2}>
        {parts.join(' · ')}
      </Text>
    );
  }

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
      {viewerRole === 'mechanic' && etaLine(tracking) && (
        <Text style={styles.row}>
          <Text style={styles.label}>ETA: </Text>
          {etaLine(tracking)}
        </Text>
      )}
      {viewerRole === 'owner' && locStatus?.is_stale && (
        <Text style={[styles.row, styles.stale]}>Location updating…</Text>
      )}
      {tracking?.live_tracking_enabled && viewerRole === 'mechanic' && (
        <Text style={styles.row}>
          <Text style={styles.label}>Location: </Text>
          Live
        </Text>
      )}
      {viewerRole === 'mechanic' && mechanicPermissionDenied && (
        <Text style={styles.warning}>
          Location access is required so the customer can see your live distance on the map.
          Customer location is still visible below.
        </Text>
      )}
      {viewerRole === 'mechanic' && !mechanicPermissionDenied && locStatus?.label && (
        <Text style={styles.row}>
          <Text style={styles.label}>Your location: </Text>
          {tracking?.live_tracking_enabled ? locStatus.label : 'Sharing live location with customer'}
        </Text>
      )}
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
  compactLine: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 6 },
});
