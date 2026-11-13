import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { CenteredLoading } from '../../components/CenteredLoading';
import { GrabStyleBottomSheet } from '../../components/GrabStyleBottomSheet';
import { JobLifecycleStepper } from '../../components/JobLifecycleStepper';
import { JobStatusConfirmSheet } from '../../components/JobStatusConfirmSheet';
import { JobWorkDurationText } from '../../components/JobWorkDurationText';
import { PendingJobStatusBanner } from '../../components/PendingJobStatusBanner';
import { HelpRequestMap } from '../../components/HelpRequestMap';
import { HelpRequestPhotoGallery } from '../../components/HelpRequestPhotoGallery';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';
import { useLiveWorkElapsedSeconds } from '../../hooks/useLiveWorkElapsedSeconds';
import { useMechanicDistanceOrigin } from '../../hooks/useMechanicDistanceOrigin';
import { useMechanicLocationTracking } from '../../hooks/useMechanicLocationTracking';
import { haversineDistanceKm, resolveMechanicToCustomerDistanceKm, resolveTrackingDistanceKm } from '../../utils/distanceKm';
import type { MechanicStackParamList } from '../../navigation/types';
import {
  digitsFromPhpInput,
  formatPhpAmount,
  formatPhpInputDisplay,
  jobStatusLabelOf,
  jobStatusOf,
  parsePhpDigits,
  vehicleTitle,
} from '../../utils/helpRequestUi';
import { formatJobWorkDuration } from '../../utils/jobWorkDuration';

const STATUS_UNDO_SECONDS = 4;

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

const STATUS_CONFIRM: Record<string, { title: string; message: string; confirm: string }> = {
  ON_THE_WAY: {
    title: 'Start journey?',
    message: 'The owner will see that you are on the way. You can cancel here if you tapped by mistake.',
    confirm: 'Start journey',
  },
  ARRIVED: {
    title: 'Mark arrived?',
    message: 'Confirm you are at the customer location. The owner gets an arrival notice.',
    confirm: 'Mark arrived',
  },
  IN_PROGRESS: {
    title: 'Start repair?',
    message: 'Confirm you have begun work on the vehicle.',
    confirm: 'Start job',
  },
};

