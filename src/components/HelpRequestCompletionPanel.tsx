import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { HelpRequest } from '../api/helpRequests';
import { colors, radii, spacing, touch } from '../theme/tokens';
import { vehicleTitle, problemNamesOf } from '../utils/helpRequestUi';
import { jobWorkDurationValueOnly } from '../utils/jobWorkDuration';

const STAR_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Great',
  5: 'Excellent',
};

const QUICK_TAGS = ['On time', 'Professional', 'Fair price', 'Clear comms', 'Quality work'] as const;

type Props = {
  request: HelpRequest;
  submitting: boolean;
  onSubmitReview: (rating: number, comment: string) => void | Promise<void>;
  onCommentFocus?: () => void;
  onSkip?: () => void;
};

function formatPhpAmount(amount: number | null | undefined): string | null {
  if (amount == null || !Number.isFinite(amount)) {
    return null;
  }
  return `₱${Math.round(amount).toLocaleString('en-PH')}`;
}

function ReceiptRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) {
    return null;
  }
  return (
    <View style={styles.receiptRow}>
      <Text style={styles.receiptLabel}>{label}</Text>
      <Text style={styles.receiptValue}>{value}</Text>
    </View>
  );
}

export function HelpRequestCompletionPanel({
  request,
  submitting,
  onSubmitReview,
  onCommentFocus,
  onSkip,
}: Props) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const job = request.job;

  const receipt = useMemo(() => {
    const service =
      job?.service_performed?.trim() ||
      problemNamesOf(request) ||
      request.request_type_label ||
      null;
    const amount = formatPhpAmount(job?.pricing?.final_service_amount_php);
    const duration = jobWorkDurationValueOnly(job);
    const mechanic =
      request.mechanic?.display_name?.trim() ||
      request.mechanic?.business_name?.trim() ||
      null;
    return { service, amount, duration, mechanic };
  }, [job, request]);

  if (request.review) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Thanks for your review</Text>
        <Text style={styles.ratingDone}>
          ★ {request.review.rating} · {STAR_LABELS[request.review.rating] ?? ''}
        </Text>
        {request.review.comment ? <Text style={styles.body}>{request.review.comment}</Text> : null}
      </View>
    );
  }

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const buildComment = () => {
    const parts: string[] = [];
    if (tags.length > 0) {
      parts.push(tags.join(' · '));
    }
    const trimmed = comment.trim();
    if (trimmed) {
      parts.push(trimmed);
    }
    return parts.join('\n\n');
  };

  const handleSubmit = async () => {
    if (rating == null || submitting) {
      return;
    }
    await onSubmitReview(rating, buildComment());
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Service completed</Text>
      <Text style={styles.sub}>{vehicleTitle(request)}</Text>

      <View style={styles.receipt}>
        <Text style={styles.receiptTitle}>Job summary</Text>
        <ReceiptRow label="Service" value={receipt.service} />
        <ReceiptRow label="Amount" value={receipt.amount} />
        <ReceiptRow label="Duration" value={receipt.duration} />
        <ReceiptRow label="Mechanic" value={receipt.mechanic} />
        {job?.completion_notes ? (
          <View style={styles.notesBlock}>
            <Text style={styles.receiptLabel}>Notes</Text>
            <Text style={styles.notesBody}>{job.completion_notes}</Text>
          </View>
        ) : null}
        {job?.mechanic_notes ? (
          <Text style={styles.mechanicNotes}>Mechanic: {job.mechanic_notes}</Text>
        ) : null}
      </View>

      <Text style={styles.rateLabel}>Rate your experience</Text>
      <View style={styles.stars}>
        {([1, 2, 3, 4, 5] as const).map((n) => {
          const on = rating != null && n <= rating;
          const selected = rating === n;
          return (
            <Pressable
              key={n}
              onPress={() => setRating(n)}
              style={styles.starCol}
              accessibilityRole="button"
              accessibilityLabel={`${n} star, ${STAR_LABELS[n]}`}
              accessibilityState={{ selected }}
              hitSlop={6}
            >
              <Text style={[styles.star, on && styles.starOn]}>★</Text>
              <Text style={[styles.starCaption, selected && styles.starCaptionOn]}>
                {STAR_LABELS[n]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {rating == null ? (
        <Text style={styles.rateHint}>Tap a star to rate before submitting.</Text>
      ) : (
        <Text style={styles.rateSelection}>
          You selected {rating} — {STAR_LABELS[rating]}
        </Text>
      )}

      <Text style={styles.tagsLabel}>Quick tags (optional)</Text>
      <View style={styles.tags}>
        {QUICK_TAGS.map((tag) => {
          const on = tags.includes(tag);
          return (
            <Pressable
              key={tag}
              onPress={() => toggleTag(tag)}
              style={[styles.tag, on && styles.tagOn]}
              accessibilityRole="button"
            >
              <Text style={[styles.tagText, on && styles.tagTextOn]}>{tag}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        style={styles.input}
        placeholder="Add a comment (optional)"
        placeholderTextColor={colors.mutedSoft}
        value={comment}
        onChangeText={setComment}
        multiline
        onFocus={onCommentFocus}
        blurOnSubmit={false}
      />

      <Pressable
        style={[styles.submit, (rating == null || submitting) && styles.submitDisabled]}
        disabled={rating == null || submitting}
        onPress={() => void handleSubmit()}
        accessibilityRole="button"
        accessibilityLabel="Submit review"
      >
        {submitting ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.submitText}>Submit review</Text>
        )}
      </Pressable>

      {onSkip ? (
        <Pressable
          style={styles.skipBtn}
          onPress={onSkip}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Not now, skip review"
        >
          <Text style={styles.skipText}>Not now</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.md,
    backgroundColor: colors.liveSoft,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.liveBorder,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.liveInk },
  sub: { color: colors.muted, marginTop: spacing.xs },
  receipt: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.liveBorder,
    padding: spacing.md,
  },
  receiptTitle: { fontSize: 13, fontWeight: '800', color: colors.liveInk, marginBottom: spacing.sm },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  receiptLabel: { fontSize: 13, color: colors.muted, flexShrink: 0 },
  receiptValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    textAlign: 'right',
  },
  notesBlock: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  notesBody: { marginTop: spacing.xs, fontSize: 13, color: colors.text, lineHeight: 19 },
  mechanicNotes: { marginTop: spacing.sm, fontSize: 12, color: colors.muted, fontStyle: 'italic' },
  body: { marginTop: spacing.sm, color: colors.text, lineHeight: 20 },
  rateLabel: { marginTop: spacing.lg, fontWeight: '700', color: colors.text },
  stars: { flexDirection: 'row', marginTop: spacing.sm, justifyContent: 'space-between' },
  starCol: {
    alignItems: 'center',
    flex: 1,
    minHeight: touch.min,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  star: { fontSize: 32, color: colors.border },
  starOn: { color: colors.busy },
  starCaption: {
    marginTop: spacing.xs,
    fontSize: 9,
    fontWeight: '600',
    color: colors.mutedSoft,
    textAlign: 'center',
  },
  starCaptionOn: { color: colors.warnInk },
  rateHint: { marginTop: spacing.sm, fontSize: 12, color: colors.muted },
  rateSelection: { marginTop: spacing.sm, fontSize: 13, fontWeight: '600', color: colors.warnInk },
  tagsLabel: { marginTop: spacing.lg, fontSize: 13, fontWeight: '600', color: colors.muted },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagOn: { backgroundColor: colors.liveSoft, borderColor: colors.liveBorder },
  tagText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  tagTextOn: { color: colors.liveInk },
  input: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.md,
    minHeight: 72,
    textAlignVertical: 'top',
    color: colors.text,
  },
  submit: {
    marginTop: spacing.md,
    minHeight: touch.control,
    backgroundColor: colors.live,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  submitDisabled: { opacity: 0.45 },
  submitText: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
  skipBtn: {
    marginTop: spacing.sm,
    minHeight: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: { color: colors.muted, fontWeight: '700', fontSize: 15 },
  ratingDone: { fontSize: 18, marginTop: spacing.sm, color: colors.busy, fontWeight: '700' },
});