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
  /** Dashboard map preview height (embedded layout). */
  mapHeight?: number;
};

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
}: Props) {
  const maxOffsetMeters = useServicePinMaxOffsetMeters();
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

  const addressLine =
    saved?.address?.trim() ||
    (preview ? `${preview.latitude.toFixed(4)}, ${preview.longitude.toFixed(4)}` : null);

  return (
    <View style={embedded ? styles.embedded : styles.card}>
      <View style={styles.headRow}>
        <Text style={styles.title}>Service pin</Text>
        <View style={styles.miniActions}>
          <Pressable style={styles.miniBtn} onPress={onEditMap}>
            <Text style={styles.miniBtnText}>Map</Text>
          </Pressable>
          <Pressable
            style={[styles.miniBtn, styles.miniBtnPrimary, (deviceSaveBusy || permissionDenied) && styles.miniBtnOff]}
            onPress={onUseDeviceLocation}
            disabled={deviceSaveBusy || permissionDenied}
          >
            <Text style={[styles.miniBtnText, styles.miniBtnTextPrimary]}>
              {deviceSaveBusy ? '…' : 'GPS'}
            </Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.pinHint}>{servicePinManualSaveHint(maxOffsetMeters)}</Text>

      {addressLine ? (
        <Text style={styles.address} numberOfLines={1}>
          {addressLine}
        </Text>
      ) : (
        <Text style={styles.placeholder}>
          {permissionDenied ? 'Enable location or set pin on map' : 'Locating…'}
        </Text>
      )}

      {preview ? (
        <Pressable onPress={onEditMap} style={styles.mapPress}>
          <MechanicLocationMapPreview
            latitude={preview.latitude}
            longitude={preview.longitude}
            height={previewHeight}
          />
        </Pressable>
      ) : (
        <Pressable style={[styles.emptyMap, { height: Math.min(previewHeight, 200) }]} onPress={onEditMap}>
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
    minHeight: 280,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  pinHint: { fontSize: 12, lineHeight: 17, color: '#64748b', marginTop: 6 },
  miniActions: { flexDirection: 'row', gap: 6 },
  miniBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  miniBtnPrimary: { backgroundColor: '#0284c7' },
  miniBtnOff: { opacity: 0.45 },
  miniBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  miniBtnTextPrimary: { color: '#fff' },
  address: { marginTop: 4, fontSize: 13, color: '#334155', fontWeight: '500' },
  placeholder: { marginTop: 4, fontSize: 12, color: '#94a3b8' },
  mapPress: { marginTop: 10, borderRadius: 12, overflow: 'hidden', flex: 1 },
  emptyMap: {
    marginTop: 10,
    flex: 1,
    minHeight: 160,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMapText: { color: '#0284c7', fontWeight: '700', fontSize: 13 },
});
