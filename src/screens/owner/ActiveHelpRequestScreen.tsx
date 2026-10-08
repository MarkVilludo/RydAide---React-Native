import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { cancelHelpRequest, fetchHelpRequest, type HelpRequest } from '../../api/helpRequests';
import type { OwnerStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'ActiveHelpRequest'>;

export function ActiveHelpRequestScreen({ route }: Props) {
  const { helpRequestId } = route.params;
  const [request, setRequest] = useState<HelpRequest | null>(null);

  useEffect(() => {
    const load = () => fetchHelpRequest(helpRequestId).then(setRequest).catch(() => {});
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [helpRequestId]);

  if (!request) {
    return <ActivityIndicator style={{ marginTop: 40 }} />;
  }

  const searching = request.status === 'SEARCHING';
  const accepted = ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'].includes(request.status);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{searching ? 'Searching for mechanic…' : accepted ? 'Mechanic found' : request.status}</Text>
      <Text style={styles.problem}>{request.problem_category?.name}</Text>
      <Text style={styles.remarks}>{request.remarks}</Text>
      <Text style={styles.meta}>Status: {request.status}</Text>

      {accepted && request.mechanic && (
        <View style={styles.card}>
          <Text style={styles.shop}>{request.mechanic.business_name}</Text>
          <Text>★ {request.mechanic.rating_average}</Text>
          {request.mechanic.phone && (
            <Pressable onPress={() => Linking.openURL(`tel:${request.mechanic!.phone}`)}>
              <Text style={styles.call}>Call mechanic</Text>
            </Pressable>
          )}
        </View>
      )}

      {searching && (
        <Pressable style={styles.cancel} onPress={() => cancelHelpRequest(helpRequestId)}>
          <Text style={styles.cancelText}>Cancel request</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8fafc' },
  title: { fontSize: 22, fontWeight: '700' },
  problem: { fontSize: 18, marginTop: 12 },
  remarks: { color: '#475569', marginTop: 8 },
  meta: { marginTop: 12, color: '#64748b' },
  card: { marginTop: 20, backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  shop: { fontSize: 17, fontWeight: '600' },
  call: { color: '#0284c7', marginTop: 12, fontWeight: '600' },
  cancel: { marginTop: 24, alignItems: 'center' },
  cancelText: { color: '#b91c1c' },
});
