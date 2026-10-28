import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getApiErrorMessage } from '../../api/client';
import type { HelpRequest } from '../../api/helpRequests';
import { fetchMechanicHelpRequest, submitServiceQuote, updateJobStatus } from '../../api/mechanicHelp';
import { ServicePricingCard } from '../../components/ServicePricingCard';
import { ActiveJobLocationSummary } from '../../components/ActiveJobLocationSummary';
import { HelpRequestMap } from '../../components/HelpRequestMap';
import { HelpRequestMapLegend } from '../../components/HelpRequestMapLegend';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';
import { useMechanicLocationTracking } from '../../hooks/useMechanicLocationTracking';
import type { MechanicStackParamList } from '../../navigation/types';
import { jobStatusLabelOf, jobStatusOf, vehicleTitle } from '../../utils/helpRequestUi';

type Props = NativeStackScreenProps<MechanicStackParamList, 'ActiveJob'>;

function headerTitle(jobStatus: string, justAccepted: boolean) {
  if (justAccepted && jobStatus === 'ACCEPTED') return 'HELP REQUEST ACCEPTED';
  const map: Record<string, string> = {
    ACCEPTED: 'ACCEPTED',
    ON_THE_WAY: 'ON THE WAY',
    ARRIVED: 'ARRIVED',
    IN_PROGRESS: 'JOB IN PROGRESS',
    COMPLETED: 'JOB COMPLETED',
  };
  return map[jobStatus] ?? jobStatus;
}

