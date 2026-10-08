import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchEntitlements } from '../../api/auth';
import { fetchVehicles, type Vehicle } from '../../api/vehicles';
import type { Entitlements } from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import type { OwnerStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'OwnerHome'>;

export function OwnerHomeScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [primaryVehicle, setPrimaryVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    fetchEntitlements().then(setEntitlements).catch(() => setEntitlements(null));
    fetchVehicles()
      .then((list) => setPrimaryVehicle(list[0] ?? null))
      .catch(() => setPrimaryVehicle(null));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Hello, {user?.name}</Text>

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

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Plan</Text>
        <Text>{entitlements?.plan_code ?? '…'}</Text>
        <Text style={styles.muted}>
          Vehicles:{' '}
          {entitlements?.unlimited_vehicles ? 'Unlimited' : `${entitlements?.max_vehicles ?? 1} max`}
        </Text>
      </View>

      <Pressable style={styles.helpButton} onPress={() => navigation.navigate('NeedHelp', { emergency: true })}>
        <Text style={styles.helpText}>🆘 NEED HELP</Text>
      </Pressable>

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
  vehicleName: { fontSize: 18, fontWeight: '600' },
  linkButton: { marginTop: 12 },
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
