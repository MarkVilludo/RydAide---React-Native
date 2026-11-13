import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getApiErrorMessage } from '../../api/client';
import {
  deleteVehicle,
  fetchOwnerVehicles,
  isVehicleApiMissing,
  savedVehicleDetailsLine,
  savedVehicleType,
  setDefaultVehicle,
  vehicleDisplayLabel,
  type OwnerVehicle,
} from '../../api/vehicles';
import { showAppToast } from '../../components/AppToast';
import { CenteredLoading } from '../../components/CenteredLoading';
import { DrawerIcon } from '../../components/DrawerIcons';
import { RydAidRefreshControl } from '../../components/RydAidRefreshControl';
import type { OwnerStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { loadLastHelpVehicle, vehicleDetailsLine, vehicleTypeMeta, type HelpVehicleForm } from '../../utils/helpVehicle';

type Props = NativeStackScreenProps<OwnerStackParamList, 'MyVehicles'>;

type LoadState = 'loading' | 'ready' | 'error';

/** Confirm before removing a saved vehicle; says exactly what goes away and what stays. */
export function confirmRemoveVehicle(v: OwnerVehicle, onConfirm: () => void) {
  const name = vehicleDisplayLabel(v);
  const plate = v.plate_number?.trim() ? ` (${v.plate_number.trim()})` : '';
  Alert.alert(
    `Remove ${name}?`,
    `${name}${plate} will be removed from My vehicles and won’t be offered when you request help.` +
      (v.is_default ? ' Your next newest vehicle becomes the default.' : '') +
      ' Past requests that used it are kept.',
    [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onConfirm },
    ],
  );
}

