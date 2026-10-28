import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { HelpRequest } from '../api/helpRequests';
import { formatDistanceKm, resolveMechanicToCustomerDistanceKm } from '../utils/distanceKm';
import {
  formatRequestDate,
  formatStarRating,
  jobStatusLabelOf,
  jobStatusOf,
  vehicleTitle,
} from '../utils/helpRequestUi';
import { jobWorkDurationLabel } from '../utils/jobWorkDuration';

type Props = {
  request: HelpRequest;
  onPress: () => void;
  statusOverride?: string;
  mechanicCoords?: { latitude: number; longitude: number } | null;
  highlightDistance?: boolean;
  /** Show owner star rating / comment (completed jobs list). */
  showCustomerReview?: boolean;
};

export function MechanicRequestCard({
  request,
  onPress,
  statusOverride,
  mechanicCoords,
  highlightDistance,
  showCustomerReview = false,
}: Props) {
  const statusLabel = statusOverride ?? jobStatusLabelOf(request);
  const isEmergency = request.request_type === 'EMERGENCY';

  const distanceKm = useMemo(
    () => resolveMechanicToCustomerDistanceKm(request, mechanicCoords ?? null),
    [request, mechanicCoords],
  );
  const distanceLabel = formatDistanceKm(distanceKm);
  const workTimeLabel =
    jobStatusOf(request) === 'COMPLETED' ? jobWorkDurationLabel(request.job) : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, highlightDistance && styles.cardIncoming]}
      onPress={onPress}
    >
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          {isEmergency ? <Text style={styles.emergencyTag}>Emergency</Text> : null}
          <Text style={styles.problem}>{request.problem_category?.name ?? 'Help request'}</Text>
          <Text style={styles.vehicle}>{vehicleTitle(request)}</Text>
        </View>
        {distanceLabel ? (
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceValue}>{distanceLabel}</Text>
          </View>
        ) : (
          <View style={styles.distanceBadgeMuted}>
            <Text style={styles.distanceMutedText}>—</Text>
          </View>
        )}
      </View>

      {request.remarks ? (
        <Text style={styles.remarks} numberOfLines={2}>
          {request.remarks}
        </Text>
      ) : null}

      {request.address_text ? (
        <Text style={styles.address} numberOfLines={1}>
          📍 {request.address_text}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text style={styles.status}>{statusLabel}</Text>
          {workTimeLabel ? <Text style={styles.workTime}>{workTimeLabel}</Text> : null}
        </View>
        <Text style={styles.date}>{formatRequestDate(request.created_at)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardPressed: { backgroundColor: '#f8fafc' },
  cardIncoming: { borderColor: '#bae6fd' },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  titleBlock: { flex: 1, minWidth: 0 },
  emergencyTag: {
    alignSelf: 'flex-start',
    color: '#dc2626',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  problem: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  vehicle: { marginTop: 4, fontSize: 14, color: '#64748b', fontWeight: '600' },
  distanceBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    maxWidth: 110,
  },
  distanceValue: { color: '#0369a1', fontWeight: '800', fontSize: 12, textAlign: 'center', lineHeight: 16 },
  distanceBadgeMuted: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  distanceMutedText: { color: '#94a3b8', fontWeight: '700' },
  remarks: { marginTop: 10, fontSize: 14, lineHeight: 20, color: '#475569' },
  address: { marginTop: 8, fontSize: 13, color: '#64748b' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  footerLeft: { flex: 1, minWidth: 0 },
  status: { fontWeight: '700', color: '#334155', fontSize: 13 },
  workTime: { marginTop: 2, fontWeight: '600', color: '#166534', fontSize: 12 },
  date: { color: '#94a3b8', fontSize: 12 },
});
