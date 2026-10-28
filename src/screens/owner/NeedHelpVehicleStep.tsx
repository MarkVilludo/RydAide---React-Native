import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  value: string;
  onChange: (text: string) => void;
};

/** Free-text vehicle info for help requests (no saved garage list). */
export function NeedHelpVehicleStep({ value, onChange }: Props) {
  return (
    <View>
      <Text style={styles.title}>Which vehicle needs help?</Text>
      <Text style={styles.hint}>
        Type make, model, color, or plate so the mechanic knows what to look for.
      </Text>
      <Text style={styles.label}>Vehicle description</Text>
      <TextInput
        style={styles.input}
        multiline
        placeholder="e.g. Honda Click 125, white · plate ABC 1234"
        value={value}
        onChangeText={onChange}
        maxLength={255}
      />
      <Text style={styles.charCount}>{value.length}/255</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  hint: { fontSize: 14, color: '#64748b', lineHeight: 20, marginBottom: 16 },
  label: { fontWeight: '600', marginBottom: 8 },
  charCount: { marginTop: 6, fontSize: 12, color: '#94a3b8', textAlign: 'right' },
  input: {
    minHeight: 100,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    textAlignVertical: 'top',
  },
});