/** Owner garage: saved vehicles with a default, used to fill help requests quickly. */
export function MyVehiclesScreen({ navigation }: Props) {
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<OwnerVehicle[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const { user } = useAuth();
  const [remembered, setRemembered] = useState<HelpVehicleForm | null>(null);

  React.useEffect(() => {
    let alive = true;
    void loadLastHelpVehicle(user?.id).then((v) => alive && setRemembered(v));
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setState('loading');
    try {
      setVehicles(await fetchOwnerVehicles());
      setError(null);
      setState('ready');
      setLoadedOnce(true);
    } catch (e) {
      setError(getApiErrorMessage(e));
      setState('error');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(loadedOnce);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh quietly after the first load
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const makeDefault = async (v: OwnerVehicle) => {
    setBusyId(v.id);
    try {
      await setDefaultVehicle(v.id);
      setVehicles((list) =>
        [...list.map((x) => ({ ...x, is_default: x.id === v.id }))].sort(
          (a, b) => Number(Boolean(b.is_default)) - Number(Boolean(a.is_default)),
        ),
      );
      showAppToast(`${vehicleDisplayLabel(v)} is now your default vehicle.`);
    } catch (e) {
      Alert.alert(
        'Could not update',
        isVehicleApiMissing(e) ? 'Default vehicles need the latest server update.' : getApiErrorMessage(e),
      );
    } finally {
      setBusyId(null);
    }
  };

  const remove = (v: OwnerVehicle) =>
    confirmRemoveVehicle(v, async () => {
      setBusyId(v.id);
      try {
        await deleteVehicle(v.id);
        showAppToast(`${vehicleDisplayLabel(v)} removed.`);
        await load(true);
      } catch (e) {
        Alert.alert(
          'Could not remove',
          isVehicleApiMissing(e) ? 'Removing vehicles needs the latest server update.' : getApiErrorMessage(e),
        );
      } finally {
        setBusyId(null);
      }
    });

  const add = () => navigation.navigate('VehicleForm', undefined);

  if (state === 'loading') return <CenteredLoading message="Loading your vehicles…" />;

  if (state === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Couldn’t load your vehicles</Text>
        <Text style={styles.emptySub}>{error}</Text>
        <Pressable style={styles.primaryBtn} onPress={() => void load()} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RydAidRefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        {vehicles.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <DrawerIcon name="car" size={32} color={colors.primary} bg={colors.primarySoft} />
            </View>
            <Text style={styles.emptyTitle}>No vehicles yet</Text>
            <Text style={styles.emptySub}>Add one so help requests are faster.</Text>
            {remembered ? (
              <Pressable
                style={styles.rememberCard}
                onPress={() => navigation.navigate('VehicleForm', { prefill: remembered })}
                accessibilityRole="button"
                accessibilityLabel={`Save your last vehicle, ${remembered.makeModel}, to My vehicles`}
              >
                <Text style={styles.rememberTitle}>Save to My vehicles</Text>
                <Text style={styles.rememberSub} numberOfLines={1}>
                  Your last vehicle: {remembered.makeModel}
                  {vehicleDetailsLine(remembered) ? ` · ${vehicleDetailsLine(remembered)}` : ''}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            <Text style={styles.intro}>
              Your default vehicle is picked for you when you request help. Tap a vehicle to edit it.
            </Text>
            {vehicles.map((v) => {
              const meta = vehicleTypeMeta(savedVehicleType(v));
              const busy = busyId === v.id;
              return (
                <View key={v.id} style={[styles.card, v.is_default && styles.cardDefault]}>
                  <Pressable
                    style={styles.cardMain}
                    onPress={() => navigation.navigate('VehicleForm', { vehicle: v })}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${vehicleDisplayLabel(v)}${v.is_default ? ', default vehicle' : ''}`}
                  >
                    <View style={styles.typeIcon}>
                      {meta ? <Text style={styles.typeEmoji}>{meta.icon}</Text> : <DrawerIcon name="car" color={colors.primary} />}
                    </View>
                    <View style={styles.flex}>
                      <View style={styles.titleRow}>
                        <Text style={styles.title} numberOfLines={1}>
                          {vehicleDisplayLabel(v)}
                        </Text>
                        {v.is_default ? <Text style={styles.defaultTag}>Default</Text> : null}
                      </View>
                      <Text style={styles.sub} numberOfLines={2}>
                        {savedVehicleDetailsLine(v) || 'Add the plate and color to help mechanics find you.'}
                      </Text>
                    </View>
                  </Pressable>
                  <View style={styles.actions}>
                    {busy ? (
                      <ActivityIndicator color={colors.primary} style={styles.actionBusy} />
                    ) : (
                      <>
                        {!v.is_default ? (
                          <Pressable style={styles.action} onPress={() => void makeDefault(v)} accessibilityRole="button" accessibilityLabel={`Set ${vehicleDisplayLabel(v)} as default`}>
                            <Text style={styles.actionText}>Set as default</Text>
                          </Pressable>
                        ) : null}
                        <Pressable style={styles.action} onPress={() => navigation.navigate('VehicleForm', { vehicle: v })} accessibilityRole="button" accessibilityLabel={`Edit ${vehicleDisplayLabel(v)}`}>
                          <DrawerIcon name="pencil" size={18} color={colors.primary} />
                          <Text style={styles.actionText}>Edit</Text>
                        </Pressable>
                        <Pressable style={styles.action} onPress={() => remove(v)} accessibilityRole="button" accessibilityLabel={`Remove ${vehicleDisplayLabel(v)}`}>
                          <DrawerIcon name="trash" size={18} color={colors.danger} />
                          <Text style={[styles.actionText, styles.actionDanger]}>Remove</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable style={styles.primaryBtn} onPress={add} accessibilityRole="button" accessibilityLabel="Add a vehicle">
          <Text style={styles.primaryBtnText}>Add a vehicle</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 24 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  intro: { fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: 12 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  emptySub: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 21, marginBottom: 16 },
  rememberCard: {
    alignSelf: 'stretch',
    minHeight: 56,
    justifyContent: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  rememberTitle: { fontSize: 14, fontWeight: '800', color: colors.primaryInk },
  rememberSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardDefault: { borderColor: colors.primaryBorder, borderWidth: 1.5 },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 72 },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeEmoji: { fontSize: 22 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text, flexShrink: 1 },
  defaultTag: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryInk,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  sub: { fontSize: 13, color: colors.muted, marginTop: 3, lineHeight: 18 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 10 },
  actionBusy: { minHeight: 44, paddingHorizontal: 10 },
  actionText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  actionDanger: { color: colors.danger },
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
    paddingHorizontal: 24,
    alignSelf: 'stretch',
  },
  primaryBtnText: { color: colors.onPrimary, fontSize: 16, fontWeight: '800' },
});