export function MechanicActiveJobScreen({ route, navigation }: Props) {
  const { helpRequestId, justAccepted = false, initialRequest } = route.params;
  const [request, setRequest] = useState<HelpRequest | null>(initialRequest ?? null);
  const [loading, setLoading] = useState(!initialRequest);
  const [connectionLost, setConnectionLost] = useState(false);
  const [acting, setActing] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeStep, setCompleteStep] = useState<'form' | 'summary'>('form');
  const [photosOpen, setPhotosOpen] = useState(false);
  const [servicePerformed, setServicePerformed] = useState('');
  const [finalAmountDigits, setFinalAmountDigits] = useState('');
  const [statusConfirmTarget, setStatusConfirmTarget] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [pendingUndoSeconds, setPendingUndoSeconds] = useState(0);
  const pendingStatusRef = useRef<string | null>(null);

  const { config } = useAppConfig();
  const emergencyOn = config?.features?.emergency_assistance ?? false;

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
        setCompleteStep('form');
        setFinalAmountDigits('');
        setServicePerformed('');
        navigation.replace('MechanicRequestDetail', { helpRequestId });
      }
    } catch (e) {
      Alert.alert('Update failed', getApiErrorMessage(e));
      load();
    } finally {
      setActing(false);
    }
  };

  const queueStatusUpdate = useCallback((status: string) => {
    pendingStatusRef.current = status;
    setPendingStatus(status);
    setPendingUndoSeconds(STATUS_UNDO_SECONDS);
  }, []);

  const clearPendingStatus = useCallback(() => {
    pendingStatusRef.current = null;
    setPendingStatus(null);
    setPendingUndoSeconds(0);
  }, []);

  useEffect(() => {
    if (pendingStatus == null || pendingUndoSeconds <= 0) {
      return;
    }
    const timer = setTimeout(() => {
      setPendingUndoSeconds((s) => s - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [pendingStatus, pendingUndoSeconds]);

  useEffect(() => {
    if (pendingStatus == null || pendingUndoSeconds > 0 || acting) {
      return;
    }
    const status = pendingStatusRef.current;
    clearPendingStatus();
    if (status) {
      void setStatus(status);
    }
  }, [pendingStatus, pendingUndoSeconds, acting, clearPendingStatus]);

  const requestStatusChange = (status: string) => {
    if (emergencyOn) {
      setStatusConfirmTarget(status);
      return;
    }
    void setStatus(status);
  };

  const onStatusConfirmSheetConfirm = () => {
    const target = statusConfirmTarget;
    setStatusConfirmTarget(null);
    if (!target) return;
    queueStatusUpdate(target);
  };

  const statusConfirmMeta = statusConfirmTarget ? STATUS_CONFIRM[statusConfirmTarget] : null;

  const workElapsedSeconds = useLiveWorkElapsedSeconds(request?.job, jobStatus);
  const workDurationSummary =
    workElapsedSeconds != null ? formatJobWorkDuration(workElapsedSeconds) : null;

  const statusChangeLocked = acting || pendingStatus != null;

  const startJourney = () => requestStatusChange('ON_THE_WAY');

  const openCompleteForm = () => {
    setCompleteStep('form');
    setCompleteOpen(true);
  };

  const closeCompleteModal = () => {
    setCompleteOpen(false);
    setCompleteStep('form');
  };

  const parsedFinalAmount = parsePhpDigits(finalAmountDigits);
  const finalAmountDisplay = formatPhpInputDisplay(finalAmountDigits);

  const startNavigation = () => {
    if (!request) return;
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${request.latitude},${request.longitude}`,
    ).catch(() => {});
  };

  const submitCompletion = () => {
    if (parsedFinalAmount == null || !servicePerformed.trim()) {
      return;
    }
    void setStatus('COMPLETED', {
      service_performed: servicePerformed.trim(),
      final_service_amount_php: parsedFinalAmount,
    });
  };

  if (loading && !request) {
    return <CenteredLoading message="Loading active job…" />;
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

        {emergencyOn && jobStatus !== 'COMPLETED' ? (
          <JobLifecycleStepper currentStatus={jobStatus} />
        ) : null}

        {emergencyOn && pendingStatus && pendingUndoSeconds > 0 ? (
          <PendingJobStatusBanner
            message={`Updating to “${headerTitle(pendingStatus, false)}”`}
            secondsLeft={pendingUndoSeconds}
            onUndo={clearPendingStatus}
          />
        ) : null}

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
            <Pressable style={styles.primaryBtn} disabled={statusChangeLocked} onPress={startJourney}>
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
                disabled={statusChangeLocked}
                onPress={() => requestStatusChange('ARRIVED')}
              >
                <Text style={styles.primaryBtnText}>Arrived</Text>
              </Pressable>
            </View>
          )}
          {jobStatus === 'ARRIVED' && (
            <Pressable
              style={styles.primaryBtn}
              disabled={statusChangeLocked}
              onPress={() => requestStatusChange('IN_PROGRESS')}
            >
              <Text style={styles.primaryBtnText}>Start job</Text>
            </Pressable>
          )}
          {jobStatus === 'IN_PROGRESS' && (
            <Pressable style={styles.primaryBtn} disabled={statusChangeLocked} onPress={openCompleteForm}>
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
            {completeStep === 'form' ? (
              <>
                <Text style={styles.modalTitle}>Complete job</Text>
                <Text style={styles.modalHint}>
                  {emergencyOn
                    ? 'Enter what you did and the amount agreed with the customer. You will review a summary before submitting.'
                    : 'Enter what you did and the final amount agreed with the customer.'}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Service performed (required)"
                  value={servicePerformed}
                  onChangeText={setServicePerformed}
                  multiline
                />
                <Text style={styles.fieldLabel}>Final amount</Text>
                <TextInput
                  style={[styles.input, styles.amountInput]}
                  placeholder="₱0"
                  keyboardType="number-pad"
                  value={finalAmountDisplay}
                  onChangeText={(t) => setFinalAmountDigits(digitsFromPhpInput(t))}
                />
                <Pressable
                  style={styles.primaryBtn}
                  disabled={!servicePerformed.trim() || parsedFinalAmount == null}
                  onPress={() => (emergencyOn ? setCompleteStep('summary') : void submitCompletion())}
                >
                  <Text style={styles.primaryBtnText}>
                    {emergencyOn ? 'Review summary' : 'Submit completion'}
                  </Text>
                </Pressable>
                <Pressable onPress={closeCompleteModal}>
                  <Text style={styles.cancel}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Confirm completion</Text>
                <Text style={styles.modalHint}>This amount is used for commissions and the customer receipt.</Text>
                <View style={styles.summaryBox}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Customer</Text>
                    <Text style={styles.summaryValue}>{request.owner?.name ?? 'Customer'}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Vehicle</Text>
                    <Text style={styles.summaryValue}>{vehicleTitle(request)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Service</Text>
                    <Text style={styles.summaryValue}>{servicePerformed.trim()}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Amount</Text>
                    <Text style={styles.summaryAmount}>
                      {formatPhpAmount(parsedFinalAmount) ?? '—'}
                    </Text>
                  </View>
                  {workDurationSummary ? (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Duration</Text>
                      <Text style={styles.summaryValue}>{workDurationSummary}</Text>
                    </View>
                  ) : null}
                </View>
                <Pressable
                  style={styles.primaryBtn}
                  disabled={acting || parsedFinalAmount == null || !servicePerformed.trim()}
                  onPress={submitCompletion}
                >
                  <Text style={styles.primaryBtnText}>Submit completion</Text>
                </Pressable>
                <Pressable onPress={() => setCompleteStep('form')}>
                  <Text style={styles.link}>← Edit details</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {statusConfirmMeta ? (
        <JobStatusConfirmSheet
          visible={statusConfirmTarget != null}
          title={statusConfirmMeta.title}
          message={statusConfirmMeta.message}
          confirmLabel={statusConfirmMeta.confirm}
          onConfirm={onStatusConfirmSheetConfirm}
          onCancel={() => setStatusConfirmTarget(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
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
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  modalHint: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, minHeight: 80, marginBottom: 12 },
  amountInput: { minHeight: 48, fontSize: 18, fontWeight: '700', color: '#0f172a' },
  summaryBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  summaryRow: { gap: 2 },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' },
  summaryValue: { fontSize: 15, fontWeight: '600', color: '#334155' },
  summaryAmount: { fontSize: 22, fontWeight: '800', color: '#16a34a' },
  cancel: { textAlign: 'center', marginTop: 12, color: '#64748b' },
});
