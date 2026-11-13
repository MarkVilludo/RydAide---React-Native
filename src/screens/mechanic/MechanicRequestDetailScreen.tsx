import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { HelpRequest } from '../../api/helpRequests';
import { fetchMechanicHelpRequest } from '../../api/mechanicHelp';
import { CenteredLoading } from '../../components/CenteredLoading';
import { GrabStyleBottomSheet } from '../../components/GrabStyleBottomSheet';
import { HelpRequestMap } from '../../components/HelpRequestMap';
import { HelpRequestPhotoGallery } from '../../components/HelpRequestPhotoGallery';
import { MechanicCustomerDistance } from '../../components/MechanicCustomerDistance';
import { useMechanicDistanceOrigin } from '../../hooks/useMechanicDistanceOrigin';
import { resolveMechanicToCustomerDistanceKm } from '../../utils/distanceKm';
import type { MechanicStackParamList } from '../../navigation/types';
import { formatRequestDate, isActiveJobStatus, jobStatusLabelOf, jobStatusOf, vehicleTitle } from '../../utils/helpRequestUi';
import { jobWorkDurationLabel } from '../../utils/jobWorkDuration';
import { MechanicDeclineOfferModal } from '../../components/MechanicDeclineOfferModal';
import { MechanicIncomingOfferFooter } from '../../components/MechanicIncomingOfferFooter';
import { useMechanicAcceptAllowance } from '../../hooks/useMechanicAcceptAllowance';
import { useAppConfig } from '../../hooks/useAppConfig';
import { MechanicOfferUnavailableState } from '../../components/MechanicOfferUnavailableState';
import { useMechanicIncomingOfferActions } from '../../hooks/useMechanicIncomingOfferActions';

type Props = NativeStackScreenProps<MechanicStackParamList, 'MechanicRequestDetail'>;

const INCOMING_FOOTER_SPACE = 132;

