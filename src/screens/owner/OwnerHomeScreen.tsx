import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchEntitlements } from '../../api/auth';
import { fetchVehicles, type Vehicle } from '../../api/vehicles';
import type { Entitlements } from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import { useAppConfig } from '../../hooks/useAppConfig';
import type { OwnerStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'OwnerHome'>;

export function OwnerHomeScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const { config } = useAppConfig();
  const emergencyOn = config?.features.emergency_assistance ?? false;
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [primaryVehicle, setPrimaryVehicle] = useState<Vehicle | null>(null);

  const refresh = useCallback(() => {
    fetchEntitlements().then(setEntitlements).catch(() => setEntitlements(null));
    fetchVehicles()
      .then((list) => setPrimaryVehicle(list[0] ?? null))
      .catch(() => setPrimaryVehicle(null));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Hello, {user?.name}</Text>

      {config?.rollout.area_label ? (
        <Text style={styles.rollout}>
          Growing network in {config.rollout.area_label}. Search any location — results show verified providers within
          your radius only.
        </Text>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current vehicle</Text>
        {primaryVehicle ? (
          <>
            <Text style={styles.vehicleName}>{primaryVehicle.nickname ?? 'My vehicle'}</Text>
            <Text style={styles.muted}>
              {[primaryVehicle.make?.name, primaryVehicle.model?.name].filter(Boolean).join(' ')}
            </Text>
            <Text style={styles.muted}>{primaryVehicle.current_mileage.toLocaleString()} km</Text>
          </>
        ) : (
          <Text style={styles.muted}>No vehicle yet — add one (free plan: 1 vehicle).</Text>
        )}
        <Pressable style={styles.linkButton} onPress={() => navigation.navigate('MyVehicles')}>
          <Text style={styles.linkText}>Manage vehicles</Text>
        </Pressable>
        {!primaryVehicle && (
          <Pressable style={styles.addButton} onPress={() => navigation.navigate('AddVehicle')}>
            <Text style={styles.addButtonText}>Add vehicle</Text>
          </Pressable>
        )}
      </View>

      {emergencyOn ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Help requests</Text>
            <Text style={styles.muted}>Plan: {entitlements?.plan_code ?? '…'}</Text>
            {entitlements?.unlimited_help_requests || entitlements?.help_requests?.unlimited ? (
              <Text style={styles.creditHighlight}>Unlimited</Text>
            ) : (
              <>
                <Text style={styles.creditHighlight}>
                  {entitlements?.help_requests_remaining ?? entitlements?.help_requests?.remaining ?? '…'} remaining
                </Text>
                <Text style={styles.muted}>
                  {entitlements?.help_requests_used ?? entitlements?.help_requests?.used ?? 0} of{' '}
                  {entitlements?.max_help_requests ?? entitlements?.help_requests?.limit ?? '…'} used
                </Text>
              </>
            )}
            <View style={styles.linkRow}>
              <Pressable onPress={() => navigation.navigate('HelpRequestHistory')}>
                <Text style={styles.linkText}>View help history</Text>
              </Pressable>
              <Text style={styles.linkSep}> · </Text>
              <Pressable onPress={() => navigation.navigate('HelpCredits')}>
                <Text style={styles.linkText}>Help credits</Text>
              </Pressable>
            </View>
          </View>

          <Pressable style={styles.helpButton} onPress={() => navigation.navigate('NeedHelp', { emergency: true })}>
            <Text style={styles.helpText}>🆘 NEED HELP</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Directory</Text>
          <Text style={styles.muted}>
            Browse verified mechanics and shops near you. Emergency dispatch opens once enough providers are active in
            your area.
          </Text>
        </View>
      )}

      <View style={styles.row}>
        <Pressable style={styles.rowBtn} onPress={() => navigation.navigate('FindMechanic')}>
          <Text style={styles.rowBtnText}>Find mechanic</Text>
        </Pressable>
        <Pressable style={styles.rowBtn} onPress={() => navigation.navigate('FindShop')}>
          <Text style={styles.rowBtnText}>Find shop</Text>
        </Pressable>
      </View>
      <Pressable style={styles.rowBtnSingle} onPress={() => navigation.navigate('MyVehicles')}>
        <Text style={styles.rowBtnText}>Maintenance</Text>
      </Pressable>

      <Pressable style={styles.secondary} onPress={signOut}>
        <Text style={styles.secondaryText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f8fafc' },
  greeting: { fontSize: 22, fontWeight: '600', color: '#0f172a', marginBottom: 16 },
  rollout: { color: '#475569', marginBottom: 16, lineHeight: 20 },
  muted: { color: '#64748b', marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  cardTitle: { fontWeight: '600', marginBottom: 8 },
  creditHighlight: { fontSize: 18, fontWeight: '700', color: '#0284c7' },
  vehicleName: { fontSize: 18, fontWeight: '600' },
  linkButton: { marginTop: 12 },
  linkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, flexWrap: 'wrap' },
  linkSep: { color: '#94a3b8' },
  linkText: { color: '#0284c7', fontWeight: '500' },
  addButton: {
    marginTop: 12,
    backgroundColor: '#0284c7',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  addButtonText: { color: '#fff', fontWeight: '600' },
  helpButton: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  helpText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  rowBtn: { flex: 1, padding: 14, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  rowBtnText: { color: '#0284c7', fontWeight: '600' },
  rowBtnSingle: { marginTop: 8, padding: 14, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  secondary: { marginTop: 24, alignItems: 'center' },
  secondaryText: { color: '#0284c7' },
});
