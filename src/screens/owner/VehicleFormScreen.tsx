import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { getApiErrorMessage } from '../../api/client';
import {
  createVehicle,
  deleteVehicle,
  isVehicleApiMissing,
  updateVehicle,
  vehicleDisplayLabel,
  vehicleFieldError,
  vehicleFormFromSaved,
} from '../../api/vehicles';
import { showAppToast } from '../../components/AppToast';
import { KeyboardAwareScrollView } from '../../components/KeyboardAwareScrollView';
import { VehicleFormFields } from '../../components/VehicleFormFields';
import type { OwnerStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { EMPTY_VEHICLE, vehicleErrors, type FieldErrors, type HelpVehicleForm } from '../../utils/helpVehicle';
import { confirmRemoveVehicle } from './MyVehiclesScreen';

type Props = NativeStackScreenProps<OwnerStackParamList, 'VehicleForm'>;

const SERVER_FIELDS: Array<[keyof FieldErrors, string]> = [
  ['type', 'type'],
  ['makeModel', 'make_model'],
  ['plate', 'plate_number'],
  ['year', 'year'],
];

/** Add or edit a saved vehicle — same fields, validation and copy as the HELP request vehicle step. */
export function VehicleFormScreen({ navigation, route }: Props) {
  const existing = route.params?.vehicle ?? null;
  const editing = existing != null;
  const [form, setForm] = useState<HelpVehicleForm>(() =>
    existing ? vehicleFormFromSaved(existing) : route.params?.prefill ?? { ...EMPTY_VEHICLE },
  );
  const [makeDefault, setMakeDefault] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setShowErrors(true);
    setServerErrors({});
    if (Object.keys(vehicleErrors(form)).length > 0) return;
    setSaving(true);
    try {
      const opts = makeDefault ? { is_default: true } : undefined;
      const saved = editing ? await updateVehicle(existing.id, form, opts) : await createVehicle(form, opts);
      showAppToast(editing ? 'Vehicle updated.' : `${vehicleDisplayLabel(saved)} saved to My vehicles.`);
      navigation.goBack();
    } catch (e) {
      if (isVehicleApiMissing(e)) {
        Alert.alert('Not available yet', 'Saving vehicles needs the latest server update. You can still type your vehicle when you request help.');
        return;
      }
      const fieldErrs: FieldErrors = {};
      for (const [key, apiKey] of SERVER_FIELDS) {
        const msg = vehicleFieldError(e, apiKey);
        if (msg) fieldErrs[key] = msg;
      }
      if (Object.keys(fieldErrs).length > 0) setServerErrors(fieldErrs);
      else Alert.alert('Could not save', vehicleFieldError(e, 'vehicle') ?? getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!existing) return;
    confirmRemoveVehicle(existing, async () => {
      setSaving(true);
      try {
        await deleteVehicle(existing.id);
        showAppToast(`${vehicleDisplayLabel(existing)} removed.`);
        navigation.goBack();
      } catch (e) {
        Alert.alert(
          'Could not remove',
          isVehicleApiMissing(e) ? 'Removing vehicles needs the latest server update.' : getApiErrorMessage(e),
        );
      } finally {
        setSaving(false);
      }
    });
  };

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>
          Only <Text style={styles.bold}>type</Text> and <Text style={styles.bold}>make & model</Text> are required. The rest
          helps the mechanic find you and bring the right tools.
        </Text>
        <VehicleFormFields
          value={form}
          onChange={(next) => {
            setForm(next);
            if (Object.keys(serverErrors).length) setServerErrors({});
          }}
          showErrors={showErrors}
          serverErrors={serverErrors}
        />

        {!existing?.is_default ? (
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text style={styles.switchTitle}>Use as my default vehicle</Text>
              <Text style={styles.switchSub}>It’s picked for you when you request help.</Text>
            </View>
            <Switch
              value={makeDefault}
              onValueChange={setMakeDefault}
              trackColor={{ true: colors.primary, false: colors.border }}
              accessibilityLabel="Use as my default vehicle"
            />
          </View>
        ) : (
          <Text style={styles.defaultNote}>This is your default vehicle.</Text>
        )}

        {editing ? (
          <Pressable style={styles.removeBtn} onPress={remove} disabled={saving} accessibilityRole="button" accessibilityLabel="Remove this vehicle">
            <Text style={styles.removeText}>Remove this vehicle</Text>
          </Pressable>
        ) : null}
      </KeyboardAwareScrollView>
      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryBtn, saving && styles.btnDisabled]}
          disabled={saving}
          onPress={() => void save()}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryBtnText}>{editing ? 'Save changes' : 'Save vehicle'}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  flex: { flex: 1 },
  hint: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  bold: { fontWeight: '700', color: '#475569' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  switchSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  defaultNote: { marginTop: 18, fontSize: 13, color: colors.primaryInk, fontWeight: '700' },
  removeBtn: { marginTop: 20, minHeight: 44, justifyContent: 'center', alignSelf: 'center', paddingHorizontal: 16 },
  removeText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
  footer: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  primaryBtn: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: colors.onPrimary, fontSize: 16, fontWeight: '800' },
});
