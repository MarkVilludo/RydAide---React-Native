import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getApiErrorMessage } from '../../api/client';
import type { HelpRequest } from '../../api/helpRequests';
import { fetchMechanicHelpRequest, updateJobStatus } from '../../api/mechanicHelp';
import { ActiveJobLocationSummary } from '../../components/ActiveJobLocationSummary';
import { GrabStyleBottomSheet } from '../../components/GrabStyleBottomSheet';
import { JobWorkDurationText } from '../../components/JobWorkDurationText';
import { HelpRequestMap } from '../../components/HelpRequestMap';
import { HelpRequestPhotoGallery } from '../../components/HelpRequestPhotoGallery';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';
import { useMechanicDistanceOrigin } from '../../hooks/useMechanicDistanceOrigin';
import { useMechanicLocationTracking } from '../../hooks/useMechanicLocationTracking';
import { haversineDistanceKm, resolveMechanicToCustomerDistanceKm, resolveTrackingDistanceKm } from '../../utils/distanceKm';
import type { MechanicStackParamList } from '../../navigation/types';
import { jobStatusLabelOf, jobStatusOf, vehicleTitle } from '../../utils/helpRequestUi';

type Props = NativeStackScreenProps<MechanicStackParamList, 'ActiveJob'>;

function headerTitle(jobStatus: string, justAccepted: boolean) {
  if (justAccepted && jobStatus === 'ACCEPTED') return 'Help request accepted';
  const map: Record<string, string> = {
    ACCEPTED: 'Accepted',
    ON_THE_WAY: 'On the way',
    ARRIVED: 'Arrived',
    IN_PROGRESS: 'Job in progress',
    COMPLETED: 'Job completed',
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
  const [photosOpen, setPhotosOpen] = useState(false);
  const [servicePerformed, setServicePerformed] = useState('');
  const [finalAmount, setFinalAmount] = useState('');

  const { origin } = useMechanicDistanceOrigin('live');

  const load = useCallback(async () => {
    try {
      const data = await fetchMechanicHelpRequest(helpRequestId, origin ?? undefined);
      setRequest(data);
      setConnectionLost(false);
    } catch {
      setConnectionLost(true);
    } finally {
      setLoading(false);
    }
  }, [helpRequestId, origin?.latitude, origin?.longitude]);

  const jobStatus = request ? jobStatusOf(request) : '';
  const refreshMs = jobStatus === 'IN_PROGRESS' ? 1000 : 5000;

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(() => load(), refreshMs);
      return () => clearInterval(timer);
    }, [load, refreshMs]),
  );
  const shareLiveWithCustomer = ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED'].includes(jobStatus);
  const mapEnabled = !!request && jobStatus !== 'COMPLETED';

  const { coords: deviceCoords, permissionDenied } = useDeviceLocation(mapEnabled, {
    live: shareLiveWithCustomer,
  });

  useMechanicLocationTracking({
    helpRequestId,
    enabled: shareLiveWithCustomer && !permissionDenied,
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

  const displayDistanceKm = useMemo(() => {
    if (!request) {
      return null;
    }
    const fromTracking = resolveTrackingDistanceKm(request.tracking);
    if (fromTracking != null) {
      return fromTracking;
    }
    if (deviceCoords) {
      return haversineDistanceKm(
        deviceCoords.latitude,
        deviceCoords.longitude,
        request.latitude,
        request.longitude,
      );
    }
    return resolveMechanicToCustomerDistanceKm(request, origin);
  }, [request, deviceCoords, origin]);

  const setStatus = async (
    status: string,
    extra?: { service_performed?: string; final_service_amount_php?: number },
  ) => {
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
  const photoCount = request.media?.length ?? 0;

  return (
    <View style={styles.root}>
      <View style={styles.mapArea}>
        <HelpRequestMap
          request={{ latitude: request.latitude, longitude: request.longitude, title: 'Customer help location' }}
          mechanic={mechanicMapPoint}
          requestPinLabel="Customer"
          mechanicPinLabel="You"
          fill
          showMyLocation={false}
          showRouteLine={!!mechanicMapPoint}
          liveDistanceKm={displayDistanceKm}
          showLiveDistanceBadge={shareLiveWithCustomer}
        />
      </View>

      <GrabStyleBottomSheet>
        <View style={styles.titleRow}>
          <Text style={styles.headline} numberOfLines={1}>
            {headerTitle(jobStatus, justAccepted)}
          </Text>
          <Text style={styles.statusPill}>{jobStatusLabelOf(request)}</Text>
        </View>

        <View style={styles.customerRow}>
          <View style={styles.customerBlock}>
            <Text style={styles.customerName} numberOfLines={1}>
              {request.owner?.name ?? 'Customer'}
            </Text>
            <Text style={styles.vehicle} numberOfLines={1}>
              {vehicleTitle(request)}
            </Text>
          </View>
          {request.owner?.phone ? (
            <Pressable
              style={styles.callChip}
              onPress={() => Linking.openURL(`tel:${request.owner!.phone}`)}
            >
              <Text style={styles.callChipText}>Call</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.problem} numberOfLines={1}>
          {request.problem_category?.name}
          {request.remarks ? ` · ${request.remarks}` : ''}
        </Text>

        <ActiveJobLocationSummary
          tracking={tracking}
          mechanicPermissionDenied={permissionDenied && shareLiveWithCustomer}
          connectionLost={connectionLost}
          viewerRole="mechanic"
          compact
          fallbackDistanceKm={displayDistanceKm}
        />

        <JobWorkDurationText
          job={request.job}
          jobStatus={jobStatus}
          style={styles.workTime}
          liveStyle={styles.workTimeLive}
        />

        {photoCount > 0 ? (
          <Pressable style={styles.photosLink} onPress={() => setPhotosOpen(true)}>
            <Text style={styles.photosLinkText}>View customer photos ({photoCount})</Text>
          </Pressable>
        ) : null}

        <View style={styles.actions}>
          {jobStatus === 'ACCEPTED' && (
            <Pressable style={styles.primaryBtn} disabled={acting} onPress={startJourney}>
              <Text style={styles.primaryBtnText}>Start journey</Text>
            </Pressable>
          )}
          {jobStatus === 'ON_THE_WAY' && (
            <View style={styles.actionRow}>
              <Pressable style={[styles.navBtn, styles.actionHalf]} onPress={startNavigation}>
                <Text style={styles.navBtnText}>Navigate</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, styles.actionHalf]}
                disabled={acting}
                onPress={() => setStatus('ARRIVED')}
              >
                <Text style={styles.primaryBtnText}>Arrived</Text>
              </Pressable>
            </View>
          )}
          {jobStatus === 'ARRIVED' && (
            <Pressable style={styles.primaryBtn} disabled={acting} onPress={() => setStatus('IN_PROGRESS')}>
              <Text style={styles.primaryBtnText}>Start job</Text>
            </Pressable>
          )}
          {jobStatus === 'IN_PROGRESS' && (
            <Pressable style={styles.primaryBtn} disabled={acting} onPress={() => setCompleteOpen(true)}>
              <Text style={styles.primaryBtnText}>Complete job</Text>
            </Pressable>
          )}
        </View>
      </GrabStyleBottomSheet>

      <Modal visible={photosOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.photosCard}>
            <Text style={styles.modalTitle}>Customer photos</Text>
            <HelpRequestPhotoGallery media={request.media} compact />
            <Pressable style={styles.primaryBtn} onPress={() => setPhotosOpen(false)}>
              <Text style={styles.primaryBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
            <TextInput
              style={styles.input}
              placeholder="Final service amount (PHP, agreed with customer)"
              keyboardType="number-pad"
              value={finalAmount}
              onChangeText={setFinalAmount}
            />
            <Pressable
              style={styles.primaryBtn}
              disabled={acting || !servicePerformed.trim() || !finalAmount.trim()}
              onPress={() =>
                setStatus('COMPLETED', {
                  service_performed: servicePerformed.trim(),
                  final_service_amount_php: Number(finalAmount),
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#e2e8f0' },
  mapArea: { flex: 1, backgroundColor: '#cbd5e1', position: 'relative' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' },
  muted: { color: '#64748b', marginBottom: 12, textAlign: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headline: { flex: 1, fontSize: 18, fontWeight: '800', color: '#166534' },
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
  customerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 },
  customerBlock: { flex: 1, minWidth: 0 },
  customerName: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  vehicle: { fontSize: 14, fontWeight: '600', color: '#475569', marginTop: 2 },
  problem: { fontSize: 13, color: '#64748b', marginTop: 6 },
  workTime: { marginTop: 4 },
  workTimeLive: { color: '#b45309' },
  callChip: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  callChipText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  photosLink: { marginTop: 6 },
  photosLinkText: { color: '#0284c7', fontWeight: '600', fontSize: 13 },
  actions: { marginTop: 12, gap: 8 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionHalf: { flex: 1 },
  primaryBtn: { backgroundColor: '#16a34a', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  navBtn: { backgroundColor: '#0284c7', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center' },
  navBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  link: { color: '#0284c7', fontWeight: '600', marginTop: 12, textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  photosCard: {
    backgroundColor: '#fff',
    margin: 24,
    padding: 20,
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, minHeight: 80, marginBottom: 12 },
  cancel: { textAlign: 'center', marginTop: 12, color: '#64748b' },
});
