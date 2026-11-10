import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { HelpRequest } from '../api/helpRequests';
import { formatDistanceKm, resolveMechanicToCustomerDistanceKm } from '../utils/distanceKm';
import { formatTimeAgo } from '../utils/formatTimeAgo';
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
  const arrivalLabel = highlightDistance
    ? formatTimeAgo(request.created_at)
    : formatRequestDate(request.created_at);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, highlightDistance && styles.cardIncoming]}
      onPress={onPress}
    >
      {highlightDistance ? (
        <View style={styles.incomingMeta}>
          {distanceLabel ? (
            <Text style={styles.incomingDistance}>{distanceLabel} away</Text>
          ) : (
            <Text style={styles.incomingDistanceMuted}>Distance unavailable</Text>
          )}
          <Text style={styles.incomingDot}>·</Text>
          <Text style={styles.incomingAgo}>{arrivalLabel}</Text>
        </View>
      ) : null}

      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          {isEmergency ? <Text style={styles.emergencyTag}>Emergency</Text> : null}
          <Text style={styles.problem}>{request.problem_category?.name ?? 'Help request'}</Text>
          <Text style={styles.vehicle}>{vehicleTitle(request)}</Text>
        </View>
        {!highlightDistance && distanceLabel ? (
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceValue}>{distanceLabel}</Text>
          </View>
        ) : !highlightDistance ? (
          <View style={styles.distanceBadgeMuted}>
            <Text style={styles.distanceMutedText}>—</Text>
          </View>
        ) : null}
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

      {showCustomerReview ? (
        request.review ? (
          <View style={styles.reviewBlock}>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewStars}>{formatStarRating(request.review.rating)}</Text>
              <Text style={styles.reviewScore}>{request.review.rating}/5</Text>
            </View>
            {request.review.comment ? (
              <Text style={styles.reviewComment} numberOfLines={2}>
                {request.review.comment}
              </Text>
            ) : null}
          </View>
        ) : jobStatusOf(request) === 'COMPLETED' ? (
          <Text style={styles.reviewPending}>No customer review yet</Text>
        ) : null
      ) : null}

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text style={styles.status}>{statusLabel}</Text>
          {workTimeLabel ? <Text style={styles.workTime}>{workTimeLabel}</Text> : null}
        </View>
        <Text style={styles.date}>{arrivalLabel}</Text>
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
  incomingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  incomingDistance: { fontSize: 15, fontWeight: '800', color: '#0369a1' },
  incomingDistanceMuted: { fontSize: 14, fontWeight: '700', color: '#94a3b8' },
  incomingDot: { color: '#cbd5e1', fontWeight: '700' },
  incomingAgo: { fontSize: 14, fontWeight: '700', color: '#475569' },
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
  reviewBlock: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  reviewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  reviewStars: { fontSize: 16, color: '#f59e0b', letterSpacing: 1 },
  reviewScore: { fontSize: 13, fontWeight: '800', color: '#92400e' },
  reviewComment: { marginTop: 6, fontSize: 13, lineHeight: 18, color: '#57534e', fontStyle: 'italic' },
  reviewPending: { marginTop: 10, fontSize: 12, fontWeight: '600', color: '#94a3b8' },
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
