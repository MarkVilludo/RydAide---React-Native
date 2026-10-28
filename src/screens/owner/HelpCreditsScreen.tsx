import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { fetchOwnerHelpEntitlement, type HelpUsageEntry } from '../../api/helpEntitlement';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function HelpCreditsScreen() {
  const [loading, setLoading] = useState(true);
  const [help, setHelp] = useState<Awaited<ReturnType<typeof fetchOwnerHelpEntitlement>> | null>(null);

  useEffect(() => {
    fetchOwnerHelpEntitlement()
      .then(setHelp)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !help) {
    return <ActivityIndicator style={{ marginTop: 40 }} />;
  }

  const credits = help.help_requests;

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.title}>Help credits</Text>
        <Text style={styles.plan}>Plan: {help.plan_code}</Text>
        {credits.unlimited ? (
          <Text style={styles.unlimited}>Unlimited help requests</Text>
        ) : (
          <>
            <Text style={styles.line}>Total allowance: {credits.limit}</Text>
            <Text style={styles.line}>Used: {credits.used}</Text>
            <Text style={styles.line}>Remaining: {credits.remaining}</Text>
          </>
        )}
        <Text style={styles.note}>
          Credits are only used when you submit a help request. Browsing mechanics, shops, and this screen does not
          consume credits.
        </Text>
      </View>
      <Text style={styles.section}>Usage</Text>
      <FlatList
        data={help.usage}
        keyExtractor={(item) => String(item.help_request_id)}
        ListEmptyComponent={<Text style={styles.empty}>No credits used yet.</Text>}
        renderItem={({ item }: { item: HelpUsageEntry }) => (
          <View style={styles.row}>
            <Text style={styles.rowDate}>{formatDate(item.counted_at)}</Text>
            <Text style={styles.rowType}>{item.request_type_label}</Text>
            <Text style={styles.rowVehicle}>{item.vehicle_label ?? 'Vehicle'}</Text>
            <Text style={styles.rowCredit}>Credit used: {item.credits_used}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  summary: { backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  title: { fontWeight: '700', fontSize: 18 },
  plan: { color: '#64748b', marginTop: 4 },
  unlimited: { marginTop: 8, color: '#0284c7', fontWeight: '600' },
  note: { marginTop: 12, fontSize: 12, color: '#64748b', lineHeight: 18 },
  line: { marginTop: 6, color: '#475569' },
  section: { fontWeight: '600', marginTop: 20, marginBottom: 8 },
  empty: { color: '#64748b' },
  row: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  rowDate: { color: '#64748b', fontSize: 12 },
  rowType: { fontWeight: '600', marginTop: 4 },
  rowVehicle: { color: '#475569', marginTop: 2 },
  rowCredit: { color: '#0284c7', marginTop: 4, fontSize: 12 },
});
