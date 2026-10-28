import Slider from '@react-native-community/slider';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const MIN_KM = 1;
const MAX_KM = 10;

type Props = {
  valueKm: number;
  onChangeKm: (km: number) => void;
  minKm?: number;
  maxKm?: number;
  /** From app-config; when set, slider snaps to these distances only. */
  radiusOptionsKm?: number[];
};

function clampKm(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function SearchRadiusSelector({
  valueKm,
  onChangeKm,
  minKm = MIN_KM,
  maxKm = MAX_KM,
  radiusOptionsKm,
}: Props) {
  const ticks = useMemo(() => {
    if (radiusOptionsKm?.length) {
      return radiusOptionsKm.filter((t) => t >= minKm && t <= maxKm);
    }
    return Array.from({ length: maxKm - minKm + 1 }, (_, i) => minKm + i);
  }, [maxKm, minKm, radiusOptionsKm]);

  const km = useMemo(() => {
    const clamped = clampKm(valueKm, minKm, maxKm);
    if (ticks.includes(clamped)) {
      return clamped;
    }
    const next = ticks.find((t) => t >= clamped);
    return next ?? ticks[ticks.length - 1] ?? clamped;
  }, [maxKm, minKm, ticks, valueKm]);

  const tickIndex = Math.max(0, ticks.indexOf(km));

  const hint = useMemo(() => {
    if (km <= 2) return 'Very close — best for dense areas';
    if (km <= 5) return 'Good for neighborhood search';
    if (km <= 8) return 'Wider area — more results may appear';

    return `Up to ${maxKm} km`;
  }, [km, maxKm]);

  const stepTick = (delta: number) => {
    const nextIndex = Math.min(ticks.length - 1, Math.max(0, tickIndex + delta));
    onChangeKm(ticks[nextIndex] ?? km);
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.labelBlock}>
          <Text style={styles.label}>Search distance</Text>
          <Text style={styles.hint}>{hint}</Text>
        </View>
        <View style={styles.valueBlock}>
          <Text style={styles.valueNumber}>{km}</Text>
          <Text style={styles.valueUnit}>km</Text>
        </View>
      </View>

      <View style={styles.stepperRow}>
        <Pressable
          style={[styles.stepBtn, tickIndex <= 0 && styles.stepBtnDisabled]}
          onPress={() => stepTick(-1)}
          disabled={tickIndex <= 0}
          accessibilityLabel="Decrease search radius"
        >
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>

        <View style={styles.sliderWrap}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={Math.max(0, ticks.length - 1)}
            step={1}
            value={tickIndex}
            onValueChange={(index) => onChangeKm(ticks[Math.round(index)] ?? km)}
            minimumTrackTintColor="#0284c7"
            maximumTrackTintColor="#e2e8f0"
            thumbTintColor="#0284c7"
          />
          <View style={styles.tickRow}>
            {ticks.map((tick) => (
              <Text
                key={tick}
                style={[styles.microLabel, tick === km && styles.microLabelActive]}
              >
                {tick}
              </Text>
            ))}
          </View>
        </View>

        <Pressable
          style={[styles.stepBtn, tickIndex >= ticks.length - 1 && styles.stepBtnDisabled]}
          onPress={() => stepTick(1)}
          disabled={tickIndex >= ticks.length - 1}
          accessibilityLabel="Increase search radius"
        >
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export const SEARCH_RADIUS_MIN_KM = MIN_KM;
export const SEARCH_RADIUS_MAX_KM = MAX_KM;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  labelBlock: { flex: 1, paddingRight: 12 },
  label: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  hint: { fontSize: 13, color: '#64748b', marginTop: 4 },
  valueBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  valueNumber: { fontSize: 32, fontWeight: '800', color: '#0284c7', lineHeight: 36 },
  valueUnit: { fontSize: 15, fontWeight: '600', color: '#0369a1', marginLeft: 4 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stepBtnDisabled: { opacity: 0.35 },
  stepBtnText: { fontSize: 22, fontWeight: '600', color: '#0284c7', marginTop: -2 },
  sliderWrap: { flex: 1 },
  slider: { width: '100%', height: 36 },
  tickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: -2,
  },
  microLabel: { fontSize: 10, color: '#94a3b8', minWidth: 16, textAlign: 'center' },
  microLabelActive: { color: '#0284c7', fontWeight: '700' },
});
