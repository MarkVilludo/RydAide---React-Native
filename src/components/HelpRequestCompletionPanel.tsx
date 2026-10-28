import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { HelpRequest } from '../api/helpRequests';
import { vehicleTitle } from '../utils/helpRequestUi';

type Props = {
  request: HelpRequest;
  submitting: boolean;
  onSubmitReview: (rating: number, comment: string) => void;
};

export function HelpRequestCompletionPanel({ request, submitting, onSubmitReview }: Props) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  if (request.review) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Thanks for your review</Text>
        <Text style={styles.rating}>★ {request.review.rating}</Text>
        {request.review.comment ? <Text style={styles.body}>{request.review.comment}</Text> : null}
      </View>
    );
  }

  const job = request.job;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Service completed</Text>
      <Text style={styles.sub}>{vehicleTitle(request)} · {request.problem_category?.name}</Text>
      {job?.service_performed ? (
        <Text style={styles.body}>Work done: {job.service_performed}</Text>
      ) : null}
      {job?.completion_notes ? (
        <Text style={styles.body}>{job.completion_notes}</Text>
      ) : null}
      {job?.mechanic_notes ? (
        <Text style={styles.muted}>Mechanic notes: {job.mechanic_notes}</Text>
      ) : null}
      {request.mechanic && (
        <Text style={styles.muted}>
          Mechanic: {request.mechanic.display_name ?? request.mechanic.business_name}
        </Text>
      )}

      <Text style={styles.rateLabel}>Rate your experience</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setRating(n)} style={styles.starBtn}>
            <Text style={[styles.star, n <= rating && styles.starOn]}>★</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder="Optional comment"
        value={comment}
        onChangeText={setComment}
        multiline
      />
      <Pressable
        style={styles.submit}
        disabled={submitting}
        onPress={() => onSubmitReview(rating, comment)}
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
  body: { marginTop: 10, color: '#334155', lineHeight: 20 },
  muted: { marginTop: 8, color: '#64748b', fontSize: 13 },
  rateLabel: { marginTop: 16, fontWeight: '700' },
  stars: { flexDirection: 'row', marginTop: 8, gap: 4 },
  starBtn: { padding: 4 },
  star: { fontSize: 32, color: '#cbd5e1' },
  starOn: { color: '#f59e0b' },
  input: {
    marginTop: 12,
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
  submitText: { color: '#fff', fontWeight: '700' },
  rating: { fontSize: 24, marginTop: 8, color: '#f59e0b' },
});
