import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { HelpRequest } from '../../api/helpRequests';
import { fetchMechanicHelpRequest } from '../../api/mechanicHelp';
import { CenteredLoading } from '../../components/CenteredLoading';
import { GrabStyleBottomSheet } from '../../components/GrabStyleBottomSheet';
import { HelpRequestMap } from '../../components/HelpRequestMap';
import { HelpRequestPhotoGallery } from '../../components/HelpRequestPhotoGallery';
import { MechanicCustomerDistance } from '../../components/MechanicCustomerDistance';
import { useLiveHelpRequestRefresh } from '../../hooks/useLiveHelpRequestRefresh';
import { useMechanicDistanceOrigin } from '../../hooks/useMechanicDistanceOrigin';
import { resolveMechanicToCustomerDistanceKm, resolveTrackingDistanceKm } from '../../utils/distanceKm';
import type { MechanicStackParamList } from '../../navigation/types';
import { MechanicJobPaymentCard, PaymentPlanLine } from '../../components/JobPaymentCards';
import {
  formatRequestDate,
  isActiveJobStatus,
  jobStatusLabelOf,
  jobStatusOf,
  problemNamesOf,
  vehicleWithDetails,
} from '../../utils/helpRequestUi';
import { jobWorkDurationLabel } from '../../utils/jobWorkDuration';
import { MechanicDeclineOfferModal } from '../../components/MechanicDeclineOfferModal';
import { MechanicIncomingOfferFooter } from '../../components/MechanicIncomingOfferFooter';
import { useMechanicAcceptAllowance } from '../../hooks/useMechanicAcceptAllowance';
import { useAppConfig } from '../../hooks/useAppConfig';
import { MechanicOfferUnavailableState } from '../../components/MechanicOfferUnavailableState';
import { useMechanicIncomingOfferActions } from '../../hooks/useMechanicIncomingOfferActions';
import { liveSheetScrollMax } from '../../utils/mapZoom';

type Props = NativeStackScreenProps<MechanicStackParamList, 'MechanicRequestDetail'>;

