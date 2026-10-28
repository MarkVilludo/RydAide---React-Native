import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchEntitlements } from '../../api/auth';
import type { HelpRequest } from '../../api/helpRequests';
import { fetchMyMechanicProfile, updateMechanicAvailability } from '../../api/mechanicProfile';
import { fetchMechanicHelpQueues } from '../../api/mechanicHelp';
import { useAppConfig } from '../../hooks/useAppConfig';
import type { Entitlements } from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import type { MechanicStackParamList } from '../../navigation/types';
import { jobStatusLabelOf, vehicleTitle } from '../../utils/helpRequestUi';

type Props = NativeStackScreenProps<MechanicStackParamList, 'MechanicHome'>;

function pickPrimaryActiveJob(queues: Awaited<ReturnType<typeof fetchMechanicHelpQueues>>): HelpRequest | null {
  const active = [...queues.accepted_active, ...queues.in_progress];
  return active[0] ?? null;
}

function listingStatusMeta(status: string | null): { label: string; tone: string; hint: string } {
  switch (status) {
    case 'verified':
      return { label: 'Verified', tone: '#16a34a', hint: 'Visible in owner search when active.' };
    case 'pending':
      return { label: 'Pending review', tone: '#d97706', hint: 'We are reviewing your listing.' };
    case 'rejected':
      return { label: 'Needs updates', tone: '#dc2626', hint: 'Update your listing and resubmit.' };
    default:
      return { label: 'Not set up', tone: '#64748b', hint: 'Complete your profile to appear in the directory.' };
  }
}