export function MechanicRequestDetailScreen({ route, navigation }: Props) {
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

  const load = useCallback(() => {
    setLoading(true);
    fetchMechanicHelpRequest(helpRequestId, origin ?? undefined)
      .then((r) => applyLoadedRequest(r))
      .catch(() => applyLoadedRequest(null))
      .finally(() => setLoading(false));
  }, [helpRequestId, origin?.latitude, origin?.longitude, applyLoadedRequest]);

  useFocusEffect(useCallback(() => load(), [load]));

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

  const openMaps = () => {
    if (!request) return;
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${request.latitude},${request.longitude}`,
    ).catch(() => {});
  };

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

  return (
    <View style={styles.root}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, canAccept && { paddingBottom: INCOMING_FOOTER_SPACE + (upgrade ? 56 : 0) }]}
    >
      {request.request_type === 'EMERGENCY' && <Text style={styles.emergency}>Emergency request</Text>}
      {isIncomingOffer ? (
        <>
          <HelpRequestMap
            request={{ latitude: request.latitude, longitude: request.longitude, title: 'Customer' }}
            height={200}
            zoomPreset="detail"
            showLiveDistanceBadge={false}
          />
          <GrabStyleBottomSheet>
            <MechanicCustomerDistance
              distanceKm={distanceKm}
              fromServicePin={servicePinManual || origin != null}
              locationUnavailable={permissionDenied && distanceKm == null}
            />
            <Text style={styles.incomingTitle}>{request.problem_category?.name}</Text>
            <Text style={styles.created}>Offer received {formatRequestDate(request.created_at)}</Text>
            <Text style={styles.remarks}>{request.remarks}</Text>
            <Text style={styles.bold}>{vehicleTitle(request)}</Text>
            <Text style={styles.muted}>Customer details unlock after you accept.</Text>
            {request.answers?.map((a) => (
              <View key={a.question_id} style={styles.answer}>
                <Text style={styles.muted}>{a.question}</Text>
                <Text>{a.answer}</Text>
              </View>
            ))}
          </GrabStyleBottomSheet>
        </>
      ) : (
        <>
          <Text style={styles.status}>Status: {jobStatusLabelOf(request)}</Text>
          <Text style={styles.created}>Created {formatRequestDate(request.created_at)}</Text>
          <Section title="Customer">
            <Text style={styles.bold}>{request.owner?.name ?? '—'}</Text>
            {request.owner?.phone && <Text>{request.owner.phone}</Text>}
          </Section>
        </>
      )}

      {!isIncomingOffer && (
        <>
          <Section title="Vehicle">
            <Text style={styles.bold}>{vehicleTitle(request)}</Text>
            {request.vehicle?.year != null && <Text>Year: {request.vehicle.year}</Text>}
            {request.vehicle?.current_mileage != null && (
              <Text>Mileage: {request.vehicle.current_mileage.toLocaleString()} km</Text>
            )}
          </Section>

          <Section title="Problem">
            <Text style={styles.bold}>{request.problem_category?.name}</Text>
            <Text style={styles.remarks}>{request.remarks}</Text>
            {request.answers?.map((a) => (
              <View key={a.question_id} style={styles.answer}>
                <Text style={styles.muted}>{a.question}</Text>
                <Text>{a.answer}</Text>
              </View>
            ))}
          </Section>

          <Section title="Location">
            <MechanicCustomerDistance
              distanceKm={distanceKm}
              compact
              fromServicePin={servicePinManual || origin != null}
              locationUnavailable={permissionDenied && distanceKm == null}
            />
            <Text>{request.address_text ?? `${request.latitude}, ${request.longitude}`}</Text>
            <HelpRequestMap
              request={{ latitude: request.latitude, longitude: request.longitude, title: 'Customer' }}
              height={180}
              zoomPreset="detail"
              showLiveDistanceBadge={false}
            />
            <Pressable onPress={openMaps}>
              <Text style={styles.link}>Open in maps</Text>
            </Pressable>
          </Section>
        </>
      )}

      {request.media && request.media.length > 0 ? (
        <Section title="Photos">
          <HelpRequestPhotoGallery media={request.media} title="Customer photos" />
        </Section>
      ) : null}

      {job && (
        <Section title="Job timeline">
          {workDurationLabel ? <Text style={styles.workDuration}>{workDurationLabel}</Text> : null}
          <TimelineRow label="Accepted" value={job.accepted_at} />
          <TimelineRow label="On the way" value={job.on_the_way_at} />
          <TimelineRow label="Arrived" value={job.arrived_at} />
          <TimelineRow label="Started" value={job.started_at} />
          <TimelineRow label="Completed" value={job.completed_at} />
          {job.service_performed && <Text style={styles.remarks}>Service: {job.service_performed}</Text>}
          {job.shop?.name && <Text>Shop: {job.shop.name}</Text>}
        </Section>
      )}

      {request.review && (
        <Section title="Customer review">
          <Text>★ {request.review.rating}</Text>
          {request.review.comment && <Text>{request.review.comment}</Text>}
        </Section>
      )}

      {isDeclined && request.mechanic_dispatch?.responded_at && (
        <Text style={styles.muted}>Declined {formatRequestDate(request.mechanic_dispatch.responded_at)}</Text>
      )}

    </ScrollView>

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function TimelineRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return <Text style={styles.timeline}>{label}: {formatRequestDate(value)}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#64748b' },
  emergency: { color: '#dc2626', fontWeight: '800' },
  status: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  created: { color: '#64748b', marginBottom: 12 },
  section: {
    marginTop: 14,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: { fontWeight: '700', marginBottom: 8, color: '#64748b', textTransform: 'uppercase', fontSize: 12 },
  bold: { fontWeight: '600', fontSize: 16 },
  remarks: { marginTop: 6, color: '#334155' },
  answer: { marginTop: 8 },
  link: { color: '#0284c7', fontWeight: '600', marginTop: 8 },
  timeline: { marginTop: 4, color: '#334155' },
  workDuration: { fontSize: 16, fontWeight: '800', color: '#166534', marginBottom: 8 },
  incomingTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  distance: { fontSize: 16, fontWeight: '700', color: '#0284c7', marginTop: 4 },
});
