import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getApiErrorMessage } from '../../api/client';
import type { HelpRequest } from '../../api/helpRequests';
import { fetchMyMechanicProfile } from '../../api/mechanicProfile';
import { fetchMechanicHelpQueues, type MechanicHelpQueues } from '../../api/mechanicHelp';
import { MechanicRequestCard, type StatusTone } from '../../components/MechanicRequestCard';
import { RydAidRefreshControl } from '../../components/RydAidRefreshControl';
import { useMechanicLiveLocation } from '../../context/MechanicLocationContext';
import {
  mechanicQueueFetchCoords,
  useMechanicDistanceOrigin,
  useServicePinMaxOffsetKm,
} from '../../hooks/useMechanicDistanceOrigin';
import type { MechanicStackParamList } from '../../navigation/types';
import { isActiveJobStatus, jobStatusOf } from '../../utils/helpRequestUi';

type Props = NativeStackScreenProps<MechanicStackParamList, 'MechanicRequests'>;
type RouteTab = NonNullable<MechanicStackParamList['MechanicRequests']['tab']>;
type Segment = 'incoming' | 'active' | 'done' | 'closed';

const POLL_MS = 12_000;

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'incoming', label: 'Incoming' },
  { key: 'active', label: 'Active' },
  { key: 'done', label: 'Done' },
  { key: 'closed', label: 'Closed' },
];

function segmentOf(tab: RouteTab | undefined): Segment {
  switch (tab) {
    case 'accepted_active':
    case 'in_progress':
      return 'active';
    case 'completed':
      return 'done';
    case 'declined':
    case 'cancelled_expired':
      return 'closed';
    default:
      return 'incoming';
  }
}

type Row = { key: string; request: HelpRequest; declined: boolean };

