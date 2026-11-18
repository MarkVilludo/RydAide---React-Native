import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SupportHelpFooter } from '../SupportHelpFooter';
import { colors, radii, spacing } from '../../theme/tokens';

type Props = {
  visible: boolean;
  onRetry: () => void;
  retrying?: boolean;
};

/** Shown above the login form when /app-config (or the API) is unreachable. */
export function AuthConnectivityBanner({ visible, onRetry, retrying }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.box} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={styles.title}>Can't reach RydAid servers</Text>
      <Text style={styles.body}>
        Check your internet connection. Sign-in and Google may not work until the app can reach the API.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.retryBtn, pressed && styles.retryPressed]}
        onPress={onRetry}
        disabled={retrying}
        accessibilityRole="button"
        accessibilityLabel="Retry connection"
      >
        {retrying ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.retryText}>Retry connection</Text>
        )}
      </Pressable>
      <SupportHelpFooter problemCategory="Account / login" problemHint="I can't reach the RydAid API when signing in." />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.warnSoft,
    borderWidth: 1,
    borderColor: colors.warnBorder,
    gap: spacing.xs,
  },
  title: { fontSize: 15, fontWeight: '800', color: colors.warnInk },
  body: { fontSize: 13, lineHeight: 18, color: colors.warnInk },
  retryBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.warnBorder,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryPressed: { opacity: 0.85 },
  retryText: { fontSize: 14, fontWeight: '700', color: colors.primary },
});