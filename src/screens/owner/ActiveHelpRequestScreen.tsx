import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
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
  submitHelpRequestReview,
  type HelpRequest,
} from '../../api/helpRequests';
import { ActiveJobLocationSummary } from '../../components/ActiveJobLocationSummary';
import { AndroidHideNavigationBarWhenFocused } from '../../components/AndroidHideNavigationBarWhenFocused';
import { CancelHelpRequestButton } from '../../components/CancelHelpRequestButton';
import { HelpRequestCompletionPanel } from '../../components/HelpRequestCompletionPanel';
import { KeyboardAwareScrollView } from '../../components/KeyboardAwareScrollView';
import { HelpRequestPhotoGallery } from '../../components/HelpRequestPhotoGallery';
import { GrabStyleBottomSheet } from '../../components/GrabStyleBottomSheet';
import { HelpJourneyTimeline } from '../../components/HelpJourneyTimeline';
import { HelpRequestSearchingHero } from '../../components/HelpRequestSearchingHero';
import { HelpSearchProgressCard } from '../../components/HelpSearchProgressCard';
import { MapSearchOverlay } from '../../components/MapSearchOverlay';
import { JobWorkDurationText } from '../../components/JobWorkDurationText';
import { HelpRequestMap } from '../../components/HelpRequestMap';
import type { OwnerStackParamList } from '../../navigation/types';
import { activeJourneyHeadline, buildHelpJourneySteps } from '../../utils/helpJourney';
import { haversineDistanceKm } from '../../utils/distanceKm';
import {
  canOwnerCancelHelpRequest,
  jobStatusLabelOf,
  jobStatusOf,
  vehicleTitle,
} from '../../utils/helpRequestUi';

type Props = NativeStackScreenProps<OwnerStackParamList, 'ActiveHelpRequest'>;

function mechanicDisplayName(request: HelpRequest) {
  const m = request.mechanic;
  if (!m) return 'Mechanic';
  return m.display_name || m.mechanic_name || m.business_name || 'Mechanic';
}

function liveDistanceKmForRequest(request: HelpRequest | null): number | null {
  const mechanicLoc = request?.tracking?.mechanic_location;
  if (!request || !mechanicLoc) {
    return null;
  }
  return haversineDistanceKm(
    mechanicLoc.latitude,
    mechanicLoc.longitude,
    request.latitude,
    request.longitude,
  );
}

