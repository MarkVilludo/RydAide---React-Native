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
import { HelpRequestPhotoGallery } from '../../components/HelpRequestPhotoGallery';
import { MechanicCustomerDistance } from '../../components/MechanicCustomerDistance';
import { MechanicDeclineOfferModal } from '../../components/MechanicDeclineOfferModal';
import { MechanicIncomingOfferFooter } from '../../components/MechanicIncomingOfferFooter';
import { MechanicOfferUnavailableState } from '../../components/MechanicOfferUnavailableState';
import { useMechanicIncomingOfferActions } from '../../hooks/useMechanicIncomingOfferActions';
import { useMechanicDistanceOrigin } from '../../hooks/useMechanicDistanceOrigin';
import { resolveMechanicToCustomerDistanceKm } from '../../utils/distanceKm';
import { formatElapsedSeconds } from '../../utils/formatElapsed';
import type { MechanicStackParamList } from '../../navigation/types';
import { vehicleTitle } from '../../utils/helpRequestUi';

type Props = NativeStackScreenProps<MechanicStackParamList, 'IncomingRequestDetail'>;

const FOOTER_SPACE = 132;

export function MechanicIncomingRequestDetailScreen({ route, navigation }: Props) {
  const { helpRequestId } = route.params;
  const [request, setRequest] = useState<HelpRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const { origin, permissionDenied, servicePinManual } = useMechanicDistanceOrigin('service_pin');

  const distanceKm = useMemo(
    () => (request ? resolveMechanicToCustomerDistanceKm(request, origin) : null),
    [request, origin],
  );

  const {
    acting,
    declineOpen,
    setDeclineOpen,
    unavailable,
    onAccept,
    submitDecline,
    applyLoadedRequest,
  } = useMechanicIncomingOfferActions({
    helpRequestId,
    navigation,
    origin,
    onRequestLoaded: setRequest,
    watchOfferAvailability: true,
  });

  const load = useCallback(() => {
    setLoading(true);
    fetchMechanicHelpRequest(helpRequestId, origin ?? undefined)
      .then((r) => applyLoadedRequest(r))
      .catch(() => applyLoadedRequest(null))
      .finally(() => setLoading(false));
  }, [helpRequestId, origin?.latitude, origin?.longitude, applyLoadedRequest]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openMaps = () => {
    if (!request) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${request.latitude},${request.longitude}`;
    Linking.openURL(url).catch(() => {});
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
        <Text style={styles.muted}>Request not found or no longer available.</Text>
        <Pressable onPress={goBackIncoming}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const isEmergency = request.request_type === 'EMERGENCY';
  const showActions = request.status === 'SEARCHING' && request.mechanic_dispatch?.response !== 'declined';
  const [acceptSecondsLeft, setAcceptSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!showActions || !request.expires_at) {
      setAcceptSecondsLeft(null);
      return;
    }
    const expiresMs = new Date(request.expires_at).getTime();
    const tick = () => {
      if (Number.isNaN(expiresMs)) {
        setAcceptSecondsLeft(null);
        return;
      }
      setAcceptSecondsLeft(Math.max(0, Math.floor((expiresMs - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [showActions, request.expires_at]);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, showActions && { paddingBottom: FOOTER_SPACE }]}
      >
        {isEmergency && <Text style={styles.emergency}>🚨 New emergency request</Text>}

        {acceptSecondsLeft != null ? (
          <Text style={styles.acceptWindow}>
            Accept within {formatElapsedSeconds(acceptSecondsLeft)}
          </Text>
        ) : null}

        <MechanicCustomerDistance
          distanceKm={distanceKm}
          fromServicePin={servicePinManual || origin != null}
          locationUnavailable={permissionDenied && distanceKm == null}
        />

        {request.owner?.name && (
          <Text style={styles.ownerName}>Vehicle owner: {request.owner.name}</Text>
        )}

        <Text style={styles.vehicle}>{vehicleTitle(request)}</Text>
        {request.vehicle?.current_mileage != null && (
          <Text style={styles.mileage}>{request.vehicle.current_mileage.toLocaleString()} km</Text>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Problem</Text>
          <Text style={styles.problem}>{request.problem_category?.name ?? '—'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What happened</Text>
          <Text style={styles.remarks}>{request.remarks}</Text>
        </View>

        {request.answers && request.answers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            {request.answers.map((a) => (
              <View key={a.question_id} style={styles.answerRow}>
                <Text style={styles.question}>{a.question ?? 'Question'}</Text>
                <Text style={styles.answer}>{a.answer}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <Text style={styles.address}>
            {request.address_text ?? `${request.latitude.toFixed(5)}, ${request.longitude.toFixed(5)}`}
          </Text>
          <Pressable style={styles.mapBtn} onPress={openMaps}>
            <Text style={styles.mapBtnText}>Open in maps</Text>
          </Pressable>
        </View>

        {request.media && request.media.length > 0 ? (
          <View style={styles.section}>
            <HelpRequestPhotoGallery media={request.media} title="Customer photos" />
          </View>
        ) : null}
      </ScrollView>

      {showActions ? (
        <>
          <MechanicIncomingOfferFooter
            acting={acting}
            onAccept={onAccept}
            onDecline={() => setDeclineOpen(true)}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: '#64748b', textAlign: 'center' },
  link: { color: '#0284c7', marginTop: 12, fontWeight: '600' },
  emergency: { color: '#dc2626', fontWeight: '800', fontSize: 15, marginBottom: 8 },
  acceptWindow: {
    color: '#b45309',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 10,
    backgroundColor: '#fffbeb',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  ownerName: { fontSize: 16, fontWeight: '600', color: '#334155', marginBottom: 6 },
  vehicle: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  mileage: { color: '#64748b', marginTop: 4, marginBottom: 12 },
  section: {
    marginTop: 16,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: 6 },
  problem: { fontSize: 18, fontWeight: '600' },
  remarks: { color: '#334155', lineHeight: 22 },
  answerRow: { marginTop: 8 },
  question: { fontSize: 13, color: '#64748b' },
  answer: { fontWeight: '600', marginTop: 2, textTransform: 'capitalize' },
  address: { color: '#475569', marginTop: 4 },
  mapBtn: { marginTop: 10, alignSelf: 'flex-start' },
  mapBtnText: { color: '#0284c7', fontWeight: '600' },
});
