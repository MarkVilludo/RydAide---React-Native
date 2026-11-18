import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';
import { statusBarTopInset } from '../utils/screenInsets';
import { isImplausibleNavigationDistance } from '../utils/mapNavigationCamera';

type Props = {
  visible: boolean;
  hasDrivingRoute: boolean;
  distanceKm?: number | null;
};

export function MechanicInAppNavigateHint({ visible, hasDrivingRoute, distanceKm }: Props) {
  if (!visible) {
    return null;
  }

  const gpsMismatch = isImplausibleNavigationDistance(distanceKm);

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Text style={styles.title}>{gpsMismatch ? 'Customer location' : 'In-app navigation'}</Text>
      <Text style={styles.body} numberOfLines={3}>
        {gpsMismatch
          ? 'Map zoomed to the customer. Your device GPS looks far from this job — set emulator location near the job to test driving routes.'
          : hasDrivingRoute
            ? 'Follow the blue route. The map stays zoomed for turn-by-turn style guidance in RydAid.'
            : 'Map zoomed on the customer. Your position updates here while you head to the pin.'}
      </Text>
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