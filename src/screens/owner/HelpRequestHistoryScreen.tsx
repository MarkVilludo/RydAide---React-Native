import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchHelpRequests, type HelpRequest } from '../../api/helpRequests';
import type { OwnerStackParamList } from '../../navigation/types';
import { isOwnerLiveHelpRequest } from '../../utils/helpRequestUi';

type Props = NativeStackScreenProps<OwnerStackParamList, 'HelpRequestHistory'>;

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function vehicleLabel(item: HelpRequest) {
  if (item.vehicle_description?.trim()) {
    return item.vehicle_description.trim();
  }
  const v = item.vehicle;
  if (!v) return '—';
  return [v.make?.name, v.model?.name, v.nickname].filter(Boolean).join(' ') || 'Vehicle';
}

function locationLabel(item: HelpRequest) {
  if (item.address_text) return item.address_text;
  return `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`;
}

export function HelpRequestHistoryScreen({ navigation }: Props) {
  const [items, setItems] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchHelpRequests()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading && items.length === 0) {
    return <ActivityIndicator style={{ marginTop: 40 }} />;
  }

  return (
    <FlatList
      style={styles.list}
      data={items}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My help history</Text>
          <Text style={styles.headerHint}>Past emergency and service requests you submitted.</Text>
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>No help requests yet.</Text>}
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() => {
            if (isOwnerLiveHelpRequest(item)) {
              navigation.navigate('ActiveHelpRequest', { helpRequestId: item.id });
            } else {
              navigation.navigate('HelpRequestDetail', { helpRequestId: item.id });
            }
          }}
        >
          <Text style={styles.id}>Request #{item.id}</Text>
          <Text style={styles.type}>{item.request_type_label ?? item.request_type}</Text>
          <Text style={styles.status}>{item.status_label ?? item.status}</Text>
          <Text style={styles.line}>Vehicle: {vehicleLabel(item)}</Text>
          <Text style={styles.line}>Problem: {item.problem_category?.name ?? '—'}</Text>
          <Text style={styles.remarks} numberOfLines={2}>{item.remarks}</Text>
          <Text style={styles.meta}>Requested: {formatDate(item.created_at)}</Text>
          <Text style={styles.meta} numberOfLines={1}>Location: {locationLabel(item)}</Text>
          {item.mechanic && item.status !== 'SEARCHING' && (
            <Text style={styles.meta}>Mechanic: {item.mechanic.business_name}</Text>
          )}
          {item.status === 'SEARCHING' && item.search_progress && (
            <Text style={styles.meta}>
              Notified {item.search_progress.mechanics_notified_total} · waiting{' '}
              {item.search_progress.mechanics_awaiting_response}
            </Text>
          )}
          {item.shop && <Text style={styles.meta}>Shop: {item.shop.name}</Text>}
          {item.accepted_at && <Text style={styles.meta}>Accepted: {formatDate(item.accepted_at)}</Text>}
          {item.completed_at && <Text style={styles.meta}>Completed: {formatDate(item.completed_at)}</Text>}
          {item.cancelled_at && <Text style={styles.meta}>Cancelled: {formatDate(item.cancelled_at)}</Text>}
          <Text style={styles.tapHint}>
            {isOwnerLiveHelpRequest(item) ? 'Tap to track live' : 'Tap for full details'}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerHint: { color: '#64748b', marginTop: 4, fontSize: 13 },
  empty: { textAlign: 'center', marginTop: 40, color: '#64748b' },
  card: { marginHorizontal: 12, marginBottom: 12, padding: 16, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  id: { fontWeight: '700', color: '#0f172a' },
  type: { color: '#475569', marginTop: 2, fontWeight: '500' },
  status: { color: '#0284c7', marginTop: 6, fontWeight: '700' },
  line: { color: '#334155', marginTop: 4, fontSize: 14 },
  remarks: { color: '#64748b', marginTop: 6, fontStyle: 'italic' },
  meta: { color: '#64748b', marginTop: 4, fontSize: 12 },
  tapHint: { color: '#0284c7', marginTop: 10, fontSize: 12, fontWeight: '500' },
});
