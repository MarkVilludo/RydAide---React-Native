import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { servicePinManualSaveHint } from '../constants/servicePinMessages';
import { useServicePinMaxOffsetMeters } from '../hooks/useMechanicDistanceOrigin';
import { MechanicLocationMapPreview } from './MechanicLocationMapPreview';

export type SavedWorkLocation = {
  latitude: number;
  longitude: number;
  address: string | null;
};

type Props = {
  saved: SavedWorkLocation | null;
  deviceLatitude: number | null;
  deviceLongitude: number | null;
  permissionDenied: boolean;
  onEditMap: () => void;
  onUseDeviceLocation: () => void;
  deviceSaveBusy?: boolean;
  embedded?: boolean;
  /** Dashboard map preview height. Omit with embedded to fill remaining space. */
  mapHeight?: number;
  /** True when the saved pin was placed by hand on the map (vs. from GPS). */
  pinManual?: boolean;
  /** Hide the map preview (header + actions stay visible). */
  collapsed?: boolean;
  /** When set, shows a Show/Hide map toggle. */
  onToggleCollapsed?: () => void;
};

const ADDRESS_NOISE = /^(philippines|metro manila|ncr|national capital region|\d{3,5})$/i;

/**
 * Short, readable area label from a geocoded address, e.g.
 * "Quezon Boulevard, Quiapo, Manila, Metro Manila, 1001, Philippines" → "Quiapo, Manila".
 */
export function shortAreaLabel(address: string | null | undefined): string | null {
  const parts = (address ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p !== '' && !ADDRESS_NOISE.test(p));
  if (parts.length === 0) return null;
  if (parts.length >= 3) return `${parts[1]}, ${parts[2]}`;
  return parts.slice(0, 2).join(', ');
}

