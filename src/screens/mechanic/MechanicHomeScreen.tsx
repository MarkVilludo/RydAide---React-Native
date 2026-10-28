import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchEntitlements } from '../../api/auth';
import type { HelpRequest } from '../../api/helpRequests';
import { fetchMechanicHelpQueues } from '../../api/mechanicHelp';
import {
  fetchMyMechanicProfile,
  updateMechanicAvailability,
  updateMechanicProfileLocation,
} from '../../api/mechanicProfile';
import {
  MechanicDashboardLocationCard,
  type SavedWorkLocation,
} from '../../components/MechanicDashboardLocationCard';
import type { Entitlements } from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import { useMechanicLiveLocation } from '../../context/MechanicLocationContext';
import { mechanicQueueFetchCoords, useServicePinMaxOffsetKm } from '../../hooks/useMechanicDistanceOrigin';
import { useAppConfig } from '../../hooks/useAppConfig';
import type { MechanicStackParamList } from '../../navigation/types';
import { jobStatusLabelOf, vehicleTitle } from '../../utils/helpRequestUi';

type Props = NativeStackScreenProps<MechanicStackParamList, 'MechanicHome'>;

type RequestTab = 'incoming' | 'accepted_active' | 'in_progress' | 'completed';

function pickPrimaryActiveJob(queues: Awaited<ReturnType<typeof fetchMechanicHelpQueues>>): HelpRequest | null {
  const active = [...queues.accepted_active, ...queues.in_progress];
  return active[0] ?? null;
}

function firstName(fullName: string | undefined): string {
  if (!fullName?.trim()) return 'there';
  return fullName.trim().split(/\s+/)[0] ?? 'there';
}

function PulseOnlineDot() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.3, duration: 800, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);
  return (
    <View style={styles.pulseWrap}>
      <Animated.View style={[styles.pulseRing, { transform: [{ scale }] }]} />
      <View style={[styles.dot, styles.dotOn]} />
    </View>
  );
}

