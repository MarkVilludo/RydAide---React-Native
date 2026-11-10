import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  message: string;
  secondsLeft: number;
  onUndo: () => void;
};

export function PendingJobStatusBanner({ message, secondsLeft, onUndo }: Props) {
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={styles.textBlock}>
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.countdown}>Updating in {secondsLeft}s…</Text>
      </View>
      <Pressable style={styles.undoBtn} onPress={onUndo} accessibilityRole="button">
        <Text style={styles.undoText}>Undo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  textBlock: { flex: 1 },
  message: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  countdown: { fontSize: 12, color: '#0369a1', marginTop: 2, fontWeight: '600' },
  undoBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#0284c7',
  },
  undoText: { color: '#0284c7', fontWeight: '800', fontSize: 13 },
});
