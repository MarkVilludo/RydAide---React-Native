import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { getApiErrorMessage } from '../../api/client';
import {
  cancelHelpRequest,
  fetchHelpRequest,
  respondToHelpRequestQuote,
  submitHelpRequestReview,
  type HelpRequest,
} from '../../api/helpRequests';
import { HelpRequestCompletionPanel } from '../../components/HelpRequestCompletionPanel';
import { HelpRequestPhotoGallery } from '../../components/HelpRequestPhotoGallery';
import { GrabStyleBottomSheet } from '../../components/GrabStyleBottomSheet';
import { HelpJourneyTimeline } from '../../components/HelpJourneyTimeline';
import { HelpRequestSearchingHero } from '../../components/HelpRequestSearchingHero';
import { HelpSearchProgressCard } from '../../components/HelpSearchProgressCard';
import { MapSearchOverlay } from '../../components/MapSearchOverlay';
import { ServicePricingCard } from '../../components/ServicePricingCard';
import { ActiveJobLocationSummary } from '../../components/ActiveJobLocationSummary';
import { HelpRequestMap } from '../../components/HelpRequestMap';
import type { OwnerStackParamList } from '../../navigation/types';
import { activeJourneyHeadline, buildHelpJourneySteps } from '../../utils/helpJourney';
import { jobStatusLabelOf, jobStatusOf, vehicleTitle } from '../../utils/helpRequestUi';

type Props = NativeStackScreenProps<OwnerStackParamList, 'ActiveHelpRequest'>;

function mechanicDisplayName(request: HelpRequest) {
  const m = request.mechanic;
  if (!m) return 'Mechanic';
  return m.display_name || m.mechanic_name || m.business_name || 'Mechanic';
}

