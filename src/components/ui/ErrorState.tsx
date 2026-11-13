import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing, type } from '../../theme/tokens';
import { Button } from './Button';

type Props = {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
  /** 'screen' = centred full block; 'inline' = compact red box inside a page. */
  variant?: 'screen' | 'inline';
  style?: StyleProp<ViewStyle>;
};

/** Load failure with a retry. Use 'inline' inside lists/cards, 'screen' when nothing else can show. */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
  retrying,
  variant = 'screen',
  style,
}: Props) {
  if (variant === 'inline') {
    return (
      <View style={[styles.inline, style]} accessibilityRole="alert">
        <Text style={styles.inlineTitle}>{title}</Text>
        {message ? <Text style={styles.inlineMsg}>{message}</Text> : null}
        {onRetry ? (
          <Button title={retryLabel} variant="secondary" block={false} loading={retrying} onPress={onRetry} style={styles.inlineBtn} />
        ) : null}
      </View>
    );
  }
  return (
    <View style={[styles.screen, style]} accessibilityRole="alert">
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {onRetry ? <Button title={retryLabel} loading={retrying} onPress={onRetry} style={styles.btn} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, backgroundColor: colors.bg },
  title: { ...type.heading, fontSize: 18, textAlign: 'center' },
  message: { ...type.body, color: colors.muted, textAlign: 'center', marginTop: spacing.xs + 2 },
  btn: { marginTop: spacing.lg, alignSelf: 'stretch' },
  inline: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    marginBottom: spacing.md,
  },
  inlineTitle: { fontSize: 15, fontWeight: '700', color: colors.dangerInk },
  inlineMsg: { fontSize: 14, color: colors.dangerInk, marginTop: 2, lineHeight: 20 },
  inlineBtn: { alignSelf: 'flex-start', marginTop: spacing.sm, borderColor: colors.dangerInk },
});