export function MechanicRequestDetailScreen({ route, navigation }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const sheetScrollMax = liveSheetScrollMax(windowHeight);
  const sheetScrollMaxAccept = Math.round(sheetScrollMax * 0.85);
  const { helpRequestId } = route.params;
  const [request, setRequest] = useState<HelpRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const { origin, permissionDenied, servicePinManual } = useMechanicDistanceOrigin('service_pin');

  const {
    acting,
    declineOpen,
    setDeclineOpen,
    unavailable,
    subscriptionBlocked,
    onAccept,
    submitDecline,
    applyLoadedRequest,
  } = useMechanicIncomingOfferActions({
    helpRequestId,
    navigation,
    origin,
    onRequestLoaded: setRequest,
    watchOfferAvailability: false,
    includeEndedOffers: false,
  });

  const allowance = useMechanicAcceptAllowance();
  const { config } = useAppConfig();
  const subscriptionsOn = config?.features?.mechanic_subscriptions ?? false;
  const acceptBlocked = allowance.blocked || subscriptionBlocked;
  const upgrade = acceptBlocked
    ? {
        message: subscriptionsOn
          ? `You’ve used your ${allowance.limit ?? 'free'} free requests. Get Mechanic Pro to accept this one.`
          : 'You’ve used your free requests, so you can’t accept new ones right now.',
        onUpgrade: subscriptionsOn ? () => navigation.navigate('MechanicSubscription') : undefined,
      }
    : null;

  const distanceKm = useMemo(
    () => (request ? resolveMechanicToCustomerDistanceKm(request, origin) : null),
    [request, origin],
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const r = await fetchMechanicHelpRequest(helpRequestId, origin ?? undefined);
        applyLoadedRequest(r);
        return r;
      } catch {
        if (!opts?.silent) applyLoadedRequest(null);
        return null;
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [helpRequestId, origin?.latitude, origin?.longitude, applyLoadedRequest],
  );

  useLiveHelpRequestRefresh({
    refresh: () => load({ silent: true }),
    request,
  });

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
  const isIncomingOffer = canAccept;

  const goBackIncoming = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('MechanicRequests', { tab: 'incoming' });
  };

  if (loading && !request) {
    return <CenteredLoading message="Loading request…" />;
  }

  if (unavailable) {
    return <MechanicOfferUnavailableState kind={unavailable} onGoBack={goBackIncoming} />;
  }

  if (!request) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Request not found.</Text>
      </View>
    );
  }

  const job = request.job;
  const workDurationLabel = job ? jobWorkDurationLabel(job) : null;
  const jobStatus = jobStatusOf(request);
  const trackingLoc = request.tracking?.mechanic_location;
  const liveDistance = resolveTrackingDistanceKm(request.tracking) ?? distanceKm;
  const showLiveMap =
    !isIncomingOffer &&
    !!trackingLoc &&
    ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'].includes(jobStatus);

  return (
    <View style={styles.root}>
      <View style={styles.mapArea}>
        <HelpRequestMap
          request={{ latitude: request.latitude, longitude: request.longitude, title: 'Customer' }}
          mechanic={
            showLiveMap && trackingLoc
              ? {
                  latitude: trackingLoc.latitude,
                  longitude: trackingLoc.longitude,
                  title: 'You',
                }
              : null
          }
          requestPinLabel="Customer"
          mechanicPinLabel="You"
          fill
          zoomPreset={showLiveMap || isIncomingOffer ? 'live' : 'detail'}
          showRouteLine={showLiveMap}
          liveDistanceKm={showLiveMap ? liveDistance : isIncomingOffer ? distanceKm : null}
          showLiveDistanceBadge={showLiveMap || (isIncomingOffer && distanceKm != null)}
          showMyLocation={false}
        />
      </View>

      <View style={styles.sheetDock} pointerEvents="box-none">
        <GrabStyleBottomSheet compact bottomInset={canAccept ? 108 : 0}>
          <ScrollView
            style={[
              styles.sheetScroll,
              { maxHeight: canAccept ? sheetScrollMaxAccept : sheetScrollMax },
            ]}
            contentContainerStyle={styles.sheetScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {request.request_type === 'EMERGENCY' ? (
              <Text style={styles.emergency}>Emergency</Text>
            ) : null}

            <View style={styles.titleRow}>
              <Text style={styles.headline} numberOfLines={2}>
                {problemNamesOf(request)}
              </Text>
              <Text style={styles.statusPill}>{jobStatusLabelOf(request)}</Text>
            </View>

            <MechanicCustomerDistance
              distanceKm={liveDistance}
              compact
              fromServicePin={servicePinManual || origin != null}
              locationUnavailable={permissionDenied && liveDistance == null}
            />

            <Text style={styles.meta}>
              {isIncomingOffer
                ? `Offer · ${formatRequestDate(request.created_at)}`
                : `Created · ${formatRequestDate(request.created_at)}`}
            </Text>

            <Text style={styles.lead} numberOfLines={3}>
              {request.remarks}
            </Text>
            <Text style={styles.vehicle} numberOfLines={1}>
              {vehicleWithDetails(request)}
            </Text>
            <PaymentPlanLine request={request} />

            {isIncomingOffer ? (
              <Text style={styles.unlockHint}>Customer details unlock after you accept.</Text>
            ) : (
              <View style={styles.compactBlock}>
                <Text style={styles.compactLabel}>Customer</Text>
                <Text style={styles.compactStrong}>{request.owner?.name ?? '—'}</Text>
                {request.owner?.phone ? (
                  <Pressable onPress={() => Linking.openURL(`tel:${request.owner!.phone}`)}>
                    <Text style={styles.link}>{request.owner.phone}</Text>
                  </Pressable>
                ) : null}
              </View>
            )}

            <View style={styles.compactBlock}>
              <Text style={styles.compactLabel}>Location</Text>
              <Text style={styles.compactBody} numberOfLines={2}>
                {request.address_text ?? `${request.latitude}, ${request.longitude}`}
              </Text>
              <Text style={styles.mapHint}>
                {showLiveMap || isIncomingOffer
                  ? 'Customer location is on the map above.'
                  : 'Location is shown on the map when the job is active.'}
              </Text>
            </View>

            {request.answers?.length ? (
              <View style={styles.compactBlock}>
                <Text style={styles.compactLabel}>Details</Text>
                {request.answers.map((a) => (
                  <View key={a.question_id} style={styles.answer}>
                    <Text style={styles.muted}>{a.question}</Text>
                    <Text style={styles.answerValue}>{a.answer}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {request.media && request.media.length > 0 ? (
              <HelpRequestPhotoGallery media={request.media} title="Customer photos" compact />
            ) : null}

            {job ? (
              <View style={styles.compactBlock}>
                <Text style={styles.compactLabel}>Job timeline</Text>
                {workDurationLabel ? <Text style={styles.workDuration}>{workDurationLabel}</Text> : null}
                <TimelineRow label="Accepted" value={job.accepted_at} />
                <TimelineRow label="On the way" value={job.on_the_way_at} />
                <TimelineRow label="Arrived" value={job.arrived_at} />
                <TimelineRow label="Started" value={job.started_at} />
                <TimelineRow label="Completed" value={job.completed_at} />
                {job.service_performed ? (
                  <Text style={styles.remarks}>Service: {job.service_performed}</Text>
                ) : null}
                {job.shop?.name ? <Text style={styles.remarks}>Shop: {job.shop.name}</Text> : null}
              </View>
            ) : null}

            {!isIncomingOffer && jobStatus === 'COMPLETED' ? (
              <MechanicJobPaymentCard request={request} onUpdated={setRequest} />
            ) : null}

            {request.review ? (
              <View style={styles.compactBlock}>
                <Text style={styles.compactLabel}>Customer review</Text>
                <Text style={styles.compactStrong}>★ {request.review.rating}</Text>
                {request.review.comment ? (
                  <Text style={styles.remarks}>{request.review.comment}</Text>
                ) : null}
              </View>
            ) : null}

            {isDeclined && request.mechanic_dispatch?.responded_at ? (
              <Text style={styles.muted}>
                Declined {formatRequestDate(request.mechanic_dispatch.responded_at)}
              </Text>
            ) : null}
          </ScrollView>
        </GrabStyleBottomSheet>
      </View>

      {canAccept ? (
        <>
          <MechanicIncomingOfferFooter
            acting={acting}
            onAccept={onAccept}
            onDecline={() => setDeclineOpen(true)}
            upgrade={upgrade}
          />
          <MechanicDeclineOfferModal
            visible={declineOpen}
            busy={acting}
            onClose={() => setDeclineOpen(false)}
            onConfirm={submitDecline}
          />
        </>
      ) : null}
    </View>
  );
}

function TimelineRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <Text style={styles.timeline}>
      {label}: {formatRequestDate(value)}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  mapArea: { ...StyleSheet.absoluteFill, backgroundColor: '#cbd5e1' },
  sheetDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetScroll: {},
  sheetScrollContent: { paddingBottom: 4 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  muted: { color: '#64748b', fontSize: 13 },
  emergency: {
    alignSelf: 'flex-start',
    color: '#991b1b',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  headline: { flex: 1, fontSize: 18, fontWeight: '800', color: '#0f172a' },
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
  meta: { marginTop: 4, color: '#64748b', fontSize: 12 },
  lead: { marginTop: 6, color: '#334155', fontSize: 14, lineHeight: 19 },
  vehicle: { marginTop: 4, fontWeight: '700', fontSize: 14, color: '#0f172a' },
  unlockHint: { marginTop: 8, fontSize: 12, color: '#64748b' },
  compactBlock: { marginTop: 12 },
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
  remarks: { marginTop: 4, color: '#334155', fontSize: 13 },
  answer: { marginTop: 6 },
  answerValue: { color: '#0f172a', fontWeight: '600', marginTop: 1 },
  link: { color: '#0284c7', fontWeight: '700', marginTop: 4, fontSize: 13 },
  mapHint: { color: '#64748b', fontWeight: '600', marginTop: 6, fontSize: 13, lineHeight: 18 },
  timeline: { marginTop: 2, color: '#475569', fontSize: 13 },
  workDuration: { fontSize: 15, fontWeight: '800', color: '#166534', marginBottom: 4 },
});
