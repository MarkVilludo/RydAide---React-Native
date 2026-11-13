import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { getApiErrorMessage } from '../../api/client';
import {
  createVehicle,
  defaultVehicleOf,
  fetchOwnerVehicles,
  savedVehicleDetailsLine,
  vehicleDisplayLabel,
  vehicleFormFromSaved,
  type OwnerVehicle,
} from '../../api/vehicles';
import { VehicleFormFields } from '../../components/VehicleFormFields';
import { showAppToast } from '../../components/AppToast';
import { EMPTY_VEHICLE, vehicleDetailsLine, vehicleErrors, vehicleTypeMeta, type HelpVehicleForm } from '../../utils/helpVehicle';

type Props = {
  value: HelpVehicleForm;
  onChange: (next: HelpVehicleForm) => void;
  vehicleId: number | null;
  onVehicleIdChange: (id: number | null) => void;
  /** Show inline errors (after the owner taps Continue). */
  showErrors: boolean;
  /** Last vehicle typed on this device, offered as a one-tap fill. */
  remembered: HelpVehicleForm | null;
  onForgetRemembered: () => void;
  /** "Save this vehicle" to My vehicles after the request is sent (typed vehicles only). */
  /** null = owner hasn't chosen yet (turned on automatically when they have no saved vehicles). */
  saveToGarage: boolean | null;
  onSaveToGarageChange: (on: boolean) => void;
  /** Opens My vehicles. */
  onManageVehicles: () => void;
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

export function NeedHelpVehicleStep({
  value,
  onChange,
  vehicleId,
  onVehicleIdChange,
  showErrors,
  remembered,
  onForgetRemembered,
  saveToGarage,
  onSaveToGarageChange,
  onManageVehicles,
}: Props) {
  const [vehicles, setVehicles] = useState<OwnerVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingRemembered, setSavingRemembered] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  const vehicleIdRef = useRef(vehicleId);
  vehicleIdRef.current = vehicleId;
  const firstLoad = useRef(true);
  const saveChoiceRef = useRef(saveToGarage);
  saveChoiceRef.current = saveToGarage;

  const loadVehicles = useCallback((quiet = false) => {
    if (!quiet) setLoading(true);
    setLoadError(null);
    fetchOwnerVehicles()
      .then((list) => {
        setVehicles(list);
        const picked = vehicleIdRef.current;
        if (picked != null) {
          // Back from My vehicles: keep the pick in sync with edits, or drop it if it was removed.
          const still = list.find((v) => v.id === picked);
          if (still) onChange({ ...vehicleFormFromSaved(still) });
          else {
            onVehicleIdChange(null);
            onChange({ ...EMPTY_VEHICLE });
          }
        } else if (!valueRef.current.makeModel.trim()) {
          // Nothing typed yet → pre-select the default vehicle (or the only one).
          const def = defaultVehicleOf(list);
          if (def) {
            onVehicleIdChange(def.id);
            onChange(vehicleFormFromSaved(def));
          }
        }
        // First visit with no saved vehicles: offer to keep this one for next time.
        if (list.length === 0 && saveChoiceRef.current === null) onSaveToGarageChange(true);
        firstLoad.current = false;
      })
      .catch((err) => {
        if (!quiet) setVehicles([]);
        setLoadError(getApiErrorMessage(err));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parent setters are stable
  }, []);

  // Load on first show and refresh quietly when coming back from My vehicles.
  useFocusEffect(
    useCallback(() => {
      loadVehicles(!firstLoad.current);
    }, [loadVehicles]),
  );

  const pickSaved = (v: OwnerVehicle) => {
    onVehicleIdChange(v.id);
    onChange(vehicleFormFromSaved(v));
  };

  const typeManually = () => {
    onVehicleIdChange(null);
    onChange({ ...EMPTY_VEHICLE, type: value.type });
  };

  const useRemembered = () => {
    if (!remembered) return;
    onVehicleIdChange(null);
    onChange(remembered);
  };

  const saveRemembered = async () => {
    if (!remembered || savingRemembered) return;
    if (Object.keys(vehicleErrors(remembered)).length > 0) {
      // Old memory missing a required field — let the owner finish it in the form.
      useRemembered();
      showAppToast('Check the details, then turn on “Save this vehicle”.');
      return;
    }
    setSavingRemembered(true);
    try {
      const saved = await createVehicle(remembered);
      onForgetRemembered();
      setVehicles((list) => [...list, saved]);
      onSaveToGarageChange(false);
      pickSaved(saved);
      showAppToast('Saved to My vehicles.');
    } catch (err) {
      showAppToast(getApiErrorMessage(err));
    } finally {
      setSavingRemembered(false);
    }
  };

  const showRememberedOffer =
    remembered != null &&
    vehicleId == null &&
    remembered.makeModel.trim().toLowerCase() !== value.makeModel.trim().toLowerCase() &&
    !vehicles.some((v) => vehicleDisplayLabel(v).toLowerCase() === remembered.makeModel.trim().toLowerCase());

  // Saving needs a working vehicles endpoint; hide the toggle when the list couldn't load.
  const canSave = vehicleId == null && !loading && !loadError;

  return (
    <View>
      <Text style={styles.title}>Which vehicle needs help?</Text>
      <Text style={styles.hint}>
        Only <Text style={styles.bold}>type</Text> and <Text style={styles.bold}>make & model</Text> are required. The
        rest helps the mechanic find you and bring the right tools.
      </Text>

      {loading ? (
        <ActivityIndicator style={{ marginVertical: 12 }} color={C.brand} />
      ) : loadError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Couldn’t load your saved vehicles. You can still type one below.</Text>
          <Pressable
            style={styles.smallBtn}
            onPress={() => loadVehicles()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading saved vehicles"
          >
            <Text style={styles.smallBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : vehicles.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>Your saved vehicles</Text>
            <Pressable onPress={onManageVehicles} style={styles.manage} accessibilityRole="button" accessibilityLabel="Manage vehicles">
              <Text style={styles.manageText}>Manage vehicles</Text>
            </Pressable>
          </View>
          {vehicles.map((v) => {
            const selected = vehicleId === v.id;
            const meta = vehicleTypeMeta(vehicleFormFromSaved(v).type);
            return (
              <Pressable
                key={v.id}
                style={[styles.savedCard, selected && styles.savedCardOn]}
                onPress={() => pickSaved(v)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${vehicleDisplayLabel(v)}${v.plate_number ? `, plate ${v.plate_number}` : ''}${v.is_default ? ', default' : ''}`}
              >
                <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
                <View style={{ flex: 1 }}>
                  <View style={styles.savedTitleRow}>
                    <Text style={styles.savedTitle} numberOfLines={1}>
                      {meta ? `${meta.icon} ` : ''}
                      {vehicleDisplayLabel(v)}
                    </Text>
                    {v.is_default ? <Text style={styles.defaultTag}>Default</Text> : null}
                  </View>
                  <Text style={styles.savedSub} numberOfLines={1}>
                    {savedVehicleDetailsLine(v) || 'Saved vehicle'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          <Pressable
            style={[styles.savedCard, vehicleId == null && styles.savedCardOn]}
            onPress={typeManually}
            accessibilityRole="radio"
            accessibilityState={{ checked: vehicleId == null }}
            accessibilityLabel="A different vehicle"
          >
            <View style={[styles.radio, vehicleId == null && styles.radioOn]}>
              {vehicleId == null ? <View style={styles.radioDot} /> : null}
            </View>
            <Text style={styles.savedTitle}>A different vehicle</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={onManageVehicles} style={styles.manageSolo} accessibilityRole="button" accessibilityLabel="Manage vehicles">
          <Text style={styles.manageText}>Manage vehicles</Text>
        </Pressable>
      )}

      {showRememberedOffer ? (
        <View style={styles.remember}>
          <Pressable
            style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}
            onPress={useRemembered}
            accessibilityRole="button"
            accessibilityLabel={`Use your last vehicle, ${remembered!.makeModel}`}
          >
            <Text style={styles.rememberTitle}>Use your last vehicle</Text>
            <Text style={styles.rememberSub} numberOfLines={1}>
              {remembered!.makeModel}
              {vehicleDetailsLine(remembered!) ? ` · ${vehicleDetailsLine(remembered!)}` : ''}
            </Text>
            {!loadError && !loading ? (
              <Pressable
                onPress={saveRemembered}
                disabled={savingRemembered}
                style={styles.rememberSave}
                accessibilityRole="button"
                accessibilityLabel="Save last vehicle to My vehicles"
              >
                <Text style={styles.rememberSaveText}>{savingRemembered ? 'Saving…' : 'Save to My vehicles'}</Text>
              </Pressable>
            ) : null}
          </Pressable>
          <Pressable onPress={onForgetRemembered} style={styles.forget} accessibilityRole="button" accessibilityLabel="Forget last vehicle">
            <Text style={styles.forgetText}>Forget</Text>
          </Pressable>
        </View>
      ) : null}

      <VehicleFormFields
        value={value}
        onChange={onChange}
        showErrors={showErrors}
        locked={vehicleId != null}
        onMakeModelEdit={() => {
          if (vehicleId != null) onVehicleIdChange(null);
        }}
      />

      {canSave ? (
        <View style={styles.saveRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.saveTitle}>Save this vehicle</Text>
            <Text style={styles.saveSub}>Add it to My vehicles so your next request is faster.</Text>
          </View>
          <Switch
            value={saveToGarage === true}
            onValueChange={onSaveToGarageChange}
            trackColor={{ true: C.brand, false: C.line }}
            accessibilityLabel="Save this vehicle to My vehicles"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '800', color: C.ink, marginBottom: 6 },
  hint: { fontSize: 14, color: C.faint, lineHeight: 20, marginBottom: 12 },
  bold: { fontWeight: '700', color: C.muted },
  section: { marginBottom: 4 },
  sectionLabel: { fontWeight: '700', color: C.muted, marginBottom: 8, fontSize: 13 },
  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  savedCardOn: { borderColor: C.brand, backgroundColor: C.brandSoft },
  savedTitle: { fontSize: 15, fontWeight: '700', color: C.ink },
  savedSub: { fontSize: 13, color: C.faint, marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: C.brand },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: C.brand },
  remember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginTop: 4,
  },
  rememberTitle: { fontSize: 14, fontWeight: '800', color: C.brandDark },
  rememberSub: { fontSize: 13, color: C.muted, marginTop: 1 },
  forget: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  forgetText: { color: C.faint, fontWeight: '700', fontSize: 13 },
  errorBox: {
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 12,
  },
  errorText: { color: '#b91c1c', fontSize: 14, marginBottom: 8 },
  smallBtn: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#b91c1c',
  },
  smallBtnText: { color: '#b91c1c', fontWeight: '700' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  manage: { minHeight: 44, justifyContent: 'center', paddingLeft: 8, marginTop: -8 },
  manageSolo: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginBottom: 4 },
  manageText: { color: C.brandDark, fontWeight: '700', fontSize: 13 },
  savedTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  defaultTag: {
    fontSize: 11,
    fontWeight: '800',
    color: C.brandDark,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  rememberSave: { minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start' },
  rememberSaveText: { color: C.brand, fontWeight: '800', fontSize: 13 },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  saveTitle: { fontSize: 15, fontWeight: '700', color: C.ink },
  saveSub: { fontSize: 13, color: C.faint, marginTop: 2 },
});