function timeOf(r: HelpRequest): number {
  const t = new Date(r.cancelled_at ?? r.expired_at ?? r.completed_at ?? r.created_at ?? 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function rowsFor(queues: MechanicHelpQueues | null, seg: Segment): Row[] {
  if (!queues) return [];
  const plain = (list: HelpRequest[], declined = false) =>
    list.map((request) => ({ key: `${declined ? 'd' : 'r'}-${request.id}`, request, declined }));
  switch (seg) {
    case 'incoming':
      return plain(queues.incoming);
    case 'active':
      // Work in progress first, then accepted / on the way / arrived.
      return [...plain(queues.in_progress), ...plain(queues.accepted_active)];
    case 'done':
      return plain(queues.completed);
    case 'closed':
      return [...plain(queues.declined, true), ...plain(queues.cancelled_expired)].sort(
        (a, b) => timeOf(b.request) - timeOf(a.request),
      );
  }
}

function countFor(queues: MechanicHelpQueues | null, seg: Segment): number {
  const s = queues?.summary;
  if (!s) return 0;
  switch (seg) {
    case 'incoming':
      return s.incoming;
    case 'active':
      return s.accepted_active + s.in_progress;
    case 'done':
      return s.completed;
    case 'closed':
      return s.declined + s.cancelled_expired;
  }
}

const EMPTY: Record<Segment, { title: string; body: string }> = {
  incoming: {
    title: 'No requests right now',
    body: 'New offers show up here when someone near your service pin needs help.',
  },
  active: { title: 'No active jobs', body: 'Jobs you accept stay here until you finish them.' },
  done: { title: 'No completed jobs yet', body: 'Finished jobs, earnings and reviews will show here.' },
  closed: { title: 'Nothing closed', body: 'Offers you declined and requests that were cancelled or expired show here.' },
};

export function MechanicRequestsScreen({ navigation, route }: Props) {
  const [segment, setSegment] = useState<Segment>(segmentOf(route.params?.tab));
  const [queues, setQueues] = useState<MechanicHelpQueues | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<'available' | 'offline' | 'busy' | null>(null);
  const { coords, permissionDenied, servicePin, servicePinManual } = useMechanicLiveLocation();
  const maxOffsetKm = useServicePinMaxOffsetKm();
  const { origin } = useMechanicDistanceOrigin('service_pin');

  // Notifications / dashboard tiles can re-open this screen with a different tab.
  useEffect(() => {
    if (route.params?.tab) setSegment(segmentOf(route.params.tab));
  }, [route.params?.tab]);

  // Latest location in a ref so GPS drift doesn't recreate `load` or restart polling.
  const locRef = useRef({ coords, servicePin, servicePinManual, maxOffsetKm });
  locRef.current = { coords, servicePin, servicePinManual, maxOffsetKm };
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (mode: 'initial' | 'pull' | 'poll') => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (mode === 'pull') setRefreshing(true);
    try {
      const [profile, data] = await Promise.all([
        fetchMyMechanicProfile().catch(() => undefined),
        fetchMechanicHelpQueues(mechanicQueueFetchCoords(locRef.current)),
      ]);
      if (!mounted.current) return;
      if (profile !== undefined) setAvailability(profile?.availability_status ?? 'offline');
      setQueues(data);
      setError(null);
    } catch (e) {
      // Keep the last good list on screen; only show the error.
      if (mounted.current) setError(getApiErrorMessage(e));
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load('initial');
      let timer: ReturnType<typeof setInterval> | null = setInterval(() => void load('poll'), POLL_MS);
      const sub = AppState.addEventListener('change', (s) => {
        if (s === 'active') {
          void load('poll');
          if (!timer) timer = setInterval(() => void load('poll'), POLL_MS);
        } else if (timer) {
          clearInterval(timer);
          timer = null;
        }
      });
      return () => {
        if (timer) clearInterval(timer);
        sub.remove();
      };
    }, [load]),
  );

  // Round the distance origin (~100 m) so rows don't re-render on every GPS tick.
  const oLat = origin ? Math.round(origin.latitude * 1000) / 1000 : null;
  const oLng = origin ? Math.round(origin.longitude * 1000) / 1000 : null;
  const rowOrigin = useMemo(
    () => (oLat != null && oLng != null ? { latitude: oLat, longitude: oLng } : null),
    [oLat, oLng],
  );

  const openRequest = useCallback(
    (request: HelpRequest) => {
      if (request.status === 'SEARCHING') {
        navigation.navigate('IncomingRequestDetail', { helpRequestId: request.id });
      } else if (isActiveJobStatus(jobStatusOf(request))) {
        navigation.navigate('ActiveJob', { helpRequestId: request.id, justAccepted: false });
      } else {
        navigation.navigate('MechanicRequestDetail', { helpRequestId: request.id });
      }
    },
    [navigation],
  );

  const rows = useMemo(() => rowsFor(queues, segment), [queues, segment]);
  const isOnline = availability === 'available';
  const offlineIncoming = segment === 'incoming' && availability != null && availability !== 'available';

  const renderItem = useCallback<ListRenderItem<Row>>(
    ({ item }) => (
      <MechanicRequestCard
        request={item.request}
        mechanicCoords={rowOrigin}
        highlightDistance={segment === 'incoming'}
        showCustomerReview={segment === 'done'}
        onPress={openRequest}
        statusOverride={item.declined ? 'Declined by you' : undefined}
        statusToneOverride={item.declined ? ('muted' as StatusTone) : undefined}
      />
    ),
    [rowOrigin, segment, openRequest],
  );

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('MechanicHome');
  };

  const subtitle =
    segment === 'incoming'
      ? isOnline
        ? servicePinManual
          ? 'Nearest first · distance from your service pin'
          : 'Nearest first · distance from your pin or GPS'
        : 'Go online to receive new offers'
      : segment === 'active'
        ? 'Jobs you accepted and are working on'
        : segment === 'done'
          ? 'Completed jobs, earnings and reviews'
          : 'Declined, cancelled and expired';

  const header = (
    <View>
      {offlineIncoming ? (
        <View style={styles.banner} accessibilityRole="alert">
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>{availability === 'busy' ? 'You’re on a job' : 'You’re offline'}</Text>
            <Text style={styles.bannerBody}>
              {availability === 'busy'
                ? 'New offers pause until you finish your current job.'
                : 'Incoming offers are hidden until you go online from your dashboard.'}
            </Text>
          </View>
          <Pressable
            style={styles.bannerBtn}
            onPress={() => navigation.navigate('MechanicHome')}
            accessibilityRole="button"
            accessibilityLabel="Open dashboard"
          >
            <Text style={styles.bannerBtnText}>Dashboard</Text>
          </Pressable>
        </View>
      ) : null}
      {segment === 'incoming' && isOnline && permissionDenied ? (
        <Text style={styles.locationWarn}>Location is off — distances use your saved service pin.</Text>
      ) : null}
      {error && queues ? (
        <Pressable
          style={styles.errorStrip}
          onPress={() => void load('pull')}
          accessibilityRole="button"
          accessibilityLabel={`Couldn't refresh. ${error}. Tap to try again`}
        >
          <Text style={styles.errorStripText}>Couldn’t refresh · showing last update. Tap to retry.</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={goBack}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={6}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} accessibilityRole="header">
              My requests
            </Text>
            <Text style={styles.headerHint} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </View>

        <View style={styles.segments} accessibilityRole="tablist">
          {SEGMENTS.map((s) => {
            const active = segment === s.key;
            const count = countFor(queues, s.key);
            return (
              <Pressable
                key={s.key}
                style={[styles.segment, active && styles.segmentActive]}
                onPress={() => setSegment(s.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${s.label}, ${count} ${count === 1 ? 'request' : 'requests'}`}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
                  {s.label}
                </Text>
                {count > 0 ? (
                  <View
                    style={[
                      styles.badge,
                      active && styles.badgeActive,
                      s.key === 'incoming' && count > 0 && !active && styles.badgeAlert,
                    ]}
                  >
                    <Text style={[styles.badgeText, (active || s.key === 'incoming') && styles.badgeTextActive]}>
                      {count > 99 ? '99+' : count}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading && !queues ? (
        <View style={styles.listContent} accessibilityLabel="Loading requests" accessible>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : error && !queues ? (
        <View style={styles.stateBox} accessibilityRole="alert">
          <Text style={styles.stateIcon}>⚠️</Text>
          <Text style={styles.stateTitle}>Couldn’t load your requests</Text>
          <Text style={styles.stateBody}>{error}</Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              setLoading(true);
              void load('initial');
            }}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={styles.primaryBtnText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          renderItem={renderItem}
          ListHeaderComponent={header}
          contentContainerStyle={rows.length === 0 ? styles.listEmpty : styles.listContent}
          initialNumToRender={6}
          windowSize={7}
          removeClippedSubviews
          refreshControl={
            <RydAidRefreshControl refreshing={refreshing} onRefresh={() => void load('pull')} title="Pull to refresh" />
          }
          ListEmptyComponent={
            <View style={styles.stateBox}>
              <Text style={styles.stateIcon}>
                {segment === 'incoming' ? '📡' : segment === 'active' ? '🔧' : segment === 'done' ? '✅' : '🗂️'}
              </Text>
              <Text style={styles.stateTitle}>
                {offlineIncoming && availability !== 'busy' ? 'You’re offline' : EMPTY[segment].title}
              </Text>
              <Text style={styles.stateBody}>
                {offlineIncoming && availability !== 'busy'
                  ? 'Go online from your dashboard to start getting nearby requests.'
                  : EMPTY[segment].body}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function SkeletonCard() {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View style={[styles.skelCard, { opacity: pulse }]} importantForAccessibility="no-hide-descendants">
      <View style={styles.skelRow}>
        <View style={[styles.skelBar, { width: 90, height: 20, borderRadius: 999 }]} />
        <View style={[styles.skelBar, { width: 60, height: 14 }]} />
      </View>
      <View style={[styles.skelBar, { width: '70%', height: 18, marginTop: 14 }]} />
      <View style={[styles.skelBar, { width: '45%', height: 14, marginTop: 8 }]} />
      <View style={[styles.skelBar, { width: '85%', height: 12, marginTop: 12 }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  backText: { color: '#0284c7', fontSize: 34, lineHeight: 36, fontWeight: '500' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  headerHint: { marginTop: 2, fontSize: 13, color: '#64748b' },
  segments: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    padding: 4,
    marginTop: 10,
    marginHorizontal: 4,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 4,
  },
  segmentActive: {
    backgroundColor: '#fff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segmentText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  segmentTextActive: { color: '#0f172a', fontWeight: '800' },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeActive: { backgroundColor: '#0284c7' },
  badgeAlert: { backgroundColor: '#dc2626' },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#475569' },
  badgeTextActive: { color: '#fff' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 6,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  bannerTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  bannerBody: { fontSize: 13, color: '#475569', marginTop: 2, lineHeight: 18 },
  bannerBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerBtnText: { color: '#0369a1', fontWeight: '800', fontSize: 14 },
  locationWarn: { marginHorizontal: 16, marginBottom: 4, fontSize: 12, color: '#b45309', fontWeight: '600' },
  errorStrip: {
    marginHorizontal: 16,
    marginBottom: 6,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
  },
  errorStripText: { color: '#991b1b', fontSize: 13, fontWeight: '700' },
  listContent: { paddingTop: 10, paddingBottom: 24 },
  listEmpty: { flexGrow: 1, paddingTop: 10 },
  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  stateIcon: { fontSize: 36 },
  stateTitle: { marginTop: 10, fontSize: 18, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  stateBody: { marginTop: 6, textAlign: 'center', color: '#64748b', lineHeight: 21, fontSize: 15 },
  primaryBtn: {
    marginTop: 16,
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  skelCard: {
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  skelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skelBar: { backgroundColor: '#e2e8f0', borderRadius: 6 },
});
