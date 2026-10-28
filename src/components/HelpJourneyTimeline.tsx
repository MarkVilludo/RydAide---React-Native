import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { JourneyStep } from '../utils/helpJourney';

type Props = {
  steps: JourneyStep[];
  compact?: boolean;
};

export function HelpJourneyTimeline({ steps, compact }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, compact && styles.rowCompact]}
    >
      {steps.map((step, index) => (
        <View key={step.key} style={styles.stepWrap}>
          <View style={styles.stepInner}>
            <View
              style={[
                styles.dot,
                step.state === 'done' && styles.dotDone,
                step.state === 'active' && styles.dotActive,
                step.state === 'failed' && styles.dotFailed,
              ]}
            />
            <Text
              style={[
                styles.label,
                step.state === 'active' && styles.labelActive,
                step.state === 'failed' && styles.labelFailed,
              ]}
              numberOfLines={2}
            >
              {step.label}
            </Text>
          </View>
          {index < steps.length - 1 && (
            <View
              style={[
                styles.connector,
                step.state === 'done' ? styles.connectorDone : styles.connectorPending,
              ]}
            />
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center' },
  rowCompact: { paddingVertical: 4 },
  stepWrap: { flexDirection: 'row', alignItems: 'center' },
  stepInner: { alignItems: 'center', width: 88 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#cbd5e1',
    marginBottom: 6,
  },
  dotDone: { backgroundColor: '#16a34a' },
  dotActive: { backgroundColor: '#0284c7', transform: [{ scale: 1.15 }] },
  dotFailed: { backgroundColor: '#dc2626' },
  label: { fontSize: 11, color: '#64748b', textAlign: 'center', lineHeight: 14 },
  labelActive: { color: '#0284c7', fontWeight: '700' },
  labelFailed: { color: '#dc2626', fontWeight: '600' },
  connector: { width: 24, height: 2, marginBottom: 20 },
  connectorDone: { backgroundColor: '#16a34a' },
  connectorPending: { backgroundColor: '#e2e8f0' },
});
