import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { HelpRequest } from '../api/helpRequests';
import { formatDistanceKm, resolveMechanicToCustomerDistanceKm } from '../utils/distanceKm';
import { formatTimeAgo } from '../utils/formatTimeAgo';
import {
  formatPhpAmount,
  formatRequestDate,
  formatStarRating,
  jobStatusLabelOf,
  jobStatusOf,
  vehicleTitle,
  problemNamesOf,
  vehicleWithDetails,
} from '../utils/helpRequestUi';
import { jobWorkDurationLabel } from '../utils/jobWorkDuration';

export type StatusTone = 'new' | 'active' | 'working' | 'done' | 'bad' | 'muted';

/** Colour family per real server status (HelpRequestStatus / ServiceJob status). */
export function statusToneOf(status: string): StatusTone {
  switch (status) {
    case 'SEARCHING':
    case 'PENDING':
      return 'new';
    case 'ACCEPTED':
    case 'ON_THE_WAY':
    case 'ARRIVED':
      return 'active';
    case 'IN_PROGRESS':
      return 'working';
    case 'COMPLETED':
      return 'done';
    case 'CANCELLED':
      return 'bad';
    default:
      return 'muted'; // EXPIRED, NO_MECHANIC_FOUND, declined
  }
}

const TONES: Record<StatusTone, { bg: string; fg: string; dot: string }> = {
  new: { bg: '#e0f2fe', fg: '#0369a1', dot: '#0284c7' },
  active: { bg: '#fef3c7', fg: '#92400e', dot: '#d97706' },
  working: { bg: '#ede9fe', fg: '#5b21b6', dot: '#7c3aed' },
  done: { bg: '#dcfce7', fg: '#166534', dot: '#16a34a' },
  bad: { bg: '#fee2e2', fg: '#991b1b', dot: '#dc2626' },
  muted: { bg: '#f1f5f9', fg: '#475569', dot: '#94a3b8' },
};

type Props = {
  request: HelpRequest;
  onPress: (request: HelpRequest) => void;
  /** Replaces the server status label (e.g. "Declined by you"). */
  statusOverride?: string;
  statusToneOverride?: StatusTone;
  mechanicCoords?: { latitude: number; longitude: number } | null;
  /** Incoming offers: lead with distance and "x min ago". */
  highlightDistance?: boolean;
  /** Show owner star rating / comment (completed jobs list). */
  showCustomerReview?: boolean;
};

function priceLine(request: HelpRequest): string | null {
  const p = request.job?.pricing;
  if (!p) return null;
  const final = formatPhpAmount(p.final_service_amount_php ?? null);
  if (final) {
    const earned = p.mechanic_net_earnings_php && p.mechanic_net_earnings_php > 0
      ? formatPhpAmount(p.mechanic_net_earnings_php)
      : null;
    return earned && jobStatusOf(request) === 'COMPLETED' ? `${final} · you earn ${earned}` : `${final} final`;
  }
  const quoted = formatPhpAmount(p.quoted_service_amount_php ?? null);
  if (!quoted) return null;
  const qs = p.quote_status;
  return qs === 'accepted'
    ? `${quoted} quote accepted`
    : qs === 'pending'
      ? `${quoted} quote · waiting for owner`
      : qs === 'rejected'
        ? `${quoted} quote declined`
        : `${quoted} quote`;
}

