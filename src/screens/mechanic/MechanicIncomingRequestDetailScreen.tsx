import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getApiErrorMessage } from '../../api/client';
import type { HelpRequest } from '../../api/helpRequests';
import {
  acceptHelpRequest,
  declineHelpRequest,
  fetchMechanicHelpRequest,
} from '../../api/mechanicHelp';
import type { MechanicStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MechanicStackParamList, 'IncomingRequestDetail'>;

function vehicleLabel(request: HelpRequest) {
  const v = request.vehicle;
  if (!v) return 'Vehicle';
  return [v.make?.name, v.model?.name, v.variant?.name].filter(Boolean).join(' ') || v.nickname || 'Vehicle';
}

export function MechanicIncomingRequestDetailScreen({ route, navigation }: Props) {
  const { helpRequestId } = route.params;
  const [request, setRequest] = useState<HelpRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchMechanicHelpRequest(helpRequestId)
      .then(setRequest)
      .catch(() => setRequest(null))
      .finally(() => setLoading(false));
  }, [helpRequestId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onAccept = async () => {
    setActing(true);
    try {
      const accepted = await acceptHelpRequest(helpRequestId);
      navigation.replace('ActiveJob', {
        helpRequestId,
        justAccepted: true,
        initialRequest: accepted,
      });
    } catch (e) {
      Alert.alert('Accept failed', getApiErrorMessage(e));
      load();
    } finally {
      setActing(false);
    }
  };

  const onDecline = async () => {
    setActing(true);
    try {
      await declineHelpRequest(helpRequestId);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Decline failed', getApiErrorMessage(e));
    } finally {
      setActing(false);
    }
  };

  const openMaps = () => {
    if (!request) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${request.latitude},${request.longitude}`;
    Linking.openURL(url).catch(() => {});
  };

  if (loading && !request) {
    return <ActivityIndicator style={{ marginTop: 40 }} />;
  }

  if (!request) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Request not found or no longer available.</Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const isEmergency = request.request_type === 'EMERGENCY';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {isEmergency && <Text style={styles.emergency}>🚨 NEW EMERGENCY REQUEST</Text>}

      {request.owner?.name && (
        <Text style={styles.ownerName}>Vehicle owner: {request.owner.name}</Text>
      )}

      <Text style={styles.vehicle}>{vehicleLabel(request)}</Text>
      {request.vehicle?.current_mileage != null && (
        <Text style={styles.mileage}>{request.vehicle.current_mileage.toLocaleString()} km</Text>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Problem</Text>
        <Text style={styles.problem}>{request.problem_category?.name ?? '—'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What happened</Text>
        <Text style={styles.remarks}>{request.remarks}</Text>
      </View>

      {request.answers && request.answers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          {request.answers.map((a) => (
            <View key={a.question_id} style={styles.answerRow}>
              <Text style={styles.question}>{a.question ?? 'Question'}</Text>
              <Text style={styles.answer}>{a.answer}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        {request.distance_km != null && (
          <Text style={styles.distance}>{request.distance_km} km away</Text>
        )}
        <Text style={styles.address}>
          {request.address_text ?? `${request.latitude.toFixed(5)}, ${request.longitude.toFixed(5)}`}
        </Text>
        <Pressable style={styles.mapBtn} onPress={openMaps}>
          <Text style={styles.mapBtnText}>Open in maps</Text>
        </Pressable>
      </View>

      {request.media && request.media.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {request.media
              .filter((m) => m.media_type === 'photo')
              .map((m) => (
                <Image key={m.id} source={{ uri: m.url }} style={styles.photo} />
              ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable style={styles.accept} onPress={onAccept} disabled={acting}>
          {acting ? <ActivityIndicator color="#fff" /> : <Text style={styles.acceptText}>ACCEPT</Text>}
        </Pressable>
        <Pressable style={styles.decline} onPress={onDecline} disabled={acting}>
          <Text style={styles.declineText}>DECLINE</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: '#64748b', textAlign: 'center' },
  link: { color: '#0284c7', marginTop: 12, fontWeight: '600' },
  emergency: { color: '#dc2626', fontWeight: '800', fontSize: 15, marginBottom: 8 },
  ownerName: { fontSize: 16, fontWeight: '600', color: '#334155', marginBottom: 6 },
  vehicle: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  mileage: { color: '#64748b', marginTop: 4, marginBottom: 12 },
  section: { marginTop: 16, backgroundColor: '#fff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: 6 },
  problem: { fontSize: 18, fontWeight: '600' },
  remarks: { color: '#334155', lineHeight: 22 },
  answerRow: { marginTop: 8 },
  question: { fontSize: 13, color: '#64748b' },
  answer: { fontWeight: '600', marginTop: 2, textTransform: 'capitalize' },
  distance: { fontSize: 17, fontWeight: '600', color: '#0284c7' },
  address: { color: '#475569', marginTop: 4 },
  mapBtn: { marginTop: 10, alignSelf: 'flex-start' },
  mapBtnText: { color: '#0284c7', fontWeight: '600' },
  photo: { width: 120, height: 120, borderRadius: 8, marginRight: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  accept: { flex: 1, backgroundColor: '#16a34a', padding: 16, borderRadius: 10, alignItems: 'center' },
  acceptText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  decline: { flex: 1, backgroundColor: '#f1f5f9', padding: 16, borderRadius: 10, alignItems: 'center' },
  declineText: { color: '#334155', fontWeight: '700', fontSize: 16 },
});
