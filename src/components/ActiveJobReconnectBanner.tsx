import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SupportHelpFooter } from './SupportHelpFooter';
import { colors, radii, spacing } from '../theme/tokens';

type Props = {
  onRetry: () => void;
  retrying?: boolean;
};

/** Inline banner on live job screens when polling fails. */
export function ActiveJobReconnectBanner({ onRetry, retrying }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <View style={styles.box}>
        <View style={styles.textCol}>
          <Text style={styles.title}>Connection lost</Text>
          <Text style={styles.body}>Live updates paused. Map and status may be outdated until we reconnect.</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          onPress={onRetry}
          disabled={retrying}
          accessibilityRole="button"
          accessibilityLabel="Refresh now"
        >
          {retrying ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Text style={styles.btnText}>Refresh</Text>}
        </Pressable>
      </View>
      <SupportHelpFooter
        problemCategory="Help request / job issue"
        problemHint="Live job screen lost connection and refresh did not recover."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.warnSoft,
    borderWidth: 1,
    borderColor: colors.warnBorder,
  },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '800', color: colors.warnInk },
  body: { fontSize: 12, lineHeight: 17, color: colors.warnInk, marginTop: 2 },
  btn: {
    minHeight: 36,
    minWidth: 76,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: { opacity: 0.88 },
  btnText: { fontSize: 13, fontWeight: '800', color: colors.onPrimary },
});