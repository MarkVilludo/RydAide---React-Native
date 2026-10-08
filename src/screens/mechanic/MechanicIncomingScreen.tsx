import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getApiErrorMessage } from '../../api/client';
import { acceptHelpRequest, declineHelpRequest, fetchMechanicHelpQueues } from '../../api/mechanicHelp';
import type { HelpRequest } from '../../api/helpRequests';

export function MechanicIncomingScreen() {
  const [incoming, setIncoming] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMechanicHelpQueues();
      setIncoming(data.incoming);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 8000);
      return () => clearInterval(t);
    }, [load]),
  );

  const onAccept = async (id: number) => {
    try {
      await acceptHelpRequest(id);
      load();
    } catch (e) {
      Alert.alert('Accept failed', getApiErrorMessage(e));
    }
  };

  const onDecline = async (id: number) => {
    try {
      await declineHelpRequest(id);
      load();
    } catch (e) {
      Alert.alert('Decline failed', getApiErrorMessage(e));
    }
  };

  if (loading && incoming.length === 0) {
    return <ActivityIndicator style={{ marginTop: 40 }} />;
  }

  return (
    <FlatList
      style={styles.list}
      data={incoming}
      keyExtractor={(item) => String(item.id)}
      ListEmptyComponent={<Text style={styles.empty}>No incoming requests right now.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          {item.request_type === 'EMERGENCY' && <Text style={styles.emergency}>🚨 EMERGENCY</Text>}
          <Text style={styles.title}>{item.problem_category?.name}</Text>
          <Text style={styles.remarks}>{item.remarks}</Text>
          <View style={styles.row}>
            <Pressable style={styles.accept} onPress={() => onAccept(item.id)}>
              <Text style={styles.acceptText}>ACCEPT</Text>
            </Pressable>
            <Pressable style={styles.decline} onPress={() => onDecline(item.id)}>
              <Text style={styles.declineText}>DECLINE</Text>
            </Pressable>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#f8fafc' },
  empty: { textAlign: 'center', marginTop: 40, color: '#64748b' },
  card: { margin: 12, padding: 16, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  emergency: { color: '#dc2626', fontWeight: '700', marginBottom: 6 },
  title: { fontSize: 17, fontWeight: '600' },
  remarks: { color: '#475569', marginVertical: 8 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  accept: { flex: 1, backgroundColor: '#16a34a', padding: 12, borderRadius: 8, alignItems: 'center' },
  acceptText: { color: '#fff', fontWeight: '700' },
  decline: { flex: 1, backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, alignItems: 'center' },
  declineText: { color: '#334155', fontWeight: '600' },
});