export function ActiveHelpRequestScreen({ route, navigation }: Props) {
  const { helpRequestId } = route.params;
  const [request, setRequest] = useState<HelpRequest | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const cancelLock = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollReviewIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const pollMs =
    (request?.job_status ?? request?.job?.status) === 'IN_PROGRESS' ? 1000 : 2000;

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
    timer = setInterval(load, pollMs);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [helpRequestId, pollMs]);

  const journeySteps = useMemo(() => (request ? buildHelpJourneySteps(request) : []), [request]);

  const liveDistanceKm = useMemo(() => liveDistanceKmForRequest(request), [request]);

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
  const workStarted = jobStatus === 'IN_PROGRESS';
  const photoCount = request.media?.length ?? 0;

  const canCancel = canOwnerCancelHelpRequest(request);

  const confirmCancel = () => {
    Alert.alert(
      'Cancel request?',
      'Stop searching for a mechanic? You can submit a new request anytime.',
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

  if (accepted && request.mechanic) {
    return (
      <View style={styles.root}>
        <AndroidHideNavigationBarWhenFocused active={workStarted} />
        <View style={styles.mapArea}>
          <HelpRequestMap
            request={{
              latitude: request.latitude,
              longitude: request.longitude,
              title: 'Your help location',
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
            requestPinLabel="You"
            mechanicPinLabel="Mechanic"
            fill
            showMyLocation={false}
            showRouteLine={!!mechanicLoc}
            liveDistanceKm={liveDistanceKm}
            showLiveDistanceBadge={!!mechanicLoc && !workStarted}
            liveDistanceBadgeVariant="owner"
          />
        </View>

        <GrabStyleBottomSheet immersiveBottom={workStarted}>
          {workStarted ? (
            <>
              <View style={styles.titleRow}>
                <Text style={styles.jobProgressHeadline} numberOfLines={1}>
                  Job in progress
                </Text>
                <Text style={styles.statusPill}>{jobStatusLabelOf(request)}</Text>
              </View>

              <View style={styles.personRow}>
                <View style={styles.personBlock}>
                  <Text style={styles.personName} numberOfLines={1}>
                    {mechanicDisplayName(request)}
                  </Text>
                  <Text style={styles.vehicle} numberOfLines={1}>
                    {vehicleTitle(request)}
                  </Text>
                </View>
              </View>

              <Text style={styles.problemLine} numberOfLines={1}>
                {request.problem_category?.name}
                {request.remarks ? ` · ${request.remarks}` : ''}
              </Text>

              <JobWorkDurationText
                job={request.job}
                jobStatus={jobStatus}
                style={styles.workTime}
                liveStyle={styles.workTimeLive}
              />

              {connectionLost ? (
                <Text style={styles.connectionBanner}>Connection lost — map may be outdated</Text>
              ) : null}

              {photoCount > 0 ? (
                <Pressable style={styles.photosLink} onPress={() => setPhotosOpen(true)}>
                  <Text style={styles.photosLinkText}>View problem photos ({photoCount})</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <>
              <View style={styles.titleStack}>
                <Text style={styles.sheetHeadline} numberOfLines={2}>
                  {activeJourneyHeadline(request)}
                </Text>
                <Text style={styles.statusPillInline}>{jobStatusLabelOf(request)}</Text>
              </View>

              <View style={styles.personRow}>
                <View style={styles.personBlock}>
                  <Text style={styles.personName} numberOfLines={1}>
                    {mechanicDisplayName(request)}
                  </Text>
                  <Text style={styles.vehicle} numberOfLines={1}>
                    {vehicleTitle(request)}
                  </Text>
                </View>
                {request.mechanic.phone ? (
                  <Pressable
                    style={styles.callChip}
                    onPress={() => Linking.openURL(`tel:${request.mechanic!.phone}`)}
                  >
                    <Text style={styles.callChipText}>Call</Text>
                  </Pressable>
                ) : null}
              </View>

              <Text style={styles.problemLine} numberOfLines={2}>
                {request.problem_category?.name}
                {request.remarks ? ` · ${request.remarks}` : ''}
              </Text>

              <ActiveJobLocationSummary
                tracking={tracking}
                connectionLost={connectionLost}
                viewerRole="owner"
                compact
              />

              {connectionLost ? (
                <Text style={styles.connectionBanner}>Connection lost — map may be outdated</Text>
              ) : null}

              {photoCount > 0 ? (
                <Pressable style={styles.photosLink} onPress={() => setPhotosOpen(true)}>
                  <Text style={styles.photosLinkText}>View problem photos ({photoCount})</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </GrabStyleBottomSheet>

        <Modal visible={photosOpen} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.photosCard}>
              <Text style={styles.modalTitle}>Problem photos</Text>
              <HelpRequestPhotoGallery media={request.media} compact />
              <Pressable style={styles.modalCloseBtn} onPress={() => setPhotosOpen(false)}>
                <Text style={styles.modalCloseBtnText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.mapWrap}>
        <View style={styles.mapPlaceholder}>
          <HelpRequestMap
            request={{
              latitude: request.latitude,
              longitude: request.longitude,
              title: 'You',
            }}
            requestPinLabel="You"
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
      </View>

      <KeyboardAwareScrollView
        ref={scrollRef}
        style={styles.sheetScroll}
        extraBottomPadding={completed ? 160 : canCancel ? 8 : 0}
        contentContainerStyle={[styles.sheetScrollContent, canCancel && styles.sheetScrollWithFooter]}
      >
        <GrabStyleBottomSheet>
          <Text style={styles.headline}>{activeJourneyHeadline(request)}</Text>
          {request.problem_category?.name ? (
            <Text style={styles.problem}>{request.problem_category.name}</Text>
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
              onCommentFocus={scrollReviewIntoView}
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

          {!searching && !completed && (
            <>
              <Text style={styles.summaryText}>{vehicleTitle(request)}</Text>
              <Text style={styles.remarks}>{request.remarks}</Text>
            </>
          )}

          <HelpRequestPhotoGallery media={request.media} title="Problem photos" compact />
        </GrabStyleBottomSheet>
      </KeyboardAwareScrollView>

      {canCancel ? <CancelHelpRequestButton fixedFooter onPress={confirmCancel} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#e2e8f0' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#64748b' },
  connectionLost: { color: '#dc2626' },
  mapArea: { flex: 1, backgroundColor: '#cbd5e1' },
  titleStack: { gap: 6, marginBottom: 2 },
  statusPillInline: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  jobProgressHeadline: { flex: 1, fontSize: 18, fontWeight: '800', color: '#166534' },
  workTime: { marginTop: 4 },
  workTimeLive: { color: '#b45309' },
  mapWrap: { height: 280, backgroundColor: '#cbd5e1' },
  mapPlaceholder: { flex: 1, position: 'relative' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sheetHeadline: { flex: 1, fontSize: 18, fontWeight: '800', color: '#0284c7' },
  statusPill: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  personRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 },
  personBlock: { flex: 1, minWidth: 0 },
  personName: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  vehicle: { fontSize: 14, fontWeight: '600', color: '#475569', marginTop: 2 },
  problemLine: { fontSize: 13, color: '#64748b', marginTop: 6 },
  callChip: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  callChipText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  photosLink: { marginTop: 6 },
  photosLinkText: { color: '#0284c7', fontWeight: '600', fontSize: 13 },
  connectionBanner: { marginTop: 6, color: '#dc2626', fontWeight: '600', fontSize: 13 },
  sheetScroll: { flex: 1 },
  sheetScrollContent: { flexGrow: 1 },
  sheetScrollWithFooter: { paddingBottom: 8 },
  headline: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  problem: { fontSize: 16, color: '#475569', marginTop: 4, marginBottom: 8 },
  summaryText: { marginTop: 12, fontWeight: '700', color: '#0f172a' },
  remarks: { marginTop: 8, color: '#475569', lineHeight: 20 },
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
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  photosCard: { backgroundColor: '#fff', padding: 20, borderRadius: 16, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  modalCloseBtn: {
    marginTop: 12,
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseBtnText: { color: '#fff', fontWeight: '800' },
});
