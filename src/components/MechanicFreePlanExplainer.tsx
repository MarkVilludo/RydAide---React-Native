import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';

type Props = {
  freeTotal: number | null;
  freeLeft: number | null;
  limitsOff: boolean;
  onViewPlans?: () => void;
};

/** Plain-language free vs Pro — dashboard + subscription context. */
export function MechanicFreePlanExplainer({ freeTotal, freeLeft, limitsOff, onViewPlans }: Props) {
  const bullets = [
    limitsOff
      ? 'The server isn’t counting free credits right now — accepts are unlimited until limits turn on.'
      : freeTotal != null
        ? `Free plan includes ${freeTotal} accepted request${freeTotal === 1 ? '' : 's'}, one time (they don’t reset each month).`
        : 'The free plan limits how many requests you can accept.',
    'You can still see and decline offers without Pro.',
    'Mechanic Pro removes the accept limit — browse incoming jobs and accept as many as you want.',
  ];

  return (
    <View style={styles.box} accessibilityRole="summary">
      <Text style={styles.title}>How free requests work</Text>
      {freeLeft != null && freeTotal != null && !limitsOff ? (
        <Text style={styles.meterLabel}>
          {freeLeft} of {freeTotal} free accept{freeTotal === 1 ? '' : 's'} remaining
        </Text>
      ) : null}
      {bullets.map((line) => (
        <Text key={line} style={styles.bullet}>
          {'• '}
          {line}
        </Text>
      ))}
      {onViewPlans ? (
        <Pressable style={styles.btn} onPress={onViewPlans} accessibilityRole="button">
          <Text style={styles.btnText}>Compare free vs Pro</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  meterLabel: { fontSize: 13, fontWeight: '700', color: colors.primaryInk, marginBottom: spacing.xs },
  bullet: { fontSize: 13, lineHeight: 19, color: colors.muted },
  btn: { alignSelf: 'flex-start', marginTop: spacing.sm, paddingVertical: 8, paddingHorizontal: spacing.md },
  btnText: { fontSize: 14, fontWeight: '800', color: colors.primary },
});