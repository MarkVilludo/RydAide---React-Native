import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { HelpRequest } from '../api/helpRequests';
import { formatRequestDate, jobStatusLabelOf, vehicleTitle } from '../utils/helpRequestUi';

type Props = {
  request: HelpRequest;
  onPress: () => void;
  statusOverride?: string;
};

export function MechanicRequestCard({ request, onPress, statusOverride }: Props) {
  const statusLabel = statusOverride ?? jobStatusLabelOf(request);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.vehicle}>{vehicleTitle(request)}</Text>
      <Text style={styles.problem}>{request.problem_category?.name ?? request.remarks}</Text>
      {request.distance_km != null && <Text style={styles.distance}>{request.distance_km} km away</Text>}
      <View style={styles.row}>
        <Text style={request.request_type === 'EMERGENCY' ? styles.emergency : styles.type}>
          {request.request_type_label ?? request.request_type}
        </Text>
        <Text style={styles.date}>{formatRequestDate(request.created_at)}</Text>
      </View>
      {request.address_text && (
        <Text style={styles.address} numberOfLines={1}>{request.address_text}</Text>
      )}
      <Text style={styles.status}>Status: {statusLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  vehicle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  problem: { marginTop: 4, color: '#334155', fontWeight: '500' },
  distance: { marginTop: 6, color: '#0284c7', fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' },
  type: { color: '#64748b', fontSize: 13 },
  emergency: { color: '#dc2626', fontWeight: '700', fontSize: 13 },
  date: { color: '#94a3b8', fontSize: 12 },
  address: { marginTop: 4, color: '#64748b', fontSize: 13 },
  status: { marginTop: 10, fontWeight: '700', color: '#0f172a' },
});
