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
};

function clampKm(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function SearchRadiusSelector({
  valueKm,
  onChangeKm,
  minKm = MIN_KM,
  maxKm = MAX_KM,
}: Props) {
  const km = clampKm(valueKm, minKm, maxKm);

  const hint = useMemo(() => {
    if (km <= 2) return 'Very close — best for dense areas';
    if (km <= 5) return 'Good for neighborhood search';
    if (km <= 8) return 'Wider area — more mechanics may appear';

    return 'Maximum range (10 km)';
  }, [km]);

  const setKm = (next: number) => onChangeKm(clampKm(next, minKm, maxKm));

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View>
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
          style={[styles.stepBtn, km <= minKm && styles.stepBtnDisabled]}
          onPress={() => setKm(km - 1)}
          disabled={km <= minKm}
          accessibilityLabel="Decrease search radius"
        >
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>

        <View style={styles.sliderWrap}>
          <Slider
            style={styles.slider}
            minimumValue={minKm}
            maximumValue={maxKm}
            step={1}
            value={km}
            onValueChange={(v) => setKm(v)}
            minimumTrackTintColor="#0284c7"
            maximumTrackTintColor="#e2e8f0"
            thumbTintColor="#0284c7"
          />
          <View style={styles.tickRow}>
            {Array.from({ length: maxKm - minKm + 1 }, (_, i) => minKm + i).map((tick) => (
              <Pressable
                key={tick}
                style={styles.tickHit}
                onPress={() => setKm(tick)}
                accessibilityLabel={`${tick} kilometers`}
              >
                <View style={[styles.tickDot, tick <= km && styles.tickDotActive]} />
                <Text style={[styles.tickLabel, tick === km && styles.tickLabelActive]}>{tick}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          style={[styles.stepBtn, km >= maxKm && styles.stepBtnDisabled]}
          onPress={() => setKm(km + 1)}
          disabled={km >= maxKm}
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
    marginBottom: 8,
  },
  label: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  hint: { fontSize: 13, color: '#64748b', marginTop: 4, maxWidth: 220 },
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
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
    marginTop: -4,
    paddingHorizontal: 4,
  },
  tickHit: { alignItems: 'center', minWidth: 22 },
  tickDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
    marginBottom: 2,
  },
  tickDotActive: { backgroundColor: '#0284c7' },
  tickLabel: { fontSize: 10, color: '#94a3b8' },
  tickLabelActive: { color: '#0284c7', fontWeight: '700' },
});
