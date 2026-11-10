import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DirectorySearchMeta } from '../api/appConfig';

type Props = {
  kind: 'mechanic' | 'shop';
  emergencyAssistanceEnabled: boolean;
  searchMeta: DirectorySearchMeta | null;
  onWidenRadius?: (km: number) => void;
  onRequestHelp?: () => void;
};

export function DirectorySearchEmptyState({
  kind,
  emergencyAssistanceEnabled,
  searchMeta,
  onWidenRadius,
  onRequestHelp,
}: Props) {
  const label = kind === 'mechanic' ? 'mechanics' : 'shops';
  const canWiden =
    searchMeta != null &&
    searchMeta.recommended_radius_km > searchMeta.applied_radius_km;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>No verified {label} here yet</Text>
      <Text style={styles.body}>
        Increase the search radius or drag the map pin to another spot, then wait a moment for results
        to refresh.
      </Text>
      {canWiden && onWidenRadius ? (
        <Pressable
          style={styles.action}
          onPress={() => onWidenRadius(searchMeta!.recommended_radius_km)}
        >
          <Text style={styles.actionText}>Widen to {searchMeta!.recommended_radius_km} km</Text>
        </Pressable>
      ) : null}
      {kind === 'mechanic' && emergencyAssistanceEnabled && onRequestHelp ? (
        <Pressable style={styles.secondaryAction} onPress={onRequestHelp}>
          <Text style={styles.secondaryActionText}>Request roadside help instead</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, paddingHorizontal: 8 },
  title: { textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#0f172a' },
  body: { textAlign: 'center', color: '#64748b', lineHeight: 20, marginTop: 8 },
  action: {
    marginTop: 16,
    alignSelf: 'center',
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  secondaryAction: { marginTop: 14, alignSelf: 'center', paddingVertical: 8 },
  secondaryActionText: { color: '#0284c7', fontWeight: '600', fontSize: 14 },
});
