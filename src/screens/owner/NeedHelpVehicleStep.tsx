import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VehicleSearchCombobox } from '../../components/VehicleSearchCombobox';

type Props = {
  value: string;
  onChange: (text: string) => void;
};

export function NeedHelpVehicleStep({ value, onChange }: Props) {
  return (
    <View>
      <Text style={styles.title}>Which vehicle needs help?</Text>
      <Text style={styles.hint}>
        Pick from the list or add your own make and model. Mechanics see this on your request.
      </Text>
      <VehicleSearchCombobox value={value} onChange={onChange} />
      <Text style={styles.charCount}>{value.trim().length}/255</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  hint: { fontSize: 14, color: '#64748b', lineHeight: 20, marginBottom: 16 },
  charCount: { marginTop: 8, fontSize: 12, color: '#94a3b8', textAlign: 'right' },
});
