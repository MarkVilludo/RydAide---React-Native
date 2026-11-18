import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { HelpRequest } from '../api/helpRequests';
import { HelpRequestMap } from './HelpRequestMap';
import { HelpRequestCompletionPanel } from './HelpRequestCompletionPanel';
import { OwnerPayMechanicCard } from './JobPaymentCards';
import { colors, radii, spacing, touch } from '../theme/tokens';
import { activeJourneyHeadline } from '../utils/helpJourney';
import { vehicleTitle } from '../utils/helpRequestUi';
import type { KeyboardAwareScrollViewRef } from './KeyboardAwareScrollView';

type Props = {
  request: HelpRequest;
  reviewSubmitting: boolean;
  onSubmitReview: (rating: number, comment: string) => Promise<void>;
  onCommentFocus?: () => void;
  onUpdated: (request: HelpRequest) => void;
  scrollRef?: React.RefObject<KeyboardAwareScrollViewRef | null>;
  onDone: () => void;
  onViewHistory?: () => void;
};

export function OwnerHelpCompletionSection({
  request,
  reviewSubmitting,
  onSubmitReview,
  onCommentFocus,
  onUpdated,
  scrollRef,
  onDone,
  onViewHistory,
}: Props) {
  const [mapOpen, setMapOpen] = useState(false);
  const reviewAnchor = useRef(0);

  const scrollToReview = () => {
    requestAnimationFrame(() => {
      scrollRef?.current?.scrollTo({ y: Math.max(0, reviewAnchor.current - 24), animated: true });
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.hero} accessibilityRole="header">
        <Text style={styles.heroTitle}>{activeJourneyHeadline(request)}</Text>
        <Text style={styles.heroSub} numberOfLines={2}>
          {vehicleTitle(request)}
        </Text>
        <Text style={styles.heroHint}>Pay your mechanic in person, then rate your experience below.</Text>
      </View>

      <Pressable
        style={styles.mapToggle}
        onPress={() => setMapOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={mapOpen ? 'Hide map' : 'Show help location on map'}
      >
        <Text style={styles.mapToggleText}>{mapOpen ? 'Hide map' : 'View help location'}</Text>
      </Pressable>
      {mapOpen ? (
        <View style={styles.mapBox}>
          <HelpRequestMap
            request={{ latitude: request.latitude, longitude: request.longitude, title: 'Help location' }}
            requestPinLabel="You"
            height={128}
            showMyLocation={false}
          />
        </View>
      ) : null}

      <Text style={styles.payNote}>
        Recording payment in RydAid is optional — it does not move money; it helps you remember how you paid.
      </Text>

      <OwnerPayMechanicCard
        request={request}
        onUpdated={(updated) => {
          onUpdated(updated);
          scrollToReview();
        }}
      />

      <View
        onLayout={(e) => {
          reviewAnchor.current = e.nativeEvent.layout.y;
        }}
      />

      <HelpRequestCompletionPanel
        request={request}
        submitting={reviewSubmitting}
        onCommentFocus={onCommentFocus}
        onSubmitReview={onSubmitReview}
        onSkip={request.review ? undefined : onDone}
      />

      {request.review ? (
        <View style={styles.doneActions}>
          <Pressable style={styles.primaryDone} onPress={onDone} accessibilityRole="button">
            <Text style={styles.primaryDoneText}>Back to home</Text>
          </Pressable>
          {onViewHistory ? (
            <Pressable style={styles.secondaryDone} onPress={onViewHistory} accessibilityRole="button">
              <Text style={styles.secondaryDoneText}>View history</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  hero: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  heroSub: { fontSize: 16, fontWeight: '600', color: colors.muted },
  heroHint: { fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: spacing.xs },
  mapToggle: { alignSelf: 'flex-start', minHeight: touch.min, justifyContent: 'center', paddingVertical: spacing.xs },
  mapToggleText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  mapBox: { borderRadius: radii.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  payNote: { fontSize: 13, lineHeight: 18, color: colors.muted, marginBottom: spacing.xs },
  doneActions: { marginTop: spacing.lg, gap: spacing.sm },
  primaryDone: {
    minHeight: touch.control,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDoneText: { color: colors.onPrimary, fontWeight: '800', fontSize: 16 },
  secondaryDone: {
    minHeight: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryDoneText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
});