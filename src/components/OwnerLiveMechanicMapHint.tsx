import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';
import { statusBarTopInset } from '../utils/screenInsets';

type Props = {
  /** Waiting for the mechanic's first GPS fix. */
  waitingForGps?: boolean;
  /** Mechanic pin is on the map — reinforce in-app tracking. */
  liveOnMap?: boolean;
  locationStatusLabel?: string | null;
};

export function OwnerLiveMechanicMapHint({
  waitingForGps,
  liveOnMap,
  locationStatusLabel,
}: Props) {
  if (!waitingForGps && !liveOnMap) {
    return null;
  }

  return (
    <View style={styles.wrap} pointerEvents="none" accessibilityRole="text">
      {waitingForGps ? (
        <>
          <Text style={styles.title}>Live map</Text>
          <Text style={styles.body} numberOfLines={2}>
            Your mechanic’s location will appear here as they travel — no need to open Google Maps.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.title}>Mechanic on the map</Text>
          <Text style={styles.body} numberOfLines={2}>
            {locationStatusLabel?.trim() || 'Live position updates in this map while they’re on the way.'}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: statusBarTopInset() + spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  title: { fontSize: 13, fontWeight: '800', color: colors.primaryInk },
  body: { marginTop: 2, fontSize: 12, lineHeight: 16, color: colors.muted, fontWeight: '600' },
});