import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchHelpRequest, type HelpRequest } from '../../api/helpRequests';
import type { OwnerStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'HelpRequestDetail'>;

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export function HelpRequestDetailScreen({ route }: Props) {
  const { helpRequestId } = route.params;
  const [request, setRequest] = useState<HelpRequest | null>(null);

  useEffect(() => {
    fetchHelpRequest(helpRequestId).then(setRequest).catch(() => setRequest(null));
  }, [helpRequestId]);

  if (!request) {
    return <ActivityIndicator style={{ marginTop: 40 }} />;
  }

  const vehicleName =
    request.vehicle_description?.trim() ||
    (request.vehicle
      ? [request.vehicle.make?.name, request.vehicle.model?.name, request.vehicle.nickname].filter(Boolean).join(' ')
      : '') ||
    '—';

  const location =
    request.address_text ?? `${request.latitude.toFixed(5)}, ${request.longitude.toFixed(5)}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Request #{request.id}</Text>
      <Row label="Request type" value={request.request_type_label ?? request.request_type} />
      <Row label="Status" value={request.status_label ?? request.status} />
      <Row label="Vehicle" value={vehicleName} />
      <Row label="Problem category" value={request.problem_category?.name ?? '—'} />
      <Text style={styles.section}>Description</Text>
      <Text style={styles.body}>{request.remarks}</Text>
      <Row label="Location" value={location} />
      <Row label="Created" value={formatDate(request.created_at)} />
      <Row label="Accepted" value={formatDate(request.accepted_at)} />
      <Row label="Completed" value={formatDate(request.completed_at)} />
      {request.cancelled_at && <Row label="Cancelled" value={formatDate(request.cancelled_at)} />}
      {request.mechanic && request.status !== 'SEARCHING' && (
        <Row label="Assigned mechanic" value={request.mechanic.business_name} />
      )}
      {request.shop && <Row label="Shop" value={request.shop.name} />}

      {request.answers && request.answers.length > 0 && (
        <>
          <Text style={styles.section}>Additional details</Text>
          {request.answers.map((a) => (
            <Text key={a.question_id} style={styles.answer}>
              {a.question}: {a.answer}
            </Text>
          ))}
        </>
      )}

      {request.media && request.media.length > 0 && (
        <>
          <Text style={styles.section}>Photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {request.media.map((m) => (
              <Image key={m.id} source={{ uri: m.url }} style={styles.photo} />
            ))}
          </ScrollView>
        </>
      )}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  section: { fontWeight: '600', marginTop: 16, marginBottom: 6 },
  body: { color: '#475569', lineHeight: 22 },
  answer: { color: '#475569', marginBottom: 4 },
  photo: { width: 120, height: 120, borderRadius: 8, marginRight: 8 },
  row: { marginTop: 10 },
  label: { color: '#64748b', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.3 },
  value: { color: '#0f172a', marginTop: 2, fontSize: 15 },
});
