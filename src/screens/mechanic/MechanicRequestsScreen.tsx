import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { HelpRequest } from '../../api/helpRequests';
import { fetchMechanicHelpQueues, type MechanicHelpQueues } from '../../api/mechanicHelp';
import { MechanicRequestCard } from '../../components/MechanicRequestCard';
import type { MechanicStackParamList } from '../../navigation/types';
import { isActiveJobStatus, jobStatusOf } from '../../utils/helpRequestUi';

type Props = NativeStackScreenProps<MechanicStackParamList, 'MechanicRequests'>;

type TabKey =
  | 'incoming'
  | 'accepted_active'
  | 'in_progress'
  | 'completed'
  | 'declined'
  | 'cancelled_expired';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'incoming', label: 'Incoming' },
  { key: 'accepted_active', label: 'Active' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'declined', label: 'Declined' },
  { key: 'cancelled_expired', label: 'Cancelled' },
];

export function MechanicRequestsScreen({ navigation, route }: Props) {
  const initialTab = route.params?.tab ?? 'incoming';
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [queues, setQueues] = useState<MechanicHelpQueues | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchMechanicHelpQueues()
      .then(setQueues)
      .catch(() => setQueues(null))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, 10000);
      return () => clearInterval(timer);
    }, [load]),
  );

  const openRequest = (request: HelpRequest) => {
    const jobStatus = jobStatusOf(request);
    if (request.status === 'SEARCHING') {
      navigation.navigate('MechanicRequestDetail', { helpRequestId: request.id });
      return;
    }
    if (isActiveJobStatus(jobStatus)) {
      navigation.navigate('ActiveJob', { helpRequestId: request.id, justAccepted: false });
      return;
    }
    navigation.navigate('MechanicRequestDetail', { helpRequestId: request.id });
  };

  const list = queues ? queues[tab] : [];
  const statusOverride =
    tab === 'declined' ? 'Declined' : tab === 'cancelled_expired' ? 'Cancelled / Expired' : undefined;

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
              {queues ? ` (${queues.summary[t.key]})` : ''}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading && !queues ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={<Text style={styles.empty}>No requests in this section.</Text>}
          renderItem={({ item }) => (
            <MechanicRequestCard request={item} onPress={() => openRequest(item)} statusOverride={statusOverride} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  tabs: { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
  tab: { paddingHorizontal: 14, paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#16a34a' },
  tabText: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#16a34a' },
  empty: { textAlign: 'center', marginTop: 40, color: '#64748b' },
});