function StatTile({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function MechanicHomeScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const { config } = useAppConfig();
  const emergencyOn = config?.features.emergency_assistance ?? false;
  const subscriptionsOn = config?.features.mechanic_subscriptions ?? false;
  const freeLimit = config?.mechanic_monetization?.free_emergency_accept_limit ?? 5;
  const proPrice = config?.mechanic_monetization?.pro_monthly_price_php ?? 99;

  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [listingStatus, setListingStatus] = useState<string | null>(null);
  const [availability, setAvailability] = useState<'available' | 'offline' | 'busy'>('offline');
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof fetchMechanicHelpQueues>>['summary'] | null>(null);
  const [activeJob, setActiveJob] = useState<HelpRequest | null>(null);
  const resumePrompted = useRef(false);

  const load = useCallback(() => {
    fetchEntitlements().then(setEntitlements).catch(() => setEntitlements(null));
    fetchMyMechanicProfile()
      .then((p) => {
        setListingStatus(p?.verification_status ?? (p ? 'pending' : 'none'));
        setAvailability(p?.availability_status ?? 'offline');
      })
      .catch(() => {
        setListingStatus(null);
        setAvailability('offline');
      });
    if (!emergencyOn) {
      setSummary(null);
      setActiveJob(null);
      return;
    }
    fetchMechanicHelpQueues()
      .then((q) => {
        setSummary(q.summary);
        setActiveJob(pickPrimaryActiveJob(q));
      })
      .catch(() => {
        setSummary(null);
        setActiveJob(null);
      });
  }, [emergencyOn]);

  useFocusEffect(useCallback(() => load(), [load]));

  useEffect(() => {
    if (!emergencyOn || !activeJob || resumePrompted.current) return;
    resumePrompted.current = true;
    Alert.alert(
      'Active job',
      'You have a help request in progress. Resume now?',
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Resume',
          onPress: () =>
            navigation.navigate('ActiveJob', {
              helpRequestId: activeJob.id,
              initialRequest: activeJob,
            }),
        },
      ],
    );
  }, [activeJob, emergencyOn, navigation]);

  const listing = listingStatusMeta(listingStatus === 'none' ? null : listingStatus);
  const tracking = activeJob?.tracking;

  const acceptedUsed =
    entitlements?.accepted_requests?.used ?? entitlements?.accepted_requests_used ?? 0;
  const acceptedLimit =
    entitlements?.accepted_requests?.limit ?? entitlements?.max_accepted_requests ?? freeLimit;
  const acceptedRemaining =
    entitlements?.accepted_requests?.remaining ?? entitlements?.accepted_requests_remaining;
  const unlimitedAccepts =
    entitlements?.accepted_requests?.unlimited ?? entitlements?.unlimited_accepted_requests ?? false;
  const isPro = entitlements?.plan_code === 'MECHANIC_PRO';
  const atFreeLimit =
    subscriptionsOn && !unlimitedAccepts && acceptedRemaining !== null && acceptedRemaining !== undefined && acceptedRemaining <= 0;

  const progress =
    unlimitedAccepts || acceptedLimit == null || acceptedLimit <= 0
      ? 1
      : Math.min(1, acceptedUsed / acceptedLimit);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topTitle}>Dashboard</Text>
          <Text style={styles.topSub}>{user?.name}</Text>
        </View>
        <Pressable onPress={signOut} style={styles.signOutBtn} accessibilityRole="button">
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.directoryCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Directory listing</Text>
            <View style={styles.freePill}>
              <Text style={styles.freePillText}>FREE</Text>
            </View>
          </View>
          <Text style={[styles.statusBadge, { color: listing.tone }]}>{listing.label}</Text>
          <Text style={styles.muted}>{listing.hint}</Text>
          <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('MechanicOnboarding')}>
            <Text style={styles.secondaryBtnText}>
              {listingStatus === 'none' || listingStatus === null ? 'Set up listing' : 'Edit listing'}
            </Text>
          </Pressable>
        </View>

        {emergencyOn ? (
          <>
            <View style={styles.emergencyCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>Emergency assistance</Text>
                <Pressable
                  style={[
                    styles.availabilityPill,
                    availability === 'available' ? styles.availabilityOn : styles.availabilityOff,
                  ]}
                  disabled={availabilityBusy || availability === 'busy'}
                  onPress={async () => {
                    if (listingStatus !== 'verified') {
                      Alert.alert(
                        'Verification required',
                        'Complete verification before going online for help requests.',
                      );
                      return;
                    }
                    const next = availability === 'available' ? 'offline' : 'available';
                    setAvailabilityBusy(true);
                    try {
                      const updated = await updateMechanicAvailability(next);
                      setAvailability(updated.availability_status ?? next);
                    } catch {
                      Alert.alert('Could not update', 'Try again in a moment.');
                    } finally {
                      setAvailabilityBusy(false);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.availabilityText,
                      availability === 'available' ? styles.availabilityTextOn : null,
                    ]}
                  >
                    {availability === 'available'
                      ? 'Online'
                      : availability === 'busy'
                        ? 'Busy on job'
                        : 'Offline'}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.mutedSmall}>
                {availability === 'available'
                  ? 'You can receive incoming help offers.'
                  : availability === 'busy'
                    ? 'Finish your active job to go offline or receive new offers.'
                    : 'Go online to receive roadside help requests.'}
              </Text>
              {isPro ? (
                <Text style={styles.proActive}>Mechanic Pro active — unlimited job accepts.</Text>
              ) : subscriptionsOn ? (
                <>
                  <Text style={styles.muted}>
                    {freeLimit} free job accepts at launch, then ₱{proPrice}/month for unlimited accepts.
                  </Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                  </View>
                  <Text style={styles.usageLine}>
                    {unlimitedAccepts
                      ? 'Unlimited accepts'
                      : `${acceptedUsed} of ${acceptedLimit ?? freeLimit} free accepts used`}
                    {!unlimitedAccepts && acceptedRemaining != null ? ` · ${acceptedRemaining} left` : ''}
                  </Text>
                  {atFreeLimit ? (
                    <Pressable
                      style={styles.upgradeBtn}
                      onPress={() => navigation.navigate('MechanicSubscription')}
                    >
                      <Text style={styles.upgradeBtnText}>Subscribe — ₱{proPrice}/mo</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : (
                <Text style={styles.muted}>Accept incoming help requests from nearby owners.</Text>
              )}
            </View>

            {summary ? (
              <View style={styles.statsRow}>
                <StatTile label="Incoming" value={summary.incoming} accent="#0284c7" />
                <StatTile label="Active" value={summary.accepted_active} />
                <StatTile label="In progress" value={summary.in_progress} />
                <StatTile label="Done" value={summary.completed} />
              </View>
            ) : null}

            {activeJob ? (
              <View style={styles.activeCard}>
                <Text style={styles.activeLabel}>Active job</Text>
                <Text style={styles.activeTitle}>{vehicleTitle(activeJob)}</Text>
                <Text style={styles.muted}>{activeJob.problem_category?.name}</Text>
                <Text style={styles.activeStatus}>{jobStatusLabelOf(activeJob)}</Text>
                {tracking?.distance_km != null ? (
                  <Text style={styles.muted}>{tracking.distance_km} km away</Text>
                ) : null}
                {tracking?.eta ? <Text style={styles.muted}>ETA: {tracking.eta.label}</Text> : null}
                <Pressable
                  style={styles.primaryBtn}
                  onPress={() =>
                    navigation.navigate('ActiveJob', {
                      helpRequestId: activeJob.id,
                      initialRequest: activeJob,
                    })
                  }
                >
                  <Text style={styles.primaryBtnText}>Continue job</Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable
              style={[styles.incomingBtn, atFreeLimit && styles.incomingBtnDisabled]}
              disabled={atFreeLimit}
              onPress={() => navigation.navigate('MechanicRequests', { tab: 'incoming' })}
            >
              <Text style={styles.incomingBtnText}>
                Incoming requests{summary ? ` (${summary.incoming})` : ''}
              </Text>
            </Pressable>
            {atFreeLimit ? (
              <Text style={styles.limitHint}>Subscribe to accept new emergency jobs. Directory stays free.</Text>
            ) : null}

            <Pressable style={styles.linkRow} onPress={() => navigation.navigate('MechanicRequests', {})}>
              <Text style={styles.linkText}>View all requests</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.offCard}>
            <Text style={styles.muted}>
              Customer emergency dispatch is not live in your area yet. Your directory listing remains free.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f1f5f9' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  topTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  topSub: { fontSize: 14, color: '#64748b', marginTop: 2 },
  signOutBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  signOutText: { color: '#64748b', fontWeight: '500', fontSize: 14 },
  scroll: { padding: 20, paddingTop: 4, paddingBottom: 32 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  directoryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  freePill: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  freePillText: { fontSize: 11, fontWeight: '800', color: '#166534', letterSpacing: 0.5 },
  statusBadge: { fontSize: 15, fontWeight: '700', marginTop: 10 },
  muted: { color: '#64748b', marginTop: 6, lineHeight: 20, fontSize: 14 },
  secondaryBtn: {
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  secondaryBtnText: { color: '#0284c7', fontWeight: '700', fontSize: 14 },
  emergencyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  proActive: { marginTop: 8, color: '#16a34a', fontWeight: '600', fontSize: 14 },
  availabilityPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  availabilityOn: { backgroundColor: '#dcfce7', borderColor: '#16a34a' },
  availabilityOff: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  availabilityText: { fontWeight: '800', fontSize: 12, color: '#64748b' },
  availabilityTextOn: { color: '#166534' },
  mutedSmall: { color: '#64748b', marginTop: 8, fontSize: 13, lineHeight: 18 },
  progressTrack: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#0284c7', borderRadius: 4 },
  usageLine: { marginTop: 8, fontSize: 14, fontWeight: '600', color: '#334155' },
  upgradeBtn: {
    marginTop: 14,
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  upgradeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statTile: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statValue: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  statLabel: { fontSize: 10, color: '#64748b', marginTop: 4, textAlign: 'center' },
  activeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  activeLabel: { fontSize: 11, fontWeight: '800', color: '#16a34a', letterSpacing: 0.6 },
  activeTitle: { fontSize: 18, fontWeight: '700', marginTop: 6, color: '#0f172a' },
  activeStatus: { fontWeight: '700', marginTop: 8, color: '#0284c7' },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  incomingBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  incomingBtnDisabled: { backgroundColor: '#94a3b8' },
  incomingBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  limitHint: { textAlign: 'center', color: '#b45309', fontSize: 13, marginBottom: 8 },
  linkRow: { alignItems: 'center', paddingVertical: 8 },
  linkText: { color: '#0284c7', fontWeight: '600', fontSize: 15 },
  offCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
});
