import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  fetchOwnerVehicles,
  vehicleDisplayLabel,
  type OwnerVehicle,
} from '../../api/vehicles';
import { getApiErrorMessage } from '../../api/client';
import { VehicleSearchCombobox } from '../../components/VehicleSearchCombobox';

type Props = {
  value: string;
  onChange: (text: string) => void;
  vehicleId: number | null;
  onVehicleIdChange: (id: number | null) => void;
};

function vehicleToDescription(v: OwnerVehicle): string {
  const main = vehicleDisplayLabel(v);
  const plate = v.plate_number?.trim();
  if (plate) {
    return `${main} · ${plate}`;
  }
  return main;
}

export function NeedHelpVehicleStep({ value, onChange, vehicleId, onVehicleIdChange }: Props) {
  const [vehicles, setVehicles] = useState<OwnerVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadVehicles = () => {
    setLoading(true);
    setLoadError(null);
    fetchOwnerVehicles()
      .then((list) => {
        const active = list.filter((v) => v.is_active !== false);
        setVehicles(active);
        if (vehicleId == null && active.length === 1 && !value.trim()) {
          const only = active[0];
          onVehicleIdChange(only.id);
          onChange(vehicleToDescription(only));
        }
      })
      .catch((err) => {
        setVehicles([]);
        setLoadError(getApiErrorMessage(err));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const selectSaved = (v: OwnerVehicle) => {
    onVehicleIdChange(v.id);
    onChange(vehicleToDescription(v));
  };

  const useManualEntry = () => {
    onVehicleIdChange(null);
  };

  return (
    <View>
      <Text style={styles.title}>Which vehicle needs help?</Text>
      <Text style={styles.hint}>
        Choose a saved vehicle or enter make and model. Mechanics see this on your request.
      </Text>

      {loading ? (
        <ActivityIndicator style={{ marginVertical: 12 }} />
      ) : loadError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Could not load your vehicles. {loadError}</Text>
          <Pressable style={styles.retryBtn} onPress={loadVehicles}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : vehicles.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>Your vehicles</Text>
          <View style={styles.chips}>
            {vehicles.map((v) => {
              const selected = vehicleId === v.id;
              return (
                <Pressable
                  key={v.id}
                  style={[styles.chip, selected && styles.chipOn]}
                  onPress={() => selectSaved(v)}
                >
                  <Text style={[styles.chipText, selected && styles.chipOnText]} numberOfLines={2}>
                    {vehicleDisplayLabel(v)}
                    {v.plate_number?.trim() ? ` · ${v.plate_number.trim()}` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={useManualEntry} style={styles.manualLink}>
            <Text style={styles.manualLinkText}>
              {vehicleId != null ? 'Enter a different vehicle instead' : 'Or enter vehicle manually'}
            </Text>
          </Pressable>
        </>
      ) : null}

      {(vehicles.length === 0 || vehicleId == null) && (
        <View style={vehicleId == null && vehicles.length > 0 ? { marginTop: 8 } : undefined}>
          {vehicles.length > 0 ? <Text style={styles.sectionLabel}>Vehicle details</Text> : null}
          <VehicleSearchCombobox
            value={value}
            onChange={(text) => {
              onVehicleIdChange(null);
              onChange(text);
            }}
          />
          <Text style={styles.charCount}>{value.trim().length}/255</Text>
        </View>
      )}

      {vehicleId != null && value.trim() ? (
        <Text style={styles.selectedSummary}>Selected: {value.trim()}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  hint: { fontSize: 14, color: '#64748b', lineHeight: 20, marginBottom: 16 },
  sectionLabel: { fontWeight: '600', color: '#334155', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    maxWidth: '100%',
  },
  chipOn: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  chipText: { color: '#0f172a', fontWeight: '600', fontSize: 14 },
  chipOnText: { color: '#fff' },
  manualLink: { marginTop: 12, marginBottom: 4 },
  manualLinkText: { color: '#0284c7', fontWeight: '600', fontSize: 14 },
  charCount: { marginTop: 8, fontSize: 12, color: '#94a3b8', textAlign: 'right' },
  selectedSummary: { marginTop: 12, fontSize: 14, color: '#475569' },
  errorBox: {
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 12,
  },
  errorText: { color: '#b91c1c', fontSize: 14, marginBottom: 8 },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#b91c1c',
  },
  retryBtnText: { color: '#b91c1c', fontWeight: '700' },
});