export function MechanicActiveJobScreen({ route, navigation }: Props) {
  const { helpRequestId, justAccepted = false, initialRequest } = route.params;
  const [request, setRequest] = useState<HelpRequest | null>(initialRequest ?? null);
  const [loading, setLoading] = useState(!initialRequest);
  const [connectionLost, setConnectionLost] = useState(false);
  const [acting, setActing] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [servicePerformed, setServicePerformed] = useState('');
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteDescription, setQuoteDescription] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await fetchMechanicHelpRequest(helpRequestId);
      setRequest(data);
      setConnectionLost(false);
    } catch {
      setConnectionLost(true);
    } finally {
      setLoading(false);
    }
  }, [helpRequestId]);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(() => load(), 5000);
      return () => clearInterval(timer);
    }, [load]),
  );

  const jobStatus = request ? jobStatusOf(request) : '';
  const onTheWay = jobStatus === 'ON_THE_WAY';
  const mapEnabled = !!request && jobStatus !== 'COMPLETED';

  const { coords: deviceCoords, permissionDenied } = useDeviceLocation(mapEnabled);

  useMechanicLocationTracking({
    helpRequestId,
    enabled: onTheWay && !permissionDenied,
    tracking: request?.tracking,
  });

  const mechanicMapPoint = useMemo(() => {
    if (deviceCoords) {
      return { latitude: deviceCoords.latitude, longitude: deviceCoords.longitude, title: 'You' };
    }
    const server = request?.tracking?.mechanic_location;
    if (server) {
      return { latitude: server.latitude, longitude: server.longitude, title: 'You' };
    }
    return null;
  }, [deviceCoords, request?.tracking?.mechanic_location]);

  const setStatus = async (status: string, extra?: { service_performed?: string }) => {
    setActing(true);
    try {
      const updated = await updateJobStatus(helpRequestId, status, extra);
      setRequest(updated);
      setConnectionLost(false);
      if (status === 'COMPLETED') {
        setCompleteOpen(false);
        navigation.replace('MechanicRequestDetail', { helpRequestId });
      }
    } catch (e) {
      Alert.alert('Update failed', getApiErrorMessage(e));
      load();
    } finally {
      setActing(false);
    }
  };

  const startJourney = () => setStatus('ON_THE_WAY');

  const startNavigation = () => {
    if (!request) return;
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${request.latitude},${request.longitude}`,
    ).catch(() => {});
  };

  if (loading && !request) {
    return <ActivityIndicator style={{ marginTop: 40 }} />;
  }

  if (!request) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>{connectionLost ? 'Connection lost' : 'Job not found'}</Text>
        <Pressable style={styles.primaryBtn} onPress={() => load()}>
          <Text style={styles.primaryBtnText}>Retry</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('MechanicHome')}>
          <Text style={styles.link}>Back to dashboard</Text>
        </Pressable>
      </View>
    );
  }

  const tracking = request.tracking;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>{headerTitle(jobStatus, justAccepted)}</Text>

      {request.owner?.name && (
        <Text style={styles.customerName}>{request.owner.name}</Text>
      )}
      <Text style={styles.customerLabel}>Customer</Text>

      <Text style={styles.vehicle}>{vehicleTitle(request)}</Text>
      <Text style={styles.problem}>{request.problem_category?.name}</Text>
      <Text style={styles.remarks}>{request.remarks}</Text>
      <Text style={styles.status}>Status: {jobStatusLabelOf(request)}</Text>

      <ServicePricingCard pricing={request.job?.pricing} viewerRole="mechanic" />

      {(jobStatus === 'ACCEPTED' || jobStatus === 'ON_THE_WAY' || jobStatus === 'ARRIVED') &&
        request.job?.pricing?.quote_status !== 'accepted' && (
          <View style={styles.quoteBox}>
            <Text style={styles.quoteTitle}>Propose service quote</Text>
            <TextInput
              style={styles.input}
              placeholder="Amount (PHP)"
              keyboardType="number-pad"
              value={quoteAmount}
              onChangeText={setQuoteAmount}
            />
            <TextInput
              style={styles.input}
              placeholder="Description (optional)"
              value={quoteDescription}
              onChangeText={setQuoteDescription}
            />
            <Pressable
              style={styles.primaryBtn}
              disabled={acting || !quoteAmount.trim()}
              onPress={async () => {
                setActing(true);
                try {
                  const updated = await submitServiceQuote(
                    helpRequestId,
                    Number(quoteAmount),
                    quoteDescription.trim() || undefined,
                  );
                  setRequest(updated);
                } catch (e) {
                  Alert.alert('Quote failed', getApiErrorMessage(e));
                } finally {
                  setActing(false);
                }
              }}
            >
              <Text style={styles.primaryBtnText}>SEND QUOTE TO RIDER</Text>
            </Pressable>
          </View>
        )}

      <ActiveJobLocationSummary
        tracking={tracking}
        mechanicPermissionDenied={permissionDenied && onTheWay}
        connectionLost={connectionLost}
        viewerRole="mechanic"
      />

      <HelpRequestMap
        request={{ latitude: request.latitude, longitude: request.longitude, title: 'Customer' }}
        mechanic={mechanicMapPoint}
        height={280}
      />
      <HelpRequestMapLegend distanceKm={tracking?.distance_km} />

      {request.owner?.phone && (
        <Pressable onPress={() => Linking.openURL(`tel:${request.owner!.phone}`)}>
          <Text style={styles.link}>Call customer</Text>
        </Pressable>
      )}

      <View style={styles.actions}>
        {jobStatus === 'ACCEPTED' && (
          <Pressable style={styles.primaryBtn} disabled={acting} onPress={startJourney}>
            <Text style={styles.primaryBtnText}>START JOURNEY</Text>
          </Pressable>
        )}
        {(jobStatus === 'ON_THE_WAY' || jobStatus === 'ARRIVED' || jobStatus === 'IN_PROGRESS') && (
          <Pressable style={styles.navBtn} onPress={startNavigation}>
            <Text style={styles.navBtnText}>START NAVIGATION</Text>
          </Pressable>
        )}
        {jobStatus === 'ON_THE_WAY' && (
          <Pressable style={styles.primaryBtn} disabled={acting} onPress={() => setStatus('ARRIVED')}>
            <Text style={styles.primaryBtnText}>ARRIVED</Text>
          </Pressable>
        )}
        {jobStatus === 'ARRIVED' && (
          <Pressable style={styles.primaryBtn} disabled={acting} onPress={() => setStatus('IN_PROGRESS')}>
            <Text style={styles.primaryBtnText}>START JOB</Text>
          </Pressable>
        )}
        {jobStatus === 'IN_PROGRESS' && (
          <Pressable style={styles.primaryBtn} disabled={acting} onPress={() => setCompleteOpen(true)}>
            <Text style={styles.primaryBtnText}>COMPLETE JOB</Text>
          </Pressable>
        )}
      </View>

      <Modal visible={completeOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Complete job</Text>
            <TextInput
              style={styles.input}
              placeholder="Service performed (required)"
              value={servicePerformed}
              onChangeText={setServicePerformed}
              multiline
            />
            <Pressable
              style={styles.primaryBtn}
              disabled={acting || !servicePerformed.trim()}
              onPress={() =>
                setStatus('COMPLETED', {
                  service_performed: servicePerformed.trim(),
                  final_service_amount_php: request.job?.pricing?.quoted_service_amount_php ?? undefined,
                })
              }
            >
              <Text style={styles.primaryBtnText}>Submit</Text>
            </Pressable>
            <Pressable onPress={() => setCompleteOpen(false)}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: '#64748b', marginBottom: 12, textAlign: 'center' },
  header: { fontSize: 18, fontWeight: '800', color: '#166534', textAlign: 'center', marginBottom: 12 },
  customerName: { fontSize: 20, fontWeight: '700' },
  customerLabel: { color: '#64748b', fontSize: 13, textTransform: 'uppercase' },
  vehicle: { fontSize: 22, fontWeight: '700', marginTop: 8 },
  problem: { fontSize: 17, fontWeight: '600', marginTop: 8 },
  remarks: { color: '#475569', marginTop: 8, lineHeight: 22 },
  status: { marginTop: 10, color: '#0284c7', fontWeight: '700', fontSize: 16 },
  link: { color: '#0284c7', fontWeight: '600', marginTop: 12, textAlign: 'center' },
  actions: { marginTop: 20, gap: 10 },
  primaryBtn: { backgroundColor: '#16a34a', padding: 14, borderRadius: 10, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '800' },
  navBtn: { backgroundColor: '#0284c7', padding: 14, borderRadius: 10, alignItems: 'center' },
  navBtnText: { color: '#fff', fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, minHeight: 80, marginBottom: 12 },
  cancel: { textAlign: 'center', marginTop: 12, color: '#64748b' },
  quoteBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quoteTitle: { fontWeight: '700', marginBottom: 8 },
});
