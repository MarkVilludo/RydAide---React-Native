import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { HelpRequest } from '../../api/helpRequests';
import { fetchMyMechanicProfile } from '../../api/mechanicProfile';
import { fetchMechanicHelpQueues, type MechanicHelpQueues } from '../../api/mechanicHelp';
import { MechanicRequestCard } from '../../components/MechanicRequestCard';
import { useMechanicLiveLocation } from '../../context/MechanicLocationContext';
import {
  mechanicQueueFetchCoords,
  useMechanicDistanceOrigin,
  useServicePinMaxOffsetKm,
} from '../../hooks/useMechanicDistanceOrigin';
import type { MechanicStackParamList } from '../../navigation/types';
import { isActiveJobStatus, jobStatusOf } from '../../utils/helpRequestUi';

type Props = NativeStackScreenProps<MechanicStackParamList, 'MechanicRequests'>;

type TabKey =
  | 'incoming'
  | 'accepted_active'
  | 'in_progress'
  | 'completed'
  | 'declined'
  | 'cancelled_expired';

const TABS: { key: TabKey; label: string; hint: string }[] = [
  { key: 'incoming', label: 'Incoming', hint: 'Go online on your dashboard to receive nearby offers' },
  { key: 'accepted_active', label: 'Active', hint: 'Jobs you accepted and are heading to' },
  { key: 'in_progress', label: 'Working', hint: 'Jobs currently in progress' },
  { key: 'completed', label: 'Done', hint: 'Completed help requests' },
  { key: 'declined', label: 'Declined', hint: 'Offers you declined' },
  { key: 'cancelled_expired', label: 'Cancelled', hint: 'Expired or cancelled requests' },
];

export function MechanicRequestsScreen({ navigation, route }: Props) {
  const initialTab = route.params?.tab ?? 'incoming';
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [queues, setQueues] = useState<MechanicHelpQueues | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availability, setAvailability] = useState<'available' | 'offline' | 'busy'>('offline');
  const { coords, permissionDenied, servicePin, servicePinManual } = useMechanicLiveLocation();
  const maxOffsetKm = useServicePinMaxOffsetKm();
  const { origin: mechanicCoords } = useMechanicDistanceOrigin('service_pin');

  const isOnline = availability === 'available';

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else if (!queues) {
        setLoading(true);
      }
      try {
        const profile = await fetchMyMechanicProfile();
        setAvailability(profile?.availability_status ?? 'offline');
        const data = await fetchMechanicHelpQueues(
          mechanicQueueFetchCoords({ servicePin, servicePinManual, coords, maxOffsetKm }),
        );
        setQueues(data);
      } catch {
        setQueues(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      coords?.latitude,
      coords?.longitude,
      servicePin?.latitude,
      servicePin?.longitude,
      servicePinManual,
    ],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void load(true), 12_000);
      return () => clearInterval(timer);
    }, [load]),
  );

  const openRequest = (request: HelpRequest) => {
    const jobStatus = jobStatusOf(request);
    if (request.status === 'SEARCHING') {
      navigation.navigate('MechanicRequestDetail', { helpRequestId: request.id });
      return;
    }
    if (isActiveJobStatus(jobStatus)) {
      navigation.navigate('ActiveJob', { helpRequestId: request.id, justAccepted: false });
      return;
    }
    navigation.navigate('MechanicRequestDetail', { helpRequestId: request.id });
  };

  const list = queues ? queues[tab] : [];
  const activeTabMeta = TABS.find((t) => t.key === tab)!;
  const statusOverride =
    tab === 'declined' ? 'Declined' : tab === 'cancelled_expired' ? 'Cancelled / Expired' : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>My requests</Text>
        <Text style={styles.headerHint}>
          {tab === 'incoming' && !isOnline
            ? 'You are offline — incoming offers are hidden until you go online.'
            : tab === 'incoming' && isOnline
              ? servicePinManual
                ? 'Sorted nearest first · distance from your saved service pin'
                : 'Sorted nearest first · distance from your pin or GPS'
              : activeTabMeta.hint}
        </Text>
        {tab === 'incoming' && !isOnline ? (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>Offline — turn on availability from the dashboard to get new requests.</Text>
          </View>
        ) : null}
        {tab === 'incoming' && isOnline && permissionDenied ? (
          <Text style={styles.locationWarn}>Location off — distances use your saved service pin.</Text>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
        style={styles.tabScroll}
      >
        {TABS.map((t) => {
          const count = queues?.summary[t.key] ?? 0;
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              style={[styles.tabPill, active && styles.tabPillActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>{t.label}</Text>
              <View style={[styles.tabCount, active && styles.tabCountActive]}>
                <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>{count}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading && !queues ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#0284c7" />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={list.length === 0 ? styles.listEmpty : styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Nothing here</Text>
              <Text style={styles.emptyBody}>
                {tab === 'incoming' && !isOnline
                  ? 'While offline, you will not see or receive new incoming help offers.'
                  : tab === 'incoming'
                    ? 'New offers appear when owners nearby need help and you are online.'
                    : 'Requests in this category will show up here.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <MechanicRequestCard
              request={item}
              mechanicCoords={mechanicCoords}
              highlightDistance={tab === 'incoming'}
              onPress={() => openRequest(item)}
              statusOverride={statusOverride}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f1f5f9' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: { alignSelf: 'flex-start', marginBottom: 4 },
  backText: { color: '#0284c7', fontWeight: '700', fontSize: 15 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  headerHint: { marginTop: 4, fontSize: 13, color: '#64748b', lineHeight: 18 },
  locationWarn: { marginTop: 6, fontSize: 12, color: '#b45309', fontWeight: '600' },
  offlineBanner: {
    marginTop: 10,
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  offlineBannerText: { fontSize: 13, color: '#475569', lineHeight: 18, fontWeight: '600' },
  tabScroll: { maxHeight: 56, backgroundColor: '#fff' },
  tabRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
  },
  tabPillActive: { backgroundColor: '#0f172a' },
  tabPillText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  tabPillTextActive: { color: '#fff' },
  tabCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabCountActive: { backgroundColor: '#334155' },
  tabCountText: { fontSize: 11, fontWeight: '800', color: '#475569' },
  tabCountTextActive: { color: '#fff' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingTop: 8, paddingBottom: 24 },
  listEmpty: { flexGrow: 1 },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  emptyBody: { marginTop: 8, textAlign: 'center', color: '#64748b', lineHeight: 22, fontSize: 15 },
});
