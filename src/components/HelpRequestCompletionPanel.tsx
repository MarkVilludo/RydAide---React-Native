import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { HelpRequest } from '../api/helpRequests';
import { vehicleTitle } from '../utils/helpRequestUi';
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
  onSubmitReview: (rating: number, comment: string) => void;
  /** Parent scroll view should scroll so the comment field stays above the keyboard. */
  onCommentFocus?: () => void;
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
}: Props) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const job = request.job;

  const receipt = useMemo(() => {
    const service =
      job?.service_performed?.trim() ||
      request.problem_category?.name ||
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
            >
              <Text style={[styles.tagText, on && styles.tagTextOn]}>{tag}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        style={styles.input}
        placeholder="Add a comment (optional)"
        value={comment}
        onChangeText={setComment}
        multiline
        onFocus={onCommentFocus}
        blurOnSubmit={false}
      />
      <Pressable
        style={[styles.submit, (rating == null || submitting) && styles.submitDisabled]}
        disabled={rating == null || submitting}
        onPress={() => {
          if (rating == null) {
            return;
          }
          onSubmitReview(rating, buildComment());
        }}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Submit review</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#166534' },
  sub: { color: '#475569', marginTop: 4 },
  receipt: {
    marginTop: 14,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dcfce7',
    padding: 12,
  },
  receiptTitle: { fontSize: 13, fontWeight: '800', color: '#166534', marginBottom: 8 },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  receiptLabel: { fontSize: 13, color: '#64748b', flexShrink: 0 },
  receiptValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
    textAlign: 'right',
  },
  notesBlock: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e2e8f0' },
  notesBody: { marginTop: 4, fontSize: 13, color: '#334155', lineHeight: 19 },
  mechanicNotes: { marginTop: 8, fontSize: 12, color: '#64748b', fontStyle: 'italic' },
  body: { marginTop: 10, color: '#334155', lineHeight: 20 },
  rateLabel: { marginTop: 18, fontWeight: '700', color: '#0f172a' },
  stars: { flexDirection: 'row', marginTop: 10, justifyContent: 'space-between' },
  starCol: { alignItems: 'center', flex: 1, paddingVertical: 4 },
  star: { fontSize: 28, color: '#cbd5e1' },
  starOn: { color: '#f59e0b' },
  starCaption: { marginTop: 4, fontSize: 9, fontWeight: '600', color: '#94a3b8', textAlign: 'center' },
  starCaptionOn: { color: '#b45309' },
  rateHint: { marginTop: 8, fontSize: 12, color: '#64748b' },
  rateSelection: { marginTop: 8, fontSize: 13, fontWeight: '600', color: '#b45309' },
  tagsLabel: { marginTop: 16, fontSize: 13, fontWeight: '600', color: '#475569' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tagOn: { backgroundColor: '#ecfdf5', borderColor: '#86efac' },
  tagText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  tagTextOn: { color: '#166534' },
  input: {
    marginTop: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  submit: {
    marginTop: 12,
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.45 },
  submitText: { color: '#fff', fontWeight: '700' },
  ratingDone: { fontSize: 18, marginTop: 8, color: '#f59e0b', fontWeight: '700' },
});
