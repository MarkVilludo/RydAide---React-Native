import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { fetchVehicleLabelSuggestions } from '../api/catalog';
import {
  FUELS,
  TRANSMISSIONS,
  VEHICLE_TYPES,
  normalizePlate,
  plateFormatHint,
  vehicleDetailsLine,
  vehicleErrors,
  vehicleTypeMeta,
  type FieldErrors,
  type HelpVehicleForm,
} from '../utils/helpVehicle';

type Props = {
  value: HelpVehicleForm;
  onChange: (next: HelpVehicleForm) => void;
  /** Show inline errors (after the owner taps Continue / Save). */
  showErrors: boolean;
  /** Server-side messages per field (shown when there's no local error). */
  serverErrors?: FieldErrors;
  /** A saved vehicle is filling the fields: muted input, no catalog suggestions. */
  locked?: boolean;
  /** Called when the owner types in make & model (e.g. to unlink a picked saved vehicle). */
  onMakeModelEdit?: () => void;
  /** Heading of the live preview card. */
  summaryLabel?: string;
};

const C = {
  brand: '#0284c7',
  brandDark: '#0369a1',
  brandSoft: '#e0f2fe',
  ink: '#0f172a',
  muted: '#475569',
  faint: '#64748b',
  line: '#cbd5e1',
  bad: '#dc2626',
  warn: '#b45309',
};

/**
 * Vehicle fields shared by the HELP request vehicle step and My vehicles add/edit:
 * type tiles, make & model with catalog suggestions, plate (soft PH hint), color,
 * and optional year / transmission / fuel. Same copy and validation everywhere.
 */
