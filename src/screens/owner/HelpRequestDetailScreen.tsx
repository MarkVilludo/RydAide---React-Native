import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from '../../components/KeyboardAwareScrollView';
import { getApiErrorMessage } from '../../api/client';
import {
  cancelHelpRequest,
  fetchHelpCancellationSummary,
  fetchHelpRequest,
  submitHelpRequestReview,
  type HelpRequest,
} from '../../api/helpRequests';
import { CancelHelpRequestButton } from '../../components/CancelHelpRequestButton';
import { GrabStyleBottomSheet } from '../../components/GrabStyleBottomSheet';
import { OwnerHelpCompletionSection } from '../../components/OwnerHelpCompletionSection';
import { OwnerPayMechanicCard, PaymentPlanLine } from '../../components/JobPaymentCards';
import { colors } from '../../theme/tokens';
import { HelpRequestMap } from '../../components/HelpRequestMap';
import { HelpRequestPhotoGallery } from '../../components/HelpRequestPhotoGallery';
import { useLiveHelpRequestRefresh } from '../../hooks/useLiveHelpRequestRefresh';
import type { OwnerStackParamList } from '../../navigation/types';
import { haversineDistanceKm } from '../../utils/distanceKm';
import { jobWorkDurationValueOnly } from '../../utils/jobWorkDuration';
import {
  canOwnerCancelHelpRequest,
  formatRequestDate,
  isOwnerCompletedHelpRequest,
  jobStatusLabelOf,
  jobStatusOf,
  problemNamesOf,
  vehicleWithDetails,
  cancelConfirmMessage,
} from '../../utils/helpRequestUi';
import { liveSheetScrollMax } from '../../utils/mapZoom';

type Props = NativeStackScreenProps<OwnerStackParamList, 'HelpRequestDetail'>;

