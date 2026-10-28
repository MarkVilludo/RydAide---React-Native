import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
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
import { HelpRequestMap } from '../../components/HelpRequestMap';
import type { MechanicStackParamList } from '../../navigation/types';
import { formatRequestDate, isActiveJobStatus, jobStatusLabelOf, jobStatusOf, vehicleTitle } from '../../utils/helpRequestUi';

type Props = NativeStackScreenProps<MechanicStackParamList, 'MechanicRequestDetail'>;

export function MechanicRequestDetailScreen({ route, navigation }: Props) {
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

  useFocusEffect(useCallback(() => load(), [load]));

  useEffect(() => {
    if (!request) return;
    const js = jobStatusOf(request);
    if (isActiveJobStatus(js) && request.status !== 'SEARCHING') {
      navigation.replace('ActiveJob', {
        helpRequestId: request.id,
        initialRequest: request,
      });
    }
  }, [request, navigation]);

  const canAccept =
    request?.status === 'SEARCHING' && request.mechanic_dispatch?.response !== 'declined';
  const isDeclined = request?.mechanic_dispatch?.response === 'declined';

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
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${request.latitude},${request.longitude}`,
    ).catch(() => {});
  };

  if (loading && !request) {
    return <ActivityIndicator style={{ marginTop: 40 }} />;
  }

  if (!request) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Request not found.</Text>
      </View>
    );
  }

  const job = request.job;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {request.request_type === 'EMERGENCY' && <Text style={styles.emergency}>Emergency request</Text>}
      <Text style={styles.status}>Status: {jobStatusLabelOf(request)}</Text>
      <Text style={styles.created}>Created {formatRequestDate(request.created_at)}</Text>

      <Section title="Customer">
        <Text style={styles.bold}>{request.owner?.name ?? '—'}</Text>
        {request.owner?.phone && <Text>{request.owner.phone}</Text>}
      </Section>

      <Section title="Vehicle">
        <Text style={styles.bold}>{vehicleTitle(request)}</Text>
        {request.vehicle?.year != null && <Text>Year: {request.vehicle.year}</Text>}
        {request.vehicle?.current_mileage != null && (
          <Text>Mileage: {request.vehicle.current_mileage.toLocaleString()} km</Text>
        )}
      </Section>

      <Section title="Problem">
        <Text style={styles.bold}>{request.problem_category?.name}</Text>
        <Text style={styles.remarks}>{request.remarks}</Text>
        {request.answers?.map((a) => (
          <View key={a.question_id} style={styles.answer}>
            <Text style={styles.muted}>{a.question}</Text>
            <Text>{a.answer}</Text>
          </View>
        ))}
      </Section>

      <Section title="Location">
        {request.distance_km != null && <Text>{request.distance_km} km away</Text>}
        <Text>{request.address_text ?? `${request.latitude}, ${request.longitude}`}</Text>
        <HelpRequestMap
          request={{ latitude: request.latitude, longitude: request.longitude, title: 'Customer' }}
          height={180}
        />
        <Pressable onPress={openMaps}>
          <Text style={styles.link}>Open in maps</Text>
        </Pressable>
      </Section>

      {request.media && request.media.length > 0 && (
        <Section title="Photos">
          <ScrollView horizontal>
            {request.media.map((m) => (
              <Image key={m.id} source={{ uri: m.url }} style={styles.photo} />
            ))}
          </ScrollView>
        </Section>
      )}

      {job && (
        <Section title="Job timeline">
          <TimelineRow label="Accepted" value={job.accepted_at} />
          <TimelineRow label="On the way" value={job.on_the_way_at} />
          <TimelineRow label="Arrived" value={job.arrived_at} />
          <TimelineRow label="Started" value={job.started_at} />
          <TimelineRow label="Completed" value={job.completed_at} />
          {job.service_performed && <Text style={styles.remarks}>Service: {job.service_performed}</Text>}
          {job.shop?.name && <Text>Shop: {job.shop.name}</Text>}
        </Section>
      )}

      {request.review && (
        <Section title="Customer review">
          <Text>★ {request.review.rating}</Text>
          {request.review.comment && <Text>{request.review.comment}</Text>}
        </Section>
      )}

      {isDeclined && request.mechanic_dispatch?.responded_at && (
        <Text style={styles.muted}>Declined {formatRequestDate(request.mechanic_dispatch.responded_at)}</Text>
      )}

      {canAccept && (
        <View style={styles.actions}>
          <Pressable style={styles.accept} onPress={onAccept} disabled={acting}>
            <Text style={styles.acceptText}>ACCEPT</Text>
          </Pressable>
          <Pressable style={styles.decline} onPress={onDecline} disabled={acting}>
            <Text style={styles.declineText}>DECLINE</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function TimelineRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return <Text style={styles.timeline}>{label}: {formatRequestDate(value)}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#64748b' },
  emergency: { color: '#dc2626', fontWeight: '800' },
  status: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  created: { color: '#64748b', marginBottom: 12 },
  section: {
    marginTop: 14,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: { fontWeight: '700', marginBottom: 8, color: '#64748b', textTransform: 'uppercase', fontSize: 12 },
  bold: { fontWeight: '600', fontSize: 16 },
  remarks: { marginTop: 6, color: '#334155' },
  answer: { marginTop: 8 },
  link: { color: '#0284c7', fontWeight: '600', marginTop: 8 },
  photo: { width: 100, height: 100, borderRadius: 8, marginRight: 8 },
  timeline: { marginTop: 4, color: '#334155' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  accept: { flex: 1, backgroundColor: '#16a34a', padding: 14, borderRadius: 10, alignItems: 'center' },
  acceptText: { color: '#fff', fontWeight: '800' },
  decline: { flex: 1, backgroundColor: '#f1f5f9', padding: 14, borderRadius: 10, alignItems: 'center' },
  declineText: { fontWeight: '700' },
});
