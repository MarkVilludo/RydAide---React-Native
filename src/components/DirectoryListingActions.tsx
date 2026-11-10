import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { openDirections, openPhoneCall } from '../utils/mapsLinks';

type Props = {
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export function DirectoryListingActions({ phone, latitude, longitude }: Props) {
  const canCall = Boolean(phone?.trim());
  const canDirections = latitude != null && longitude != null;
  if (!canCall && !canDirections) return null;

  return (
    <View style={styles.row}>
      {canCall ? (
        <Pressable
          style={styles.primaryBtn}
          onPress={() => openPhoneCall(phone!)}
          accessibilityRole="button"
          accessibilityLabel="Call shop"
        >
          <Text style={styles.primaryText}>Call</Text>
        </Pressable>
      ) : null}
      {canDirections ? (
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => openDirections(latitude!, longitude!)}
          accessibilityRole="button"
          accessibilityLabel="Get directions"
        >
          <Text style={styles.secondaryText}>Directions</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginTop: 12 },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  secondaryText: { color: '#0f172a', fontWeight: '700', fontSize: 15 },
});