export function HelpRequestDetailScreen({ route, navigation }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const sheetScrollMax = liveSheetScrollMax(windowHeight);
  const { helpRequestId } = route.params;
  const [request, setRequest] = useState<HelpRequest | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const cancelLock = useRef(false);
  const reviewScrollRef = useRef<KeyboardAwareScrollViewRef>(null);

  const scrollReviewIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      reviewScrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await fetchHelpRequest(helpRequestId);
      setRequest(data);
      return data;
    } catch {
      setRequest((prev) => prev);
      return null;
    }
  }, [helpRequestId]);

  useLiveHelpRequestRefresh({ refresh: load, request });

  const confirmCancel = async () => {
    if (!request) return;
    const summary = await fetchHelpCancellationSummary();
    Alert.alert('Cancel request?', cancelConfirmMessage(summary), [
      { text: 'Keep request', style: 'cancel' },
      {
        text: 'Cancel request',
        style: 'destructive',
        onPress: async () => {
          if (cancelLock.current) return;
          cancelLock.current = true;
          try {
            await cancelHelpRequest(helpRequestId);
            const updated = await fetchHelpRequest(helpRequestId);
            setRequest(updated);
          } catch (e) {
            cancelLock.current = false;
            Alert.alert('Cancel failed', getApiErrorMessage(e));
          }
        },
      },
    ]);
  };

  if (!request) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#0284c7" />
      </View>
    );
  }

  const location =
    request.address_text ?? `${request.latitude.toFixed(5)}, ${request.longitude.toFixed(5)}`;
  const workTime = jobWorkDurationValueOnly(request.job);
  const canCancel = canOwnerCancelHelpRequest(request);
  const completed = isOwnerCompletedHelpRequest(request);
  const terminal = ['COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_MECHANIC_FOUND'].includes(request.status);
  const showLockedHint = !canCancel && !terminal && !!request.mechanic;
  const canReview = completed && !!request.mechanic;
  const jobStatus = jobStatusOf(request);
  const mechanicLoc = request.tracking?.mechanic_location;
  const liveTracking =
    !!mechanicLoc && ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'].includes(jobStatus);
  const liveDistanceKm =
    liveTracking && mechanicLoc
      ? haversineDistanceKm(
          mechanicLoc.latitude,
          mechanicLoc.longitude,
          request.latitude,
          request.longitude,
        )
      : null;
  const mechanicName =
    request.mechanic?.display_name ||
    request.mechanic?.mechanic_name ||
    request.mechanic?.business_name ||
    'Mechanic';

  if (canReview) {
    return (
      <View style={styles.completionRoot}>
        <KeyboardAwareScrollView
          ref={reviewScrollRef}
          style={styles.completionScroll}
          extraBottomPadding={120}
          contentContainerStyle={styles.completionScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <OwnerHelpCompletionSection
            request={request}
            reviewSubmitting={reviewSubmitting}
            scrollRef={reviewScrollRef}
            onCommentFocus={scrollReviewIntoView}
            onUpdated={setRequest}
            onDone={() => navigation.navigate('OwnerHome')}
            onViewHistory={() => navigation.navigate('HelpRequestHistory')}
            onSubmitReview={async (rating, comment) => {
              setReviewSubmitting(true);
              try {
                await submitHelpRequestReview(helpRequestId, rating, comment);
                const updated = await fetchHelpRequest(helpRequestId);
                setRequest(updated);
              } catch (e) {
                Alert.alert('Review', getApiErrorMessage(e));
              } finally {
                setReviewSubmitting(false);
              }
            }}
          />
        </KeyboardAwareScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.mapArea}>
        <HelpRequestMap
          request={{
            latitude: request.latitude,
            longitude: request.longitude,
            title: 'Help location',
          }}
          mechanic={
            liveTracking && mechanicLoc
              ? {
                  latitude: mechanicLoc.latitude,
                  longitude: mechanicLoc.longitude,
                  title: mechanicName,
                }
              : null
          }
          requestPinLabel="You"
          mechanicPinLabel="Mechanic"
          fill
          zoomPreset={liveTracking ? 'live' : 'detail'}
          showMyLocation={false}
          showRouteLine={liveTracking}
          liveDistanceKm={liveDistanceKm}
          showLiveDistanceBadge={liveTracking}
        />
      </View>

      <View style={styles.sheetDock} pointerEvents="box-none">
        <GrabStyleBottomSheet compact bottomInset={canCancel ? 4 : 0}>
          <KeyboardAwareScrollView
            ref={reviewScrollRef}
            style={[styles.sheetScroll, { maxHeight: sheetScrollMax }]}
            contentContainerStyle={styles.sheetScrollContent}
            extraBottomPadding={canReview ? 24 : 0}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.titleRow}>
              <Text style={styles.headline} numberOfLines={1}>
                Request #{request.id}
              </Text>
              <Text style={styles.statusPill}>{jobStatusLabelOf(request)}</Text>
            </View>

            <Text style={styles.lead} numberOfLines={2}>
              {problemNamesOf(request, 'Help request')}
              {request.remarks ? ` · ${request.remarks}` : ''}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {vehicleWithDetails(request)}
            </Text>

            {canCancel ? (
              <Text style={styles.cancelHint}>Still searching — you can cancel below.</Text>
            ) : showLockedHint ? (
              <Text style={styles.lockedHint}>
                Mechanic accepted. Call them if plans change — cancel isn’t available in-app.
              </Text>
            ) : null}

            <View style={styles.compactBlock}>
              <Text style={styles.compactLabel}>Location</Text>
              <Text style={styles.compactBody} numberOfLines={2}>
                {location}
              </Text>
              <Pressable
                onPress={() =>
                  Linking.openURL(
                    `https://www.google.com/maps/search/?api=1&query=${request.latitude},${request.longitude}`,
                  )
                }
              >
                <Text style={styles.link}>Open in maps</Text>
              </Pressable>
            </View>

            {request.payment_preference ? (
              <View style={styles.compactBlock}>
                <PaymentPlanLine request={request} prefix="Pay with" />
              </View>
            ) : null}

            {request.mechanic && request.status !== 'SEARCHING' ? (
              <View style={styles.compactBlock}>
                <Text style={styles.compactLabel}>Mechanic</Text>
                <Text style={styles.compactStrong} numberOfLines={1}>
                  {mechanicName}
                </Text>
                {request.mechanic.phone ? (
                  <Pressable onPress={() => Linking.openURL(`tel:${request.mechanic!.phone}`)}>
                    <Text style={styles.link}>Call mechanic</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View style={styles.compactBlock}>
              <Text style={styles.compactLabel}>Timeline</Text>
              <TimelineRow label="Created" value={formatRequestDate(request.created_at)} />
              <TimelineRow label="Accepted" value={formatRequestDate(request.accepted_at)} />
              <TimelineRow label="Completed" value={formatRequestDate(request.completed_at)} />
              {request.cancelled_at ? (
                <TimelineRow label="Cancelled" value={formatRequestDate(request.cancelled_at)} />
              ) : null}
              {jobStatus === 'COMPLETED' && workTime ? (
                <Text style={styles.workTime}>Work time · {workTime}</Text>
              ) : null}
            </View>

            {request.answers && request.answers.length > 0 ? (
              <View style={styles.compactBlock}>
                <Text style={styles.compactLabel}>Details</Text>
                {request.answers.map((a) => (
                  <Text key={a.question_id} style={styles.answer}>
                    {a.question}: {a.answer}
                  </Text>
                ))}
              </View>
            ) : null}

            {request.media && request.media.length > 0 ? (
              <HelpRequestPhotoGallery media={request.media} title="Problem photos" compact />
            ) : null}

            {!completed && ['ARRIVED', 'IN_PROGRESS'].includes(jobStatus) ? (
              <OwnerPayMechanicCard request={request} onUpdated={setRequest} />
            ) : null}
          </KeyboardAwareScrollView>
          {canCancel ? <CancelHelpRequestButton onPress={confirmCancel} /> : null}
        </GrabStyleBottomSheet>
      </View>
    </View>
  );
}

function TimelineRow({ label, value }: { label: string; value: string }) {
  if (value === '—') return null;
  return (
    <Text style={styles.timeline}>
      {label}: {value}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  completionRoot: { flex: 1, backgroundColor: colors.bg },
  completionScroll: { flex: 1 },
  completionScrollContent: { padding: 16, paddingBottom: 32 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  mapArea: { ...StyleSheet.absoluteFill, backgroundColor: '#cbd5e1' },
  sheetDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetScroll: {},
  sheetScrollContent: { paddingBottom: 4, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headline: { flex: 1, fontSize: 17, fontWeight: '800', color: '#0f172a' },
  statusPill: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369a1',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  lead: { marginTop: 6, fontSize: 14, fontWeight: '600', color: '#334155', lineHeight: 19 },
  meta: { marginTop: 2, fontSize: 13, color: '#64748b' },
  cancelHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: '#991b1b',
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  lockedHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: '#475569',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  compactBlock: { marginTop: 10 },
  compactLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  compactBody: { fontSize: 14, color: '#475569', lineHeight: 19 },
  compactStrong: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  link: { color: '#0284c7', fontWeight: '700', marginTop: 4, fontSize: 13 },
  timeline: { marginTop: 2, color: '#475569', fontSize: 13 },
  workTime: { marginTop: 6, fontWeight: '800', color: '#166534', fontSize: 14 },
  answer: { color: '#475569', marginTop: 3, fontSize: 13, lineHeight: 18 },
});
