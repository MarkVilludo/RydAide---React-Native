import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui';
import { getApiErrorMessage } from '../../api/client';
import { colors, radii, spacing, type as typeScale } from '../../theme/tokens';
import { RydAidRefreshControl } from '../../components/RydAidRefreshControl';
import { fetchHelpRequests, type HelpRequest } from '../../api/helpRequests';
import { logger } from '../../utils/logger';
import type { OwnerStackParamList } from '../../navigation/types';
import { isOwnerLiveHelpRequest, jobStatusOf, problemNamesOf } from '../../utils/helpRequestUi';
import { jobWorkDurationLabel } from '../../utils/jobWorkDuration';

type Props = NativeStackScreenProps<OwnerStackParamList, 'HelpRequestHistory'>;

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function vehicleLabel(item: HelpRequest) {
  if (item.vehicle_description?.trim()) {
    return item.vehicle_description.trim();
  }
  const v = item.vehicle;
  if (!v) return '—';
  return [v.make?.name, v.model?.name, v.nickname].filter(Boolean).join(' ') || 'Vehicle';
}

function locationLabel(item: HelpRequest) {
  if (item.address_text) return item.address_text;
  return `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`;
}

function statusTone(status: string) {
  if (status === 'COMPLETED') return styles.statusDone;
  if (status === 'CANCELLED' || status === 'EXPIRED' || status === 'NO_MECHANIC_FOUND') return styles.statusMuted;
  return null;
}

export function HelpRequestHistoryScreen({ navigation }: Props) {
  const [items, setItems] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    fetchHelpRequests()
      .then((list) => {
        setItems(list);
        setError(null);
      })
      .catch((err) => {
        logger.error('HelpHistory', 'Failed to load help requests', err);
        // Keep what we already showed; only surface the error.
        setError(getApiErrorMessage(err));
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading && items.length === 0) {
    return (
      <View style={styles.list}>
        <View style={styles.header}>
          <Text style={styles.headerTitle} accessibilityRole="header">
            My help history
          </Text>
        </View>
        <LoadingSkeleton rows={4} style={styles.skeleton} />
      </View>
    );
  }

  if (error && items.length === 0) {
    return <ErrorState title="Couldn’t load your help history" message={error} onRetry={() => load()} />;
  }

  return (
    <FlatList
      style={styles.list}
      data={items}
      keyExtractor={(item) => String(item.id)}
      refreshControl={
        <RydAidRefreshControl refreshing={refreshing} onRefresh={() => load(true)} title="Pull to refresh" />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.headerTitle} accessibilityRole="header">
            My help history
          </Text>
          <Text style={styles.headerHint}>Past emergency and service requests you submitted.</Text>
          {error ? (
            <ErrorState variant="inline" title="Couldn’t refresh" message={error} onRetry={() => load(true)} style={styles.inlineError} />
          ) : null}
        </View>
      }
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        <EmptyState
          icon="🧾"
          title="No help requests yet"
          message="When you request roadside help or a service, it shows up here."
          actionLabel="Request help"
          onAction={() => navigation.navigate('NeedHelp', {})}
        />
      }
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Request ${item.id}, ${item.status_label ?? item.status}. ${isOwnerLiveHelpRequest(item) ? 'Tap to track live' : 'Tap for full details'}`}
          onPress={() => {
            if (isOwnerLiveHelpRequest(item)) {
              navigation.navigate('ActiveHelpRequest', { helpRequestId: item.id });
            } else {
              navigation.navigate('HelpRequestDetail', { helpRequestId: item.id });
            }
          }}
        >
          <View style={styles.cardHead}>
            <Text style={styles.id}>Request #{item.id}</Text>
            <Text style={[styles.status, statusTone(item.status)]}>{item.status_label ?? item.status}</Text>
          </View>
          <Text style={styles.type}>{item.request_type_label ?? item.request_type}</Text>
          <Text style={styles.line}>Vehicle: {vehicleLabel(item)}</Text>
          <Text style={styles.line}>Problem: {problemNamesOf(item, '—')}</Text>
          <Text style={styles.remarks} numberOfLines={2}>{item.remarks}</Text>
          <Text style={styles.meta}>Requested: {formatDate(item.created_at)}</Text>
          <Text style={styles.meta} numberOfLines={1}>Location: {locationLabel(item)}</Text>
          {item.mechanic && item.status !== 'SEARCHING' && (
            <Text style={styles.meta}>
              Mechanic:{' '}
              {item.mechanic.display_name ||
                item.mechanic.mechanic_name ||
                item.mechanic.business_name ||
                'Mechanic'}
            </Text>
          )}
          {item.status === 'SEARCHING' && item.search_progress && (
            <Text style={styles.meta}>
              Notified {item.search_progress.mechanics_notified_total} · waiting{' '}
              {item.search_progress.mechanics_awaiting_response}
            </Text>
          )}
          {item.shop && <Text style={styles.meta}>Shop: {item.shop.name}</Text>}
          {item.accepted_at && <Text style={styles.meta}>Accepted: {formatDate(item.accepted_at)}</Text>}
          {item.completed_at && <Text style={styles.meta}>Completed: {formatDate(item.completed_at)}</Text>}
          {jobStatusOf(item) === 'COMPLETED' && jobWorkDurationLabel(item.job) ? (
            <Text style={styles.workTime}>{jobWorkDurationLabel(item.job)}</Text>
          ) : null}
          {item.cancelled_at && <Text style={styles.meta}>Cancelled: {formatDate(item.cancelled_at)}</Text>}
          <Text style={styles.tapHint}>
            {isOwnerLiveHelpRequest(item) ? 'Tap to track live' : 'Tap for full details'}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  listContent: { paddingBottom: spacing.xxl },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: typeScale.title,
  headerHint: { ...typeScale.caption, marginTop: spacing.xs },
  inlineError: { marginTop: spacing.md, marginBottom: 0 },
  skeleton: { paddingHorizontal: spacing.md },
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: { opacity: 0.85 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  id: { ...typeScale.bodyStrong, flexShrink: 1 },
  type: { color: '#475569', marginTop: spacing.xxs, fontWeight: '600', fontSize: 14 },
  status: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryInk,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  statusDone: { color: colors.liveInk, backgroundColor: colors.liveSoft },
  statusMuted: { color: colors.muted, backgroundColor: colors.surfaceMuted },
  line: { color: '#334155', marginTop: spacing.xs, fontSize: 14 },
  remarks: { color: colors.muted, marginTop: spacing.xs + 2, fontStyle: 'italic', fontSize: 14 },
  meta: { ...typeScale.caption, fontSize: 12, marginTop: spacing.xs },
  workTime: { color: colors.liveInk, marginTop: spacing.xs, fontSize: 12, fontWeight: '700' },
  tapHint: { color: colors.primary, marginTop: spacing.md, fontSize: 13, fontWeight: '700' },
});
