import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchEntitlements } from '../../api/auth';
import type { Entitlements } from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import type { MechanicStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MechanicStackParamList, 'MechanicHome'>;

export function MechanicHomeScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);

  useEffect(() => {
    fetchEntitlements()
      .then(setEntitlements)
      .catch(() => setEntitlements(null));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Mechanic — {user?.name}</Text>
      <Pressable style={styles.primary} onPress={() => navigation.navigate('IncomingRequests')}>
        <Text style={styles.primaryText}>Incoming requests</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Free tier</Text>
        <Text>
          Accepted requests:{' '}
          {entitlements?.unlimited_accepted_requests
            ? 'Unlimited (Pro)'
            : `Up to ${entitlements?.max_accepted_requests ?? 5} lifetime`}
        </Text>
      </View>

      <Pressable style={styles.secondary} onPress={signOut}>
        <Text style={styles.secondaryText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f8fafc' },
  greeting: { fontSize: 22, fontWeight: '600', color: '#0f172a' },
  muted: { color: '#64748b', marginTop: 4, marginBottom: 20 },
  primary: { backgroundColor: '#16a34a', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: { fontWeight: '600', marginBottom: 8 },
  secondary: { marginTop: 24, alignItems: 'center' },
  secondaryText: { color: '#0284c7' },
});