function MechanicRequestCardImpl({
  request,
  onPress,
  statusOverride,
  statusToneOverride,
  mechanicCoords,
  highlightDistance,
  showCustomerReview = false,
}: Props) {
  const status = jobStatusOf(request);
  const statusLabel = statusOverride ?? jobStatusLabelOf(request);
  const tone = TONES[statusToneOverride ?? statusToneOf(status)];
  const isEmergency = request.request_type === 'EMERGENCY';
  const distanceLabel = formatDistanceKm(resolveMechanicToCustomerDistanceKm(request, mechanicCoords ?? null));
  const workTimeLabel = status === 'COMPLETED' ? jobWorkDurationLabel(request.job) : null;
  const whenLabel = highlightDistance
    ? formatTimeAgo(request.created_at)
    : formatRequestDate(request.completed_at ?? request.created_at);
  const price = priceLine(request);
  const title = problemNamesOf(request, 'Help request');
  const vehicle = vehicleWithDetails(request);

  const a11y = [
    statusLabel,
    isEmergency ? 'Emergency' : 'Service request',
    title,
    vehicle,
    distanceLabel ? `${distanceLabel} away` : null,
    request.address_text,
    price,
    whenLabel,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        highlightDistance && styles.cardIncoming,
        isEmergency && highlightDistance && styles.cardEmergency,
        pressed && styles.cardPressed,
      ]}
      onPress={() => onPress(request)}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint="Opens request details"
    >
      <View style={styles.topRow}>
        <View style={[styles.chip, { backgroundColor: tone.bg }]}>
          <View style={[styles.chipDot, { backgroundColor: tone.dot }]} />
          <Text style={[styles.chipText, { color: tone.fg }]} numberOfLines={1}>
            {statusLabel}
          </Text>
        </View>
        <View style={[styles.typeChip, isEmergency && styles.typeChipEmergency]}>
          <Text style={[styles.typeText, isEmergency && styles.typeTextEmergency]}>
            {isEmergency ? 'Emergency' : 'Service'}
          </Text>
        </View>
        <Text style={styles.when} numberOfLines={1}>
          {whenLabel}
        </Text>
      </View>

      <View style={styles.mainRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.problem} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.vehicle} numberOfLines={1}>
            {vehicle}
          </Text>
        </View>
        <View style={[styles.distance, highlightDistance && styles.distanceStrong]}>
          <Text style={[styles.distanceValue, !distanceLabel && styles.distanceMuted]}>{distanceLabel ?? '—'}</Text>
          <Text style={styles.distanceUnit}>{distanceLabel ? 'away' : 'distance'}</Text>
        </View>
      </View>

      {request.address_text ? (
        <Text style={styles.address} numberOfLines={1}>
          📍 {request.address_text}
        </Text>
      ) : null}

      {request.remarks ? (
        <Text style={styles.remarks} numberOfLines={2}>
          “{request.remarks}”
        </Text>
      ) : null}

      {price || workTimeLabel ? (
        <View style={styles.metaRow}>
          {price ? <Text style={styles.price}>{price}</Text> : null}
          {workTimeLabel ? <Text style={styles.workTime}>⏱ {workTimeLabel}</Text> : null}
        </View>
      ) : null}

      {showCustomerReview && status === 'COMPLETED' ? (
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
        ) : (
          <Text style={styles.reviewPending}>No customer review yet</Text>
        )
      ) : null}
    </Pressable>
  );
}

/** Re-renders only when the request object, distance origin (rounded by the parent) or labels change. */
export const MechanicRequestCard = memo(MechanicRequestCardImpl);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 44,
  },
  cardIncoming: { borderColor: '#7dd3fc' },
  cardEmergency: { borderColor: '#fca5a5' },
  cardPressed: { backgroundColor: '#f8fafc', transform: [{ scale: 0.995 }] },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: '55%',
  },
  chipDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  chipText: { fontSize: 12, fontWeight: '800' },
  typeChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#f1f5f9' },
  typeChipEmergency: { backgroundColor: '#fee2e2' },
  typeText: { fontSize: 11, fontWeight: '800', color: '#475569' },
  typeTextEmergency: { color: '#dc2626' },
  when: { flex: 1, textAlign: 'right', fontSize: 12, color: '#64748b', fontWeight: '600' },
  mainRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10, gap: 10 },
  titleBlock: { flex: 1, minWidth: 0 },
  problem: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  vehicle: { marginTop: 3, fontSize: 14, color: '#475569', fontWeight: '600' },
  distance: {
    minWidth: 64,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  distanceStrong: { backgroundColor: '#e0f2fe' },
  distanceValue: { fontSize: 14, fontWeight: '800', color: '#0369a1' },
  distanceMuted: { color: '#94a3b8' },
  distanceUnit: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  address: { marginTop: 8, fontSize: 13, color: '#475569' },
  remarks: { marginTop: 6, fontSize: 14, lineHeight: 20, color: '#334155' },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  price: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  workTime: { fontSize: 13, fontWeight: '700', color: '#166534' },
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
});
