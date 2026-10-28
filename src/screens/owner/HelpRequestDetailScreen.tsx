import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from '../../components/KeyboardAwareScrollView';
import { getApiErrorMessage } from '../../api/client';
import {
  cancelHelpRequest,
  fetchHelpRequest,
  submitHelpRequestReview,
  type HelpRequest,
} from '../../api/helpRequests';
import { CancelHelpRequestButton } from '../../components/CancelHelpRequestButton';
import { GrabStyleBottomSheet } from '../../components/GrabStyleBottomSheet';
import { HelpRequestCompletionPanel } from '../../components/HelpRequestCompletionPanel';
import { HelpRequestMap } from '../../components/HelpRequestMap';
import { HelpRequestPhotoGallery } from '../../components/HelpRequestPhotoGallery';
import type { OwnerStackParamList } from '../../navigation/types';
import { jobWorkDurationValueOnly } from '../../utils/jobWorkDuration';
import {
  canOwnerCancelHelpRequest,
  formatRequestDate,
  isOwnerCompletedHelpRequest,
  jobStatusLabelOf,
  jobStatusOf,
  vehicleTitle,
} from '../../utils/helpRequestUi';

type Props = NativeStackScreenProps<OwnerStackParamList, 'HelpRequestDetail'>;

export function HelpRequestDetailScreen({ route }: Props) {
  const { helpRequestId } = route.params;
  const [request, setRequest] = useState<HelpRequest | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const cancelLock = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const scrollReviewIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const load = useCallback(() => {
    fetchHelpRequest(helpRequestId).then(setRequest).catch(() => setRequest(null));
  }, [helpRequestId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmCancel = () => {
    if (!request) return;
    Alert.alert(
      'Cancel request?',
      'Stop searching for a mechanic? You can submit a new request anytime.',
      [
        { text: 'Keep request', style: 'cancel' },
        {
          text: 'Cancel request',
          style: 'destructive',
          onPress: async () => {
            if (cancelLock.current) return;
            cancelLock.current = true;
            try {
              await cancelHelpRequest(helpRequestId);
              const updated = await fetchHelpRequest(helpRequestId);
              setRequest(updated);
            } catch (e) {
              cancelLock.current = false;
              Alert.alert('Cancel failed', getApiErrorMessage(e));
            }
          },
        },
      ],
    );
  };

  if (!request) {
    return <ActivityIndicator style={{ marginTop: 40 }} />;
  }

  const location =
    request.address_text ?? `${request.latitude.toFixed(5)}, ${request.longitude.toFixed(5)}`;
  const workTime = jobWorkDurationValueOnly(request.job);
  const canCancel = canOwnerCancelHelpRequest(request);
  const completed = isOwnerCompletedHelpRequest(request);
  const terminal = ['COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_MECHANIC_FOUND'].includes(request.status);
  const showLockedHint = !canCancel && !terminal && !!request.mechanic;
  const canReview = completed && !!request.mechanic;

  return (
    <View style={styles.root}>
      <HelpRequestMap
        request={{
          latitude: request.latitude,
          longitude: request.longitude,
          title: 'Help location',
        }}
        requestPinLabel="You"
        height={200}
        zoomPreset="detail"
        showMyLocation={false}
        showLiveDistanceBadge={false}
      />

      <KeyboardAwareScrollView
        ref={scrollRef}
        style={styles.scroll}
        extraBottomPadding={canReview ? 160 : canCancel ? 8 : 0}
        contentContainerStyle={[styles.scrollContent, canCancel && styles.scrollWithFooter]}
      >
        <GrabStyleBottomSheet>
          <View style={styles.titleRow}>
            <Text style={styles.headline}>Request #{request.id}</Text>
            <Text style={styles.statusPill}>{jobStatusLabelOf(request)}</Text>
          </View>

          {canCancel ? (
            <Text style={styles.cancelHint}>
              Still looking for a mechanic. You can cancel below if you no longer need help.
            </Text>
          ) : showLockedHint ? (
            <Text style={styles.lockedHint}>
              A mechanic has accepted this request. Call them if your plans change — cancellation is
              no longer available in the app.
            </Text>
          ) : null}

          <Section title="Vehicle">
            <Text style={styles.bold}>{vehicleTitle(request)}</Text>
          </Section>

          <Section title="Problem">
            <Text style={styles.bold}>{request.problem_category?.name ?? '—'}</Text>
            <Text style={styles.body}>{request.remarks}</Text>
          </Section>

          <Section title="Location">
            <Text style={styles.body}>{location}</Text>
            <Pressable
              onPress={() =>
                Linking.openURL(
                  `https://www.google.com/maps/search/?api=1&query=${request.latitude},${request.longitude}`,
                )
              }
            >
              <Text style={styles.link}>Open in maps</Text>
            </Pressable>
          </Section>

          {request.mechanic && request.status !== 'SEARCHING' ? (
            <Section title="Mechanic">
              <Text style={styles.bold}>{request.mechanic.business_name}</Text>
              {request.mechanic.phone ? (
                <Pressable onPress={() => Linking.openURL(`tel:${request.mechanic!.phone}`)}>
                  <Text style={styles.link}>Call mechanic</Text>
                </Pressable>
              ) : null}
            </Section>
          ) : null}

          <Section title="Timeline">
            <TimelineRow label="Created" value={formatRequestDate(request.created_at)} />
            <TimelineRow label="Accepted" value={formatRequestDate(request.accepted_at)} />
            <TimelineRow label="Completed" value={formatRequestDate(request.completed_at)} />
            {request.cancelled_at ? (
              <TimelineRow label="Cancelled" value={formatRequestDate(request.cancelled_at)} />
            ) : null}
            {jobStatusOf(request) === 'COMPLETED' && workTime ? (
              <Text style={styles.workTime}>Work time · {workTime}</Text>
            ) : null}
          </Section>

          {request.answers && request.answers.length > 0 ? (
            <Section title="Additional details">
              {request.answers.map((a) => (
                <Text key={a.question_id} style={styles.answer}>
                  {a.question}: {a.answer}
                </Text>
              ))}
            </Section>
          ) : null}

          {request.media && request.media.length > 0 ? (
            <HelpRequestPhotoGallery media={request.media} title="Problem photos" compact />
          ) : null}

          {canReview ? (
            <HelpRequestCompletionPanel
              request={request}
              submitting={reviewSubmitting}
              onCommentFocus={scrollReviewIntoView}
              onSubmitReview={async (rating, comment) => {
                setReviewSubmitting(true);
                try {
                  await submitHelpRequestReview(helpRequestId, rating, comment);
                  const updated = await fetchHelpRequest(helpRequestId);
                  setRequest(updated);
                } catch (e) {
                  Alert.alert('Review', getApiErrorMessage(e));
                } finally {
                  setReviewSubmitting(false);
                }
              }}
            />
          ) : null}

        </GrabStyleBottomSheet>
      </KeyboardAwareScrollView>

      {canCancel ? <CancelHelpRequestButton fixedFooter onPress={confirmCancel} /> : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function TimelineRow({ label, value }: { label: string; value: string }) {
  if (value === '—') return null;
  return (
    <Text style={styles.timeline}>
      {label}: {value}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#e2e8f0' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  scrollWithFooter: { paddingBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headline: { flex: 1, fontSize: 18, fontWeight: '800', color: '#0284c7' },
  statusPill: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  cancelHint: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: '#475569',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 10,
  },
  lockedHint: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: '#475569',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
  },
  section: {
    marginTop: 14,
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 8,
    color: '#64748b',
    textTransform: 'uppercase',
    fontSize: 12,
  },
  bold: { fontWeight: '600', fontSize: 16, color: '#0f172a' },
  body: { marginTop: 6, color: '#475569', lineHeight: 22 },
  link: { color: '#0284c7', fontWeight: '600', marginTop: 8 },
  timeline: { marginTop: 4, color: '#334155' },
  workTime: { marginTop: 8, fontWeight: '800', color: '#166534', fontSize: 15 },
  answer: { color: '#475569', marginTop: 4 },
});
