import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
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
  type HelpRequest,
} from '../../api/helpRequests';
import { ServicePricingCard } from '../../components/ServicePricingCard';
import { ActiveJobLocationSummary } from '../../components/ActiveJobLocationSummary';
import { HelpRequestMap } from '../../components/HelpRequestMap';
import type { OwnerStackParamList } from '../../navigation/types';
import { jobStatusLabelOf, jobStatusOf } from '../../utils/helpRequestUi';

type Props = NativeStackScreenProps<OwnerStackParamList, 'ActiveHelpRequest'>;

function mechanicDisplayName(request: HelpRequest) {
  const m = request.mechanic;
  if (!m) return 'Mechanic';
  return m.display_name || m.mechanic_name || m.business_name || 'Mechanic';
}

function etaText(tracking: HelpRequest['tracking']) {
  if (!tracking?.eta) return null;
  const { label, minutes_min, minutes_max } = tracking.eta;
  if (label === 'Arrived' || label === 'Arriving') return label;
  return `${minutes_min}–${minutes_max} minutes`;
}

export function ActiveHelpRequestScreen({ route }: Props) {
  const { helpRequestId } = route.params;
  const [request, setRequest] = useState<HelpRequest | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const [quoteActing, setQuoteActing] = useState(false);

  useEffect(() => {
    const load = () =>
      fetchHelpRequest(helpRequestId)
        .then((data) => {
          setRequest(data);
          setConnectionLost(false);
        })
        .catch(() => setConnectionLost(true));
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [helpRequestId]);

  if (!request) {
    return (
      <View style={{ marginTop: 40, alignItems: 'center' }}>
        <ActivityIndicator />
        {connectionLost && <Text style={{ marginTop: 12, color: '#dc2626' }}>Connection lost</Text>}
      </View>
    );
  }

  const searching = request.status === 'SEARCHING';
  const jobStatus = jobStatusOf(request);
  const accepted =
    request.status === 'ACCEPTED' || ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'].includes(jobStatus);
  const tracking = request.tracking;
  const mechanicLoc = tracking?.mechanic_location;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>
        {searching
          ? 'SEARCHING FOR A MECHANIC'
          : accepted
            ? `${mechanicDisplayName(request)} accepted your request`
            : request.status_label ?? request.status}
      </Text>
      <Text style={styles.problem}>{request.problem_category?.name}</Text>
      <Text style={styles.remarks}>{request.remarks}</Text>
      <Text style={styles.meta}>Status: {accepted ? jobStatusLabelOf(request) : request.status_label ?? request.status}</Text>

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
              <Text>★ {request.mechanic.rating_average.toFixed(1)}</Text>
              {request.mechanic.verification_status && (
                <Text style={styles.verified}>
                  {request.mechanic.is_verified ? 'Verified mechanic' : 'Verification pending'}
                </Text>
              )}
              {request.mechanic.vehicle_types && request.mechanic.vehicle_types.length > 0 && (
                <Text style={styles.specialty}>
                  {request.mechanic.vehicle_types.map((t) => t.name).join(', ')}
                </Text>
              )}
            </View>
          </View>

          <ActiveJobLocationSummary
            tracking={tracking}
            connectionLost={connectionLost}
            viewerRole="owner"
          />

          {request.mechanic.phone && (
            <Pressable onPress={() => Linking.openURL(`tel:${request.mechanic!.phone}`)}>
              <Text style={styles.call}>Call mechanic</Text>
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

      {accepted && (
        <HelpRequestMap
          request={{
            latitude: request.latitude,
            longitude: request.longitude,
            title: 'Your location',
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
          height={240}
        />
      )}

      {tracking?.eta_disclaimer && <Text style={styles.disclaimer}>{tracking.eta_disclaimer}</Text>}

      {searching && (
        <Pressable
          style={styles.cancel}
          onPress={async () => {
            try {
              await cancelHelpRequest(helpRequestId);
            } catch (e) {
              Alert.alert('Cancel failed', getApiErrorMessage(e));
            }
          }}
        >
          <Text style={styles.cancelText}>Cancel request</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '700' },
  problem: { fontSize: 18, marginTop: 12 },
  remarks: { color: '#475569', marginTop: 8 },
  meta: { marginTop: 12, color: '#64748b' },
  card: { marginTop: 20, backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  mechanicRow: { flexDirection: 'row', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#e2e8f0' },
  mechanicInfo: { flex: 1 },
  shop: { fontSize: 17, fontWeight: '600' },
  verified: { color: '#16a34a', marginTop: 4, fontSize: 13 },
  specialty: { color: '#64748b', marginTop: 4, fontSize: 13 },
  tracking: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  trackingLine: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  live: { fontSize: 12, color: '#0284c7', marginTop: 6 },
  call: { color: '#0284c7', marginTop: 12, fontWeight: '600' },
  disclaimer: { marginTop: 12, fontSize: 12, color: '#94a3b8', textAlign: 'center' },
  cancel: { marginTop: 24, alignItems: 'center' },
  cancelText: { color: '#b91c1c' },
});
