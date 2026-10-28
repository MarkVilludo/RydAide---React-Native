import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchEntitlements } from '../../api/auth';
import type { HelpRequest } from '../../api/helpRequests';
import { fetchMyMechanicProfile } from '../../api/mechanicProfile';
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

export function MechanicHomeScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const { config } = useAppConfig();
  const emergencyOn = config?.features.emergency_assistance ?? false;
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [listingStatus, setListingStatus] = useState<string | null>(null);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof fetchMechanicHelpQueues>>['summary'] | null>(null);
  const [activeJob, setActiveJob] = useState<HelpRequest | null>(null);
  const resumePrompted = useRef(false);

  const load = useCallback(() => {
    fetchEntitlements().then(setEntitlements).catch(() => setEntitlements(null));
    fetchMyMechanicProfile()
      .then((p) => setListingStatus(p?.verification_status ?? (p ? 'pending' : 'none')))
      .catch(() => setListingStatus(null));
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
      'Active HELP request',
      'You have an active job in progress. Resume now?',
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Resume job',
          onPress: () =>
            navigation.navigate('ActiveJob', {
              helpRequestId: activeJob.id,
              initialRequest: activeJob,
            }),
        },
      ],
    );
  }, [activeJob, emergencyOn, navigation]);

  const tracking = activeJob?.tracking;

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Mechanic — {user?.name}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Directory listing (free)</Text>
        {listingStatus === 'none' || listingStatus === null ? (
          <>
            <Text style={styles.muted}>Complete your profile to appear in search after verification.</Text>
            <Pressable style={styles.linkBtn} onPress={() => navigation.navigate('MechanicOnboarding')}>
              <Text style={styles.linkBtnText}>SET UP LISTING</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text>Status: {listingStatus}</Text>
            <Pressable style={styles.linkBtn} onPress={() => navigation.navigate('MechanicOnboarding')}>
              <Text style={styles.linkBtnText}>EDIT LISTING</Text>
            </Pressable>
          </>
        )}
      </View>

      {emergencyOn && activeJob && (
        <View style={styles.activeCard}>
          <Text style={styles.activeLabel}>Active job</Text>
          <Text style={styles.activeTitle}>{vehicleTitle(activeJob)}</Text>
          <Text style={styles.activeProblem}>{activeJob.problem_category?.name}</Text>
          <Text style={styles.activeStatus}>{jobStatusLabelOf(activeJob)}</Text>
          {tracking?.distance_km != null && <Text>{tracking.distance_km} km</Text>}
          {tracking?.eta && <Text>ETA: {tracking.eta.label}</Text>}
          <Pressable
            style={styles.viewJob}
            onPress={() =>
              navigation.navigate('ActiveJob', {
                helpRequestId: activeJob.id,
                initialRequest: activeJob,
              })
            }
          >
            <Text style={styles.viewJobText}>VIEW JOB</Text>
          </Pressable>
        </View>
      )}

      {emergencyOn && summary && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Request summary</Text>
          <Text>Incoming: {summary.incoming}</Text>
          <Text>Accepted: {summary.accepted_active}</Text>
          <Text>In progress: {summary.in_progress}</Text>
          <Text>Completed: {summary.completed}</Text>
          <Pressable style={styles.linkBtn} onPress={() => navigation.navigate('MechanicRequests', {})}>
            <Text style={styles.linkBtnText}>VIEW ALL REQUESTS</Text>
          </Pressable>
        </View>
      )}

      {emergencyOn ? (
        <>
          <Pressable style={styles.primary} onPress={() => navigation.navigate('MechanicRequests', { tab: 'incoming' })}>
            <Text style={styles.primaryText}>Incoming requests</Text>
          </Pressable>

          {config?.features.mechanic_subscriptions ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Pro plan</Text>
              <Text>
                Accepted requests:{' '}
                {entitlements?.unlimited_accepted_requests
                  ? 'Unlimited (Pro)'
                  : `Up to ${entitlements?.max_accepted_requests ?? 5} lifetime free`}
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <Text style={styles.muted}>
          Customer dispatch is off while we grow the provider network. Your listing stays free in the directory.
        </Text>
      )}

      <Pressable style={styles.secondary} onPress={signOut}>
        <Text style={styles.secondaryText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f8fafc' },
  greeting: { fontSize: 22, fontWeight: '600', color: '#0f172a', marginBottom: 16 },
  activeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 16,
  },
  activeLabel: { fontSize: 12, fontWeight: '700', color: '#16a34a', textTransform: 'uppercase' },
  activeTitle: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  activeProblem: { color: '#475569', marginTop: 4 },
  activeStatus: { fontWeight: '700', marginTop: 8, color: '#0284c7' },
  viewJob: { marginTop: 12, backgroundColor: '#16a34a', padding: 12, borderRadius: 8, alignItems: 'center' },
  viewJobText: { color: '#fff', fontWeight: '800' },
  primary: { backgroundColor: '#16a34a', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  cardTitle: { fontWeight: '600', marginBottom: 8 },
  muted: { color: '#64748b', marginTop: 4 },
  linkBtn: { marginTop: 12 },
  linkBtnText: { color: '#0284c7', fontWeight: '700' },
  secondary: { marginTop: 8, alignItems: 'center' },
  secondaryText: { color: '#0284c7' },
});