export function MechanicDashboardLocationCard({
  saved,
  deviceLatitude,
  deviceLongitude,
  permissionDenied,
  onEditMap,
  onUseDeviceLocation,
  deviceSaveBusy,
  embedded,
  mapHeight,
  pinManual,
  collapsed,
  onToggleCollapsed,
}: Props) {
  const maxOffsetMeters = useServicePinMaxOffsetMeters();
  const fillMap = embedded && mapHeight == null;
  const previewHeight = mapHeight ?? (embedded ? 260 : 160);
  const preview = useMemo(() => {
    if (saved) {
      return saved;
    }
    if (deviceLatitude != null && deviceLongitude != null) {
      return { latitude: deviceLatitude, longitude: deviceLongitude };
    }
    return null;
  }, [saved, deviceLatitude, deviceLongitude]);

  const fullAddress = saved?.address?.trim() || null;
  const areaLabel =
    shortAreaLabel(fullAddress) ??
    (preview ? `${preview.latitude.toFixed(4)}, ${preview.longitude.toFixed(4)}` : null);
  const sourceLabel = saved
    ? pinManual
      ? 'Service pin · set on map'
      : 'Service pin · from GPS'
    : preview
      ? 'Current location · not saved yet'
      : 'Service pin';
  const showHeaderTitle = embedded;
  const gpsLabel = deviceSaveBusy ? 'Saving…' : 'Use my location';

  return (
    <View style={embedded ? (fillMap ? styles.embedded : styles.embeddedCompact) : styles.card}>
      <View style={[styles.headRow, embedded && styles.headRowEmbedded]}>
        <View style={styles.headCopy}>
          {!embedded ? <Text style={styles.title}>Service pin</Text> : null}
          {showHeaderTitle ? (
            <Text style={styles.eyebrow} numberOfLines={1}>
              {sourceLabel}
            </Text>
          ) : null}
          {areaLabel ? (
            <Text
              style={[styles.address, embedded && styles.addressEmbedded]}
              numberOfLines={1}
              accessibilityLabel={fullAddress ? `Service pin: ${fullAddress}` : `Service pin: ${areaLabel}`}
            >
              {areaLabel}
            </Text>
          ) : (
            <Text style={[styles.placeholder, embedded && styles.placeholderEmbedded]} numberOfLines={1}>
              {permissionDenied ? 'Turn on location to set your pin' : 'Finding your location…'}
            </Text>
          )}
        </View>
        {onToggleCollapsed ? (
          <Pressable
            style={styles.toggleBtn}
            onPress={onToggleCollapsed}
            accessibilityRole="button"
            accessibilityLabel={collapsed ? 'Show map' : 'Hide map'}
            hitSlop={8}
          >
            <Text style={styles.toggleText}>{collapsed ? 'Show map' : 'Hide map'}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          style={({ pressed }) => [styles.miniBtn, pressed && styles.pressed]}
          onPress={onEditMap}
          accessibilityRole="button"
          accessibilityLabel="Adjust service pin on the map"
        >
          <Text style={styles.miniBtnText}>Adjust pin</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.miniBtn,
            styles.miniBtnPrimary,
            (deviceSaveBusy || permissionDenied) && styles.miniBtnOff,
            pressed && styles.pressed,
          ]}
          onPress={onUseDeviceLocation}
          disabled={deviceSaveBusy || permissionDenied}
          accessibilityRole="button"
          accessibilityLabel="Use my current GPS location as my service pin"
          accessibilityState={{ disabled: Boolean(deviceSaveBusy || permissionDenied), busy: Boolean(deviceSaveBusy) }}
        >
          <Text style={[styles.miniBtnText, styles.miniBtnTextPrimary]}>{gpsLabel}</Text>
        </Pressable>
      </View>

      {!embedded ? (
        <Text style={styles.pinHint} numberOfLines={2}>
          {servicePinManualSaveHint(maxOffsetMeters)}
        </Text>
      ) : null}

      {collapsed ? null : preview ? (
        <Pressable
          onPress={onEditMap}
          style={[styles.mapPress, fillMap && styles.mapPressFill]}
          accessibilityRole="button"
          accessibilityLabel="Map of your service pin. Tap to adjust"
        >
          <MechanicLocationMapPreview
            latitude={preview.latitude}
            longitude={preview.longitude}
            height={fillMap ? undefined : previewHeight}
            fill={fillMap}
          />
        </Pressable>
      ) : (
        <Pressable
          style={[
            styles.emptyMap,
            fillMap ? styles.emptyMapFill : { height: Math.min(previewHeight, 200) },
          ]}
          onPress={onEditMap}
          accessibilityRole="button"
          accessibilityLabel="Set your service pin"
        >
          <Text style={styles.emptyMapText}>Set pin</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  embedded: {
    flex: 1,
    minHeight: 0,
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  embeddedCompact: {
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  pressed: { opacity: 0.85 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headRowEmbedded: { marginBottom: 2 },
  headCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 13, fontWeight: '800', color: '#64748b' },
  eyebrow: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  pinHint: { fontSize: 12, lineHeight: 17, color: '#64748b', marginTop: 6 },
  toggleBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  toggleText: { fontSize: 12, fontWeight: '700', color: '#0369a1' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  miniBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  miniBtnPrimary: { backgroundColor: '#e0f2fe' },
  miniBtnOff: { opacity: 0.45 },
  miniBtnText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  miniBtnTextPrimary: { color: '#0369a1' },
  address: { marginTop: 2, fontSize: 12, color: '#334155', fontWeight: '500' },
  addressEmbedded: { marginTop: 1, fontSize: 14, color: '#0f172a', fontWeight: '700' },
  placeholder: { marginTop: 2, fontSize: 12, color: '#94a3b8' },
  placeholderEmbedded: { marginTop: 1, color: '#94a3b8' },
  mapPress: { marginTop: 8, borderRadius: 12, overflow: 'hidden' },
  mapPressFill: { flex: 1, minHeight: 0, marginTop: 8, borderRadius: 14 },
  emptyMap: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMapFill: { flex: 1, minHeight: 0 },
  emptyMapText: { color: '#0284c7', fontWeight: '700', fontSize: 13 },
});
