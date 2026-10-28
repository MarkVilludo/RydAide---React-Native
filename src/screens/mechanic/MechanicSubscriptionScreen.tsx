import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppConfig } from '../../hooks/useAppConfig';
import type { MechanicStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MechanicStackParamList, 'MechanicSubscription'>;

export function MechanicSubscriptionScreen(_props: Props) {
  const { config } = useAppConfig();
  const price = config?.mechanic_monetization.pro_monthly_price_php ?? 99;
  const freeLimit = config?.mechanic_monetization.free_emergency_accept_limit ?? 5;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Mechanic Pro</Text>
      <Text style={styles.price}>₱{price} / month</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What stays free</Text>
        <Text style={styles.body}>
          Your directory listing and shop profile stay free. Owners can always find and contact you through search.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Emergency help requests</Text>
        <Text style={styles.body}>
          At launch, basic emergency assistance includes up to {freeLimit} accepted customer jobs at no charge. After
          that, Mechanic Pro unlocks unlimited accepts plus enhanced visibility on your listing.
        </Text>
      </View>

      <View style={styles.note}>
        <Text style={styles.noteText}>
          In-app billing is coming soon. For now, contact RydAid support to activate Mechanic Pro on your account
          after you use your free accepts.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  price: { fontSize: 20, fontWeight: '700', color: '#0284c7', marginTop: 8, marginBottom: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  body: { fontSize: 15, lineHeight: 22, color: '#475569' },
  note: {
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  noteText: { fontSize: 14, lineHeight: 20, color: '#92400e' },
});
