import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { MechanicStackParamList } from '../../navigation/types';
import { getApiErrorMessage } from '../../api/client';
import { acceptHelpRequest, declineHelpRequest, fetchMechanicHelpQueues } from '../../api/mechanicHelp';
import type { HelpRequest } from '../../api/helpRequests';
import { useMechanicLiveLocation } from '../../context/MechanicLocationContext';
import { formatDistanceKm, resolveMechanicToCustomerDistanceKm } from '../../utils/distanceKm';
import { vehicleTitle } from '../../utils/helpRequestUi';

type Props = NativeStackScreenProps<MechanicStackParamList, 'IncomingRequests'>;

export function MechanicIncomingScreen({ navigation }: Props) {
  React.useEffect(() => {
    navigation.replace('MechanicRequests', { tab: 'incoming' });
  }, [navigation]);

  const [incoming, setIncoming] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { coords, servicePin } = useMechanicLiveLocation();
  const distanceOrigin = servicePin ?? coords;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMechanicHelpQueues(distanceOrigin ?? undefined);
      setIncoming(data.incoming);
    } finally {
      setLoading(false);
    }
  }, [distanceOrigin?.latitude, distanceOrigin?.longitude]);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 8000);
      return () => clearInterval(t);
    }, [load]),
  );

  const onAccept = async (id: number) => {
    try {
      const accepted = await acceptHelpRequest(id);
      navigation.replace('ActiveJob', {
        helpRequestId: id,
        justAccepted: true,
        initialRequest: accepted,
      });
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
          {item.owner?.name && <Text style={styles.ownerName}>Owner: {item.owner.name}</Text>}
          <Text style={styles.title}>{item.problem_category?.name}</Text>
          {(() => {
            const d = formatDistanceKm(resolveMechanicToCustomerDistanceKm(item, distanceOrigin ?? null));
            return d ? <Text style={styles.distance}>{d}</Text> : null;
          })()}
          <Text style={styles.vehicle}>{vehicleTitle(item)}</Text>
          <Text style={styles.remarks} numberOfLines={2}>{item.remarks}</Text>
          <Pressable
            style={styles.detailsBtn}
            onPress={() => navigation.navigate('IncomingRequestDetail', { helpRequestId: item.id })}
          >
            <Text style={styles.detailsBtnText}>View full details</Text>
          </Pressable>
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
  ownerName: { color: '#0f172a', fontWeight: '600', marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '600' },
  distance: { marginTop: 6, fontSize: 14, fontWeight: '700', color: '#0284c7' },
  vehicle: { color: '#64748b', marginTop: 4, fontSize: 14 },
  remarks: { color: '#475569', marginVertical: 8 },
  detailsBtn: { marginBottom: 10, paddingVertical: 8 },
  detailsBtnText: { color: '#0284c7', fontWeight: '600', textAlign: 'center' },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  accept: { flex: 1, backgroundColor: '#16a34a', padding: 12, borderRadius: 8, alignItems: 'center' },
  acceptText: { color: '#fff', fontWeight: '700' },
  decline: { flex: 1, backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, alignItems: 'center' },
  declineText: { color: '#334155', fontWeight: '600' },
});
