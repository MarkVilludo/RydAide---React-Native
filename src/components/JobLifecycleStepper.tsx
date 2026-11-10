import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const STEPS: { key: string; label: string }[] = [
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'ON_THE_WAY', label: 'On the way' },
  { key: 'ARRIVED', label: 'Arrived' },
  { key: 'IN_PROGRESS', label: 'Working' },
  { key: 'COMPLETED', label: 'Done' },
];

function stepIndex(status: string): number {
  const i = STEPS.findIndex((s) => s.key === status);
  return i >= 0 ? i : 0;
}

type Props = {
  currentStatus: string;
};

export function JobLifecycleStepper({ currentStatus }: Props) {
  const currentIdx = stepIndex(currentStatus);
  const allDone = currentStatus === 'COMPLETED';

  return (
    <View style={styles.wrap} accessibilityRole="summary" accessibilityLabel="Job progress">
      <View style={styles.trackRow}>
        {STEPS.map((step, idx) => {
          const done = allDone || idx < currentIdx;
          const current = !allDone && idx === currentIdx;
          return (
            <React.Fragment key={step.key}>
              {idx > 0 ? (
                <View style={[styles.connector, (done || current) && styles.connectorDone]} />
              ) : null}
              <View style={styles.stepCol}>
                <View style={[styles.dot, done && styles.dotDone, current && styles.dotActive]}>
                  {done ? (
                    <Text style={styles.check}>✓</Text>
                  ) : (
                    <Text style={[styles.dotNum, current && styles.dotNumActive]}>{idx + 1}</Text>
                  )}
                </View>
                <Text style={[styles.label, (done || current) && styles.labelActive]} numberOfLines={2}>
                  {step.label}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, marginBottom: 4 },
  trackRow: { flexDirection: 'row', alignItems: 'flex-start' },
  stepCol: { flex: 1, alignItems: 'center', minWidth: 0 },
  connector: {
    flex: 0.35,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginTop: 13,
    marginHorizontal: -2,
  },
  connectorDone: { backgroundColor: '#16a34a' },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: '#dcfce7', borderColor: '#16a34a' },
  dotActive: { backgroundColor: '#0284c7', borderColor: '#0369a1' },
  dotNum: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  dotNumActive: { color: '#fff' },
  check: { fontSize: 12, fontWeight: '800', color: '#16a34a' },
  label: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: '600',
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 12,
  },
  labelActive: { color: '#334155', fontWeight: '700' },
});