export function VehicleFormFields({
  value,
  onChange,
  showErrors,
  serverErrors,
  locked = false,
  onMakeModelEdit,
  summaryLabel = 'Mechanics will see',
}: Props) {
  const [moreOpen, setMoreOpen] = useState(Boolean(value.year || value.transmission || value.fuel));
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const searchGen = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Open "More details" when a fill (saved / remembered vehicle) brings those fields in.
  useEffect(() => {
    if (value.year || value.transmission || value.fuel) setMoreOpen(true);
  }, [value.year, value.transmission, value.fuel]);

  const set = (patch: Partial<HelpVehicleForm>) => onChange({ ...valueRef.current, ...patch });
  const errors: FieldErrors = { ...(serverErrors ?? {}), ...(showErrors ? vehicleErrors(value) : {}) };
  const plateHint = !errors.plate ? plateFormatHint(value.plate) : null;
  const typeMeta = vehicleTypeMeta(value.type);

  // Make/model suggestions from the catalog (debounced).
  useEffect(() => {
    if (!suggestOpen || locked) return;
    const q = value.makeModel.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const gen = ++searchGen.current;
    const t = setTimeout(() => {
      fetchVehicleLabelSuggestions(q, 6)
        .then((labels) => gen === searchGen.current && setSuggestions(labels))
        .catch(() => gen === searchGen.current && setSuggestions([]));
    }, 280);
    return () => clearTimeout(t);
  }, [value.makeModel, suggestOpen, locked]);

  return (
    <View>
      {/* Type — required */}
      <Text style={styles.label}>
        Vehicle type <Text style={styles.req}>*</Text>
      </Text>
      <View style={styles.typeGrid} accessibilityRole="radiogroup">
        {VEHICLE_TYPES.map((t) => {
          const on = value.type === t.value;
          return (
            <Pressable
              key={t.value}
              style={[styles.typeChip, on && styles.typeChipOn]}
              onPress={() => set({ type: t.value })}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={t.label}
            >
              <Text style={styles.typeIcon}>{t.icon}</Text>
              <Text style={[styles.typeText, on && styles.typeTextOn]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {errors.type ? <Text style={styles.err}>{errors.type}</Text> : null}

      {/* Make & model — required */}
      <Text style={styles.label}>
        Make & model <Text style={styles.req}>*</Text>
      </Text>
      <TextInput
        style={[styles.input, errors.makeModel && styles.inputErr, locked && styles.inputLocked]}
        value={value.makeModel}
        onChangeText={(t) => {
          onMakeModelEdit?.();
          set({ makeModel: t });
          setSuggestOpen(true);
        }}
        onFocus={() => setSuggestOpen(true)}
        onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
        placeholder={`e.g. ${typeMeta?.example ?? 'Honda Click 125'}`}
        placeholderTextColor="#94a3b8"
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={120}
        returnKeyType="next"
        accessibilityLabel="Make and model, required"
      />
      {suggestOpen && suggestions.length > 0 && !locked ? (
        <View style={styles.suggest}>
          {suggestions.map((s) => (
            <Pressable
              key={s}
              style={styles.suggestRow}
              onPress={() => {
                set({ makeModel: s });
                setSuggestOpen(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Use ${s}`}
            >
              <Text style={styles.suggestText}>{s}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {errors.makeModel ? <Text style={styles.err}>{errors.makeModel}</Text> : null}

      {/* Plate + color — optional, most useful for finding the vehicle */}
      <View style={styles.row2}>
        <View style={{ flex: 1.2 }}>
          <Text style={styles.label}>
            Plate number <Text style={styles.opt}>(optional)</Text>
          </Text>
          <TextInput
            style={[styles.input, errors.plate && styles.inputErr]}
            value={value.plate}
            onChangeText={(t) => set({ plate: t.toUpperCase() })}
            onBlur={() => set({ plate: normalizePlate(valueRef.current.plate) })}
            placeholder="e.g. ABC 1234"
            placeholderTextColor="#94a3b8"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={16}
            accessibilityLabel="Plate number, optional"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>
            Color <Text style={styles.opt}>(optional)</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={value.color}
            onChangeText={(t) => set({ color: t })}
            placeholder="e.g. White"
            placeholderTextColor="#94a3b8"
            autoCapitalize="words"
            maxLength={40}
            accessibilityLabel="Color, optional"
          />
        </View>
      </View>
      {errors.plate ? <Text style={styles.err}>{errors.plate}</Text> : null}
      {plateHint ? <Text style={styles.warnText}>{plateHint}</Text> : null}

      <Pressable
        style={styles.moreToggle}
        onPress={() => setMoreOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: moreOpen }}
        accessibilityLabel="More details, optional: year, transmission, fuel"
      >
        <Text style={styles.moreToggleText}>
          {moreOpen ? '▾' : '▸'} More details (optional) · year, transmission, fuel
        </Text>
      </Pressable>

      {moreOpen ? (
        <View>
          <Text style={styles.label}>
            Year <Text style={styles.opt}>(optional)</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.yearInput, errors.year && styles.inputErr]}
            value={value.year}
            onChangeText={(t) => set({ year: t.replace(/\D/g, '').slice(0, 4) })}
            placeholder="e.g. 2018"
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
            maxLength={4}
            accessibilityLabel="Year, optional"
          />
          {errors.year ? <Text style={styles.err}>{errors.year}</Text> : null}

          <Text style={styles.label}>
            Transmission <Text style={styles.opt}>(optional)</Text>
          </Text>
          <View style={styles.chips}>
            {TRANSMISSIONS.map((o) => {
              const on = value.transmission === o.value;
              const label =
                o.value === 'AUTOMATIC' && (value.type === 'MOTORCYCLE' || value.type === 'TRICYCLE')
                  ? 'Automatic (scooter)'
                  : o.label;
              return (
                <Pressable
                  key={o.value}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => set({ transmission: on ? null : o.value })}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={label}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>
            Fuel <Text style={styles.opt}>(optional)</Text>
          </Text>
          <View style={styles.chips}>
            {FUELS.map((o) => {
              const on = value.fuel === o.value;
              return (
                <Pressable
                  key={o.value}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => set({ fuel: on ? null : o.value })}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={o.label}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {value.makeModel.trim().length >= 2 ? (
        <View style={styles.summary} accessible accessibilityLabel={`${summaryLabel}: ${value.makeModel}. ${vehicleDetailsLine(value)}`}>
          <Text style={styles.summaryLabel}>{summaryLabel}</Text>
          <Text style={styles.summaryTitle}>
            {typeMeta ? `${typeMeta.icon} ` : ''}
            {value.makeModel.trim()}
          </Text>
          {vehicleDetailsLine(value) ? <Text style={styles.summarySub}>{vehicleDetailsLine(value)}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: '700', color: C.ink, marginTop: 16, marginBottom: 8, fontSize: 14 },
  req: { color: C.bad },
  opt: { color: '#94a3b8', fontWeight: '600' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    width: '31.5%',
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  typeChipOn: { borderColor: C.brand, backgroundColor: C.brandSoft },
  typeIcon: { fontSize: 22 },
  typeText: { fontSize: 13, fontWeight: '700', color: C.muted, marginTop: 2 },
  typeTextOn: { color: C.brandDark },
  input: {
    minHeight: 48,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 15,
    color: C.ink,
  },
  inputErr: { borderColor: C.bad, borderWidth: 1.5 },
  inputLocked: { backgroundColor: '#f8fafc' },
  yearInput: { maxWidth: 140 },
  err: { color: C.bad, fontSize: 13, marginTop: 6, fontWeight: '600' },
  warnText: { color: C.warn, fontSize: 12, marginTop: 6, lineHeight: 17 },
  suggest: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  suggestRow: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  suggestText: { fontSize: 15, color: C.ink },
  row2: { flexDirection: 'row', gap: 10 },
  moreToggle: { minHeight: 44, justifyContent: 'center', marginTop: 10 },
  moreToggleText: { color: C.brandDark, fontWeight: '700', fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  chipOn: { borderColor: C.brand, backgroundColor: C.brandSoft },
  chipText: { fontSize: 14, fontWeight: '700', color: C.muted },
  chipTextOn: { color: C.brandDark },
  summary: {
    marginTop: 18,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
    borderLeftColor: C.brand,
  },
  summaryLabel: { fontSize: 11, fontWeight: '800', color: C.faint, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryTitle: { fontSize: 16, fontWeight: '800', color: C.ink, marginTop: 4 },
  summarySub: { fontSize: 13, color: C.muted, marginTop: 2 },
});