export function MechanicHomeScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const { config } = useAppConfig();
  const emergencyOn = config?.features.emergency_assistance ?? false;
  const subscriptionsOn = config?.features.mechanic_subscriptions ?? false;
  const proPrice = config?.mechanic_monetization?.pro_monthly_price_php ?? 99;

  const pageOpacity = useRef(new Animated.Value(0)).current;

  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [listingStatus, setListingStatus] = useState<string | null>(null);
  const [availability, setAvailability] = useState<'available' | 'offline' | 'busy'>('offline');
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof fetchMechanicHelpQueues>>['summary'] | null>(
    null,
  );
  const [activeJob, setActiveJob] = useState<HelpRequest | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [workLocation, setWorkLocation] = useState<SavedWorkLocation | null>(null);
  const [deviceSaveBusy, setDeviceSaveBusy] = useState(false);
  const resumePrompted = useRef(false);
  const maxOffsetKm = useServicePinMaxOffsetKm();
  const { coords, permissionDenied, servicePin, servicePinManual, applySavedMechanicLocation } =
    useMechanicLiveLocation();
  const { height: windowHeight } = useWindowDimensions();
  const dashboardMapHeight = Math.round(Math.min(420, Math.max(260, windowHeight * 0.36)));

  useFocusEffect(
    useCallback(() => {
      pageOpacity.setValue(0);
      Animated.timing(pageOpacity, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, [pageOpacity]),
  );

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      await Promise.all([
        fetchEntitlements().then(setEntitlements).catch(() => setEntitlements(null)),
        fetchMyMechanicProfile()
          .then((p) => {
            setListingStatus(p?.verification_status ?? (p ? 'pending' : 'none'));
            setAvailability(p?.availability_status ?? 'offline');
            const lat = p?.latitude != null ? Number(p.latitude) : NaN;
            const lng = p?.longitude != null ? Number(p.longitude) : NaN;
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              setWorkLocation({ latitude: lat, longitude: lng, address: p?.address ?? null });
            } else {
              setWorkLocation(null);
            }
          })
          .catch(() => {
            setListingStatus(null);
            setAvailability('offline');
            setWorkLocation(null);
          }),
      ]);

      if (!emergencyOn) {
        setSummary(null);
        setActiveJob(null);
        return;
      }
      const q = await fetchMechanicHelpQueues(
        mechanicQueueFetchCoords({ servicePin, servicePinManual, coords, maxOffsetKm }),
      );
      setSummary(q.summary);
      setActiveJob(pickPrimaryActiveJob(q));
    } catch {
      setSummary(null);
      setActiveJob(null);
    } finally {
      if (showRefresh) setRefreshing(false);
    }
  }, [
    emergencyOn,
    coords?.latitude,
    coords?.longitude,
    servicePin?.latitude,
    servicePin?.longitude,
    servicePinManual,
  ]);

  useFocusEffect(useCallback(() => void load(), [load]));

  useEffect(() => {
    if (!emergencyOn || !activeJob || resumePrompted.current) return;
    resumePrompted.current = true;
    Alert.alert('Active job', 'You have a help request in progress. Resume now?', [
      { text: 'Later', style: 'cancel' },
      {
        text: 'Resume',
        onPress: () =>
          navigation.navigate('ActiveJob', { helpRequestId: activeJob.id, initialRequest: activeJob }),
      },
    ]);
  }, [activeJob, emergencyOn, navigation]);

  const verified = listingStatus === 'verified';
  const needsProfile = listingStatus === 'none' || listingStatus === null;
  const acceptedRemaining =
    entitlements?.accepted_requests?.remaining ?? entitlements?.accepted_requests_remaining;
  const unlimitedAccepts =
    entitlements?.accepted_requests?.unlimited ?? entitlements?.unlimited_accepted_requests ?? false;
  const isPro = entitlements?.plan_code === 'MECHANIC_PRO';
  const atFreeLimit =
    subscriptionsOn &&
    !unlimitedAccepts &&
    acceptedRemaining != null &&
    acceptedRemaining <= 0;

  const isOnline = availability === 'available';
  const isBusy = availability === 'busy';
  const incomingCount = summary?.incoming ?? 0;

  const toggleOnline = async () => {
    if (!verified) {
      Alert.alert(
        'Verification required',
        needsProfile
          ? 'Complete your mechanic profile before going online.'
          : 'Your profile is still under review.',
        [
          { text: 'Cancel', style: 'cancel' },
          needsProfile
            ? { text: 'Profile', onPress: () => navigation.navigate('MechanicOnboarding') }
            : { text: 'OK' },
        ],
      );
      return;
    }
    if (isBusy) {
      Alert.alert('Busy', 'Finish your active job first.');
      return;
    }
    const next = isOnline ? 'offline' : 'available';
    setAvailabilityBusy(true);
    try {
      const updated = await updateMechanicAvailability(next);
      setAvailability(updated.availability_status ?? next);
    } catch {
      Alert.alert('Could not update', 'Try again.');
    } finally {
      setAvailabilityBusy(false);
    }
  };

  const openRequests = (tab: RequestTab) => navigation.navigate('MechanicRequests', { tab });

  const saveDeviceLocation = async () => {
    if (!coords) {
      Alert.alert('Location unavailable', 'Enable GPS and try again.');
      return;
    }
    setDeviceSaveBusy(true);
    try {
      const updated = await updateMechanicProfileLocation(coords.latitude, coords.longitude, undefined, {
        source: 'device',
      });
      applySavedMechanicLocation(
        updated.latitude ?? coords.latitude,
        updated.longitude ?? coords.longitude,
        false,
      );
      setWorkLocation({
        latitude: updated.latitude ?? coords.latitude,
        longitude: updated.longitude ?? coords.longitude,
        address: updated.address ?? workLocation?.address ?? null,
      });
    } catch {
      Alert.alert('Could not save', 'Use Map to set your pin.');
    } finally {
      setDeviceSaveBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <Animated.View style={[styles.page, { opacity: pageOpacity }]}>
          <View style={styles.topRow}>
            <View>
              <Text style={styles.hello}>Hi, {firstName(user?.name)}</Text>
              <Text style={styles.tagline}>Mechanic dashboard</Text>
            </View>
            <Pressable onPress={signOut} style={styles.signOut}>
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </View>

          <View style={styles.sheet}>
            {emergencyOn && !verified ? (
              <Pressable
                style={styles.verifyStrip}
                onPress={() => needsProfile && navigation.navigate('MechanicOnboarding')}
              >
                <Text style={styles.verifyText}>
                  {needsProfile ? 'Complete profile to go online →' : 'Verification pending…'}
                </Text>
              </Pressable>
            ) : null}

            {!emergencyOn ? (
              <Text style={styles.offlineMsg}>Help dispatch is not live in your area yet.</Text>
            ) : (
              <>
                <Pressable
                  style={[styles.onlineRow, isOnline && styles.onlineRowLive]}
                  onPress={() => void toggleOnline()}
                  disabled={availabilityBusy || isBusy}
                >
                  {isOnline ? <PulseOnlineDot /> : <View style={[styles.dot, styles.dotOff]} />}
                  <Text style={styles.onlineLabel}>
                    {isBusy ? 'Busy on job' : isOnline ? 'Online for requests' : 'Offline — tap to go online'}
                  </Text>
                  {availabilityBusy ? (
                    <ActivityIndicator size="small" />
                  ) : (
                    <View style={[styles.toggle, isOnline && styles.toggleOn]}>
                      <View style={[styles.knob, isOnline && styles.knobOn]} />
                    </View>
                  )}
                </Pressable>

                {activeJob ? (
                  <Pressable
                    style={styles.activeRow}
                    onPress={() =>
                      navigation.navigate('ActiveJob', {
                        helpRequestId: activeJob.id,
                        initialRequest: activeJob,
                      })
                    }
                  >
                    <Text style={styles.activeLabel} numberOfLines={1}>
                      Active · {vehicleTitle(activeJob)} · {jobStatusLabelOf(activeJob)}
                    </Text>
                    <Text style={styles.activeGo}>Open →</Text>
                  </Pressable>
                ) : null}

                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.incomingBtn, atFreeLimit && styles.incomingBtnOff]}
                    disabled={atFreeLimit}
                    onPress={() => openRequests('incoming')}
                  >
                    <Text style={styles.incomingCount}>{incomingCount}</Text>
                    <Text style={styles.incomingLabel}>Incoming</Text>
                  </Pressable>
                  <Pressable
                    style={styles.allBtn}
                    onPress={() => navigation.navigate('MechanicRequests', { tab: 'accepted_active' })}
                  >
                    <Text style={styles.allBtnText}>All requests</Text>
                  </Pressable>
                </View>

                {summary ? (
                  <View style={styles.statsRow}>
                    {(
                      [
                        ['In', summary.incoming, 'incoming'],
                        ['Active', summary.accepted_active, 'accepted_active'],
                        ['Work', summary.in_progress, 'in_progress'],
                        ['Done', summary.completed, 'completed'],
                      ] as const
                    ).map(([label, value, tab]) => (
                      <Pressable key={tab} style={styles.statCell} onPress={() => openRequests(tab)}>
                        <Text style={styles.statNum}>{value}</Text>
                        <Text style={styles.statLbl}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {atFreeLimit && subscriptionsOn && !isPro ? (
                  <Pressable style={styles.proLink} onPress={() => navigation.navigate('MechanicSubscription')}>
                    <Text style={styles.proLinkText}>Upgrade · ₱{proPrice}/mo</Text>
                  </Pressable>
                ) : null}
              </>
            )}

            {!needsProfile ? (
              <View style={styles.mapSection}>
                <MechanicDashboardLocationCard
                  embedded
                  mapHeight={dashboardMapHeight}
                  saved={workLocation}
                  deviceLatitude={coords?.latitude ?? null}
                  deviceLongitude={coords?.longitude ?? null}
                  permissionDenied={permissionDenied}
                  onEditMap={() => navigation.navigate('MechanicWorkLocation')}
                  onUseDeviceLocation={() => void saveDeviceLocation()}
                  deviceSaveBusy={deviceSaveBusy}
                />
              </View>
            ) : null}
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#e2e8f0' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 16, paddingBottom: 24 },
  page: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  hello: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  tagline: { fontSize: 13, color: '#64748b', marginTop: 2 },
  signOut: { paddingVertical: 6, paddingHorizontal: 10 },
  signOutText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  sheet: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  verifyStrip: {
    backgroundColor: '#fffbeb',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  verifyText: { color: '#b45309', fontWeight: '700', fontSize: 13 },
  offlineMsg: { color: '#64748b', fontSize: 14, lineHeight: 20, marginBottom: 8 },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    marginBottom: 10,
  },
  onlineRowLive: { backgroundColor: '#f0fdf4' },
  pulseWrap: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  pulseRing: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(34, 197, 94, 0.35)',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { backgroundColor: '#22c55e' },
  dotOff: { backgroundColor: '#94a3b8' },
  onlineLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0f172a' },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#cbd5e1',
    padding: 2,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: '#22c55e' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  knobOn: { alignSelf: 'flex-end' },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    gap: 8,
  },
  activeLabel: { flex: 1, color: '#fff', fontWeight: '600', fontSize: 13 },
  activeGo: { color: '#dcfce7', fontWeight: '800', fontSize: 13 },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  incomingBtn: {
    flex: 1,
    backgroundColor: '#0284c7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  incomingBtnOff: { backgroundColor: '#94a3b8' },
  incomingCount: { color: '#fff', fontSize: 28, fontWeight: '800', lineHeight: 32 },
  incomingLabel: { color: '#e0f2fe', fontSize: 12, fontWeight: '700', marginTop: 2 },
  allBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  allBtnText: { color: '#334155', fontWeight: '700', fontSize: 14 },
  statsRow: {
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 4,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#fafafa',
    borderRightWidth: 1,
    borderRightColor: '#f1f5f9',
  },
  statNum: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  statLbl: { fontSize: 10, color: '#64748b', fontWeight: '600', marginTop: 2 },
  proLink: { alignItems: 'center', paddingVertical: 8 },
  proLinkText: { color: '#0f172a', fontWeight: '700', fontSize: 13 },
  mapSection: {
    flex: 1,
    minHeight: 300,
    marginTop: 8,
  },
});