export function ActiveHelpRequestScreen({ route, navigation }: Props) {
  const { helpRequestId } = route.params;
  const [request, setRequest] = useState<HelpRequest | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const [quoteActing, setQuoteActing] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const cancelLock = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const load = () =>
      fetchHelpRequest(helpRequestId)
        .then((data) => {
          if (cancelled) return;
          setRequest(data);
          setConnectionLost(false);
          const job = data.job_status ?? data.job?.status ?? data.status;
          const terminal =
            ['COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_MECHANIC_FOUND'].includes(data.status) ||
            job === 'COMPLETED';
          if (terminal && timer) {
            clearInterval(timer);
            timer = undefined;
          }
        })
        .catch(() => {
          if (!cancelled) setConnectionLost(true);
        });
    load();
    timer = setInterval(load, 4000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [helpRequestId]);

  const journeySteps = useMemo(() => (request ? buildHelpJourneySteps(request) : []), [request]);

  if (!request) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#0284c7" />
        <Text style={styles.loadingText}>Loading your request…</Text>
        {connectionLost && <Text style={styles.connectionLost}>Connection lost</Text>}
      </View>
    );
  }

  const searching = request.status === 'SEARCHING';
  const failedMatch = request.status === 'NO_MECHANIC_FOUND' || request.status === 'EXPIRED';
  const cancelled = request.status === 'CANCELLED';
  const jobStatus = jobStatusOf(request);
  const completed = jobStatus === 'COMPLETED' || request.status === 'COMPLETED';
  const accepted =
    !completed &&
    !failedMatch &&
    !cancelled &&
    (request.status === 'ACCEPTED' ||
      ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'].includes(jobStatus));
  const tracking = request.tracking;
  const mechanicLoc = tracking?.mechanic_location;

  const canCancel =
    searching || (accepted && request.status === 'ACCEPTED');

  const confirmCancel = () => {
    Alert.alert(
      'Cancel request?',
      searching
        ? 'Stop searching for a mechanic?'
        : 'Cancel while the mechanic is assigned? They will be notified.',
      [
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
      ],
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.mapWrap}>
        {accepted ? (
          <HelpRequestMap
            request={{
              latitude: request.latitude,
              longitude: request.longitude,
              title: 'You',
            }}
            mechanic={
              mechanicLoc
                ? {
                    latitude: mechanicLoc.latitude,
                    longitude: mechanicLoc.longitude,
                    title: mechanicDisplayName(request),
                  }
                : null
            }
            height={280}
          />
        ) : (
          <View style={styles.mapPlaceholder}>
            <HelpRequestMap
              request={{
                latitude: request.latitude,
                longitude: request.longitude,
                title: 'You',
              }}
              height={280}
            />
            {searching && (
              <MapSearchOverlay
                visible
                message="Finding a mechanic"
                submessage={
                  request.search_progress
                    ? `${request.search_progress.mechanics_notified_total} notified · ${request.search_progress.mechanics_awaiting_response} waiting`
                    : 'Contacting providers near you'
                }
              />
            )}
          </View>
        )}
      </View>

      <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent}>
        <GrabStyleBottomSheet>
          <Text style={styles.headline}>{activeJourneyHeadline(request)}</Text>
          <Text style={styles.problem}>{request.problem_category?.name}</Text>

          {canCancel ? (
            <Pressable
              style={({ pressed }) => [styles.cancelSheetBtn, pressed && styles.cancelSheetBtnPressed]}
              onPress={confirmCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel request"
            >
              <Text style={styles.cancelSheetBtnText}>Cancel request</Text>
            </Pressable>
          ) : null}

          <HelpJourneyTimeline steps={journeySteps} compact />

          {searching ? (
            <HelpRequestSearchingHero startedAt={request.created_at ?? new Date().toISOString()} />
          ) : null}

          {searching && request.search_progress ? (
            <HelpSearchProgressCard progress={request.search_progress} />
          ) : null}

          {(failedMatch || cancelled) && (
            <View style={styles.terminalCard}>
              <Text style={styles.terminalTitle}>{request.status_label ?? request.status}</Text>
              <Text style={styles.terminalBody}>
                {failedMatch
                  ? 'No mechanic accepted in time. You can try again from Find Mechanic.'
                  : 'This request was cancelled.'}
              </Text>
              {failedMatch && (
                <Pressable
                  style={styles.retryBtn}
                  onPress={() => navigation.replace('NeedHelp', { emergency: true })}
                >
                  <Text style={styles.retryBtnText}>Try again</Text>
                </Pressable>
              )}
            </View>
          )}

          {completed && (
            <HelpRequestCompletionPanel
              request={request}
              submitting={reviewSubmitting}
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
          )}

          <View style={styles.summaryStrip}>
            <Text style={styles.summaryText}>{vehicleTitle(request)}</Text>
            <Text style={styles.summarySub} numberOfLines={2}>
              {request.problem_category?.name} · {request.remarks}
            </Text>
          </View>

          <HelpRequestPhotoGallery media={request.media} title="Problem photos" compact />

          {accepted && request.mechanic && (
            <View style={styles.card}>
              <View style={styles.mechanicRow}>
                {request.mechanic.avatar_url ? (
                  <Image source={{ uri: request.mechanic.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder} />
                )}
                <View style={styles.mechanicInfo}>
                  <Text style={styles.shop}>{mechanicDisplayName(request)}</Text>
                  <Text style={styles.rating}>★ {request.mechanic.rating_average.toFixed(1)}</Text>
                  {request.mechanic.is_verified && (
                    <Text style={styles.verified}>Verified mechanic</Text>
                  )}
                  {request.mechanic.rating_count != null && request.mechanic.rating_count > 0 && (
                    <Text style={styles.jobCount}>
                      {request.mechanic.rating_count} completed jobs
                    </Text>
                  )}
                </View>
              </View>

              <Text style={styles.statusLine}>{jobStatusLabelOf(request)}</Text>

              <ActiveJobLocationSummary
                tracking={tracking}
                connectionLost={connectionLost}
                viewerRole="owner"
              />

              {request.mechanic.phone && (
                <Pressable
                  style={styles.callBtn}
                  onPress={() => Linking.openURL(`tel:${request.mechanic!.phone}`)}
                >
                  <Text style={styles.callBtnText}>Call mechanic</Text>
                </Pressable>
              )}

              <ServicePricingCard
                pricing={request.job?.pricing}
                viewerRole="owner"
                acting={quoteActing}
                onAcceptQuote={async () => {
                  setQuoteActing(true);
                  try {
                    const updated = await respondToHelpRequestQuote(helpRequestId, 'accept');
                    setRequest(updated);
                  } catch (e) {
                    Alert.alert('Quote', getApiErrorMessage(e));
                  } finally {
                    setQuoteActing(false);
                  }
                }}
                onRejectQuote={async () => {
                  setQuoteActing(true);
                  try {
                    const updated = await respondToHelpRequestQuote(helpRequestId, 'reject');
                    setRequest(updated);
                  } catch (e) {
                    Alert.alert('Quote', getApiErrorMessage(e));
                  } finally {
                    setQuoteActing(false);
                  }
                }}
              />
            </View>
          )}

          {!searching && !accepted && (
            <Text style={styles.remarks}>{request.remarks}</Text>
          )}

          {tracking?.eta_disclaimer && (
            <Text style={styles.disclaimer}>{tracking.eta_disclaimer}</Text>
          )}
        </GrabStyleBottomSheet>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#e2e8f0' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#64748b' },
  connectionLost: { color: '#dc2626' },
  mapWrap: { height: 280, backgroundColor: '#cbd5e1' },
  mapPlaceholder: { flex: 1, position: 'relative' },
  cancelSheetBtn: {
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
    alignItems: 'center',
  },
  cancelSheetBtnPressed: { opacity: 0.88, backgroundColor: '#fee2e2' },
  cancelSheetBtnText: { color: '#dc2626', fontWeight: '800', fontSize: 16 },
  sheetScroll: { flex: 1 },
  sheetScrollContent: { flexGrow: 1 },
  headline: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  problem: { fontSize: 16, color: '#475569', marginTop: 4, marginBottom: 8 },
  card: {
    marginTop: 16,
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mechanicRow: { flexDirection: 'row', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#e2e8f0' },
  mechanicInfo: { flex: 1 },
  shop: { fontSize: 17, fontWeight: '700' },
  rating: { marginTop: 4, color: '#64748b' },
  jobCount: { marginTop: 2, color: '#64748b', fontSize: 13 },
  verified: { color: '#16a34a', marginTop: 4, fontSize: 13, fontWeight: '600' },
  statusLine: { marginTop: 12, fontSize: 15, fontWeight: '600', color: '#0284c7' },
  callBtn: {
    marginTop: 12,
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  callBtnText: { color: '#fff', fontWeight: '700' },
  remarks: { marginTop: 12, color: '#475569', lineHeight: 20 },
  disclaimer: { marginTop: 12, fontSize: 12, color: '#94a3b8', textAlign: 'center' },
  terminalCard: {
    marginTop: 12,
    padding: 14,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  terminalTitle: { fontWeight: '800', color: '#b91c1c', fontSize: 17 },
  terminalBody: { color: '#475569', marginTop: 6, lineHeight: 20 },
  retryBtn: {
    marginTop: 14,
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  summaryStrip: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
  },
  summaryText: { fontWeight: '700', color: '#0f172a' },
  summarySub: { color: '#64748b', marginTop: 4, fontSize: 13 },
});
