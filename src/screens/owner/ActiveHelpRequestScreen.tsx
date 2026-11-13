import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getApiErrorMessage } from '../../api/client';
import { CenteredLoading } from '../../components/CenteredLoading';
import {
  cancelHelpRequest,
  extendHelpRequest,
  fetchHelpRequest,
  submitHelpRequestReview,
  type HelpRequest,
} from '../../api/helpRequests';
import { ActiveJobLocationSummary } from '../../components/ActiveJobLocationSummary';
import { AndroidHideNavigationBarWhenFocused } from '../../components/AndroidHideNavigationBarWhenFocused';
import { CancelHelpRequestButton } from '../../components/CancelHelpRequestButton';
import { HelpRequestCompletionPanel } from '../../components/HelpRequestCompletionPanel';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from '../../components/KeyboardAwareScrollView';
import { HelpRequestPhotoGallery } from '../../components/HelpRequestPhotoGallery';
import { GrabStyleBottomSheet } from '../../components/GrabStyleBottomSheet';
import { HelpJourneyTimeline } from '../../components/HelpJourneyTimeline';
import { HelpRequestSearchingHero } from '../../components/HelpRequestSearchingHero';
import { JobWorkDurationText } from '../../components/JobWorkDurationText';
import { HelpRequestMap } from '../../components/HelpRequestMap';
import type { OwnerStackParamList } from '../../navigation/types';
import {
  activeJourneyHeadline,
  buildActiveJobJourneySteps,
  buildHelpJourneySteps,
} from '../../utils/helpJourney';
import { haversineDistanceKm } from '../../utils/distanceKm';
import {
  canOwnerCancelHelpRequest,
  jobStatusOf,
  vehicleTitle,
} from '../../utils/helpRequestUi';
import { needHelpParamsFromHelpRequest } from '../../utils/needHelpDraft';

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
  const { helpRequestId, initialRequest } = route.params;
  const [request, setRequest] = useState<HelpRequest | null>(() =>
    initialRequest?.id === helpRequestId ? initialRequest : null,
  );
  const [connectionLost, setConnectionLost] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const cancelLock = useRef(false);
  const extendPromptShown = useRef(false);
  const extendLock = useRef(false);
  const reviewScrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const scrollReviewIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      reviewScrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const pollMs =
    (request?.job_status ?? request?.job?.status) === 'IN_PROGRESS' ? 1000 : 2000;

  // Always drop previous request data when opening a different HELP request (cancel → new).
  useEffect(() => {
    cancelLock.current = false;
    extendPromptShown.current = false;
    extendLock.current = false;
    setConnectionLost(false);
    const seed = route.params.initialRequest;
    setRequest(seed?.id === helpRequestId ? seed : null);
    // Only re-seed when the HELP request id changes — not on every params object identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: helpRequestId is the reset signal
  }, [helpRequestId]);

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

  useEffect(() => {
    if (!request || request.status !== 'SEARCHING') {
      extendPromptShown.current = false;
      return;
    }
    if (!request.owner_wait?.needs_extension_decision || extendPromptShown.current) {
      return;
    }
    extendPromptShown.current = true;
    const extensionMinutes = Math.max(
      1,
      Math.round((request.owner_wait.extension_seconds || 300) / 60),
    );
    Alert.alert(
      'Still no mechanic',
      `Nobody accepted yet. Add ${extensionMinutes} more minute${extensionMinutes === 1 ? '' : 's'}, or cancel this request.`,
      [
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
              extendPromptShown.current = false;
              Alert.alert('Cancel failed', getApiErrorMessage(e));
            }
          },
        },
        {
          text: `Extend ${extensionMinutes} min`,
          onPress: async () => {
            if (extendLock.current) return;
            extendLock.current = true;
            try {
              const updated = await extendHelpRequest(helpRequestId);
              setRequest(updated);
            } catch (e) {
              extendPromptShown.current = false;
              Alert.alert('Could not extend', getApiErrorMessage(e));
            } finally {
              extendLock.current = false;
            }
          },
        },
      ],
      { cancelable: false },
    );
  }, [request, helpRequestId]);

  const journeySteps = useMemo(() => (request ? buildHelpJourneySteps(request) : []), [request]);
  const activeJobJourneySteps = useMemo(
    () => (request ? buildActiveJobJourneySteps(request) : []),
    [request],
  );

  const liveDistanceKm = useMemo(() => liveDistanceKmForRequest(request), [request]);

  if (!request) {
    return (
      <CenteredLoading
        message={connectionLost ? 'Connection lost — retrying…' : 'Loading your request…'}
        style={connectionLost ? styles.loadingError : undefined}
      />
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
          <HelpJourneyTimeline steps={activeJobJourneySteps} compact />

          <Text style={styles.sheetHeadline} numberOfLines={2}>
            {activeJourneyHeadline(request)}
          </Text>

          <Text style={styles.plansChangeHint}>
            {request.mechanic.phone
              ? 'A mechanic has accepted this request. Call them if your plans change — cancellation is no longer available in the app.'
              : 'A mechanic has accepted this request. Contact them if your plans change — cancellation is no longer available in the app.'}
          </Text>

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

          <Text style={styles.problemLine} numberOfLines={workStarted ? 1 : 2}>
            {request.problem_category?.name}
            {request.remarks ? ` · ${request.remarks}` : ''}
          </Text>

          {workStarted ? (
            <JobWorkDurationText
              job={request.job}
              jobStatus={jobStatus}
              style={styles.workTime}
              liveStyle={styles.workTimeLive}
            />
          ) : (
            <ActiveJobLocationSummary
              tracking={tracking}
              connectionLost={connectionLost}
              viewerRole="owner"
              compact
            />
          )}

          {connectionLost ? (
            <Text style={styles.connectionBanner}>Connection lost — map may be outdated</Text>
          ) : null}

          {photoCount > 0 ? (
            <Pressable style={styles.photosLink} onPress={() => setPhotosOpen(true)}>
              <Text style={styles.photosLinkText}>View problem photos ({photoCount})</Text>
            </Pressable>
          ) : null}
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

  if (searching) {
    return (
      <View style={styles.root}>
        <View style={styles.mapHalf}>
          <HelpRequestMap
            request={{
              latitude: request.latitude,
              longitude: request.longitude,
              title: 'You',
            }}
            requestPinLabel="You"
            fill
            showMyLocation={false}
          />
        </View>

        <View style={styles.detailsHalf}>
          <GrabStyleBottomSheet fill flush bottomInset={canCancel ? 72 : 0}>
            <Text style={styles.headlineSearching}>Finding a mechanic</Text>
            {request.problem_category?.name ? (
              <Text style={styles.problemSearching} numberOfLines={1}>
                {request.problem_category.name}
              </Text>
            ) : null}
            <View style={styles.searchingHeroWrap}>
              <HelpRequestSearchingHero
                key={`wait-${request.id}-${request.expires_at ?? request.owner_wait?.expires_at ?? ''}`}
                startedAt={
                  request.search_started_at ?? request.created_at ?? new Date().toISOString()
                }
                expiresAt={request.expires_at ?? request.owner_wait?.expires_at}
                isExtended={!!request.owner_wait?.is_extended}
                progress={request.search_progress}
              />
            </View>
          </GrabStyleBottomSheet>
          {canCancel ? <CancelHelpRequestButton fixedFooter onPress={confirmCancel} /> : null}
        </View>
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
        </View>
      </View>

      <KeyboardAwareScrollView
        ref={reviewScrollRef}
        style={styles.sheetScroll}
        extraBottomPadding={completed ? 160 : 0}
        contentContainerStyle={styles.sheetScrollContent}
      >
        <GrabStyleBottomSheet>
          <Text style={styles.headline}>{activeJourneyHeadline(request)}</Text>
          {request.problem_category?.name ? (
            <Text style={styles.problem}>{request.problem_category.name}</Text>
          ) : null}

          <HelpJourneyTimeline steps={journeySteps} compact />

          {(failedMatch || cancelled) && (
            <View style={styles.terminalCard}>
              <Text style={styles.terminalTitle}>{request.status_label ?? request.status}</Text>
              <Text style={styles.terminalBody}>
                {failedMatch
                  ? request.status === 'EXPIRED'
                    ? 'No mechanic accepted in time. You can send a new request anytime.'
                    : 'No mechanic accepted in time. Try again or browse nearby listings.'
                  : 'This request was cancelled. You can send a new one anytime.'}
              </Text>
              <View style={styles.terminalActions}>
                <Pressable
                  style={styles.retryBtn}
                  onPress={() =>
                    navigation.replace('NeedHelp', needHelpParamsFromHelpRequest(request))
                  }
                >
                  <Text style={styles.retryBtnText}>
                    {cancelled ? 'Request help again' : 'Try again'}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.browseBtn}
                  onPress={() => navigation.navigate('FindMechanic')}
                >
                  <Text style={styles.browseBtnText}>Browse nearby mechanics</Text>
                </Pressable>
              </View>
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

          {!completed && (
            <>
              <Text style={styles.summaryText}>{vehicleTitle(request)}</Text>
              <Text style={styles.remarks}>{request.remarks}</Text>
            </>
          )}

          <HelpRequestPhotoGallery media={request.media} title="Problem photos" compact />
        </GrabStyleBottomSheet>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  loadingError: { backgroundColor: '#fef2f2' },
  mapArea: { flex: 1, backgroundColor: '#cbd5e1' },
  sheetHeadline: { fontSize: 18, fontWeight: '800', color: '#0284c7', marginTop: 8 },
  plansChangeHint: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: '#475569',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
  },
  workTime: { marginTop: 4 },
  workTimeLive: { color: '#b45309' },
  mapWrap: { height: 280, backgroundColor: '#cbd5e1' },
  mapPlaceholder: { flex: 1, position: 'relative' },
  mapHalf: {
    flex: 1,
    backgroundColor: '#cbd5e1',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 0,
  },
  detailsHalf: {
    flex: 1,
    backgroundColor: '#fff',
    position: 'relative',
    marginTop: 0,
  },
  searchingHeroWrap: { flex: 1, marginTop: 4, minHeight: 0 },
  headlineSearching: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  problemSearching: { fontSize: 14, color: '#64748b', marginTop: 2, marginBottom: 4 },
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
  terminalActions: { marginTop: 14, gap: 10 },
  retryBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  browseBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0284c7',
    backgroundColor: '#fff',
  },
  browseBtnText: { color: '#0284c7', fontWeight: '700' },
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
