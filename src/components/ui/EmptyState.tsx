import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing, type } from '../../theme/tokens';
import { Button } from './Button';

type Props = {
  title: string;
  message?: string;
  /** Icon element (DrawerIcon) or a single emoji. */
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** "Nothing here yet" block: icon, title, one line of guidance and an optional next step. */
export function EmptyState({ title, message, icon, actionLabel, onAction, secondaryLabel, onSecondary, style }: Props) {
  return (
    <View style={[styles.wrap, style]} accessibilityRole="summary">
      {icon ? (
        <View style={styles.icon}>{typeof icon === 'string' ? <Text style={styles.emoji}>{icon}</Text> : icon}</View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} style={styles.action} /> : null}
      {secondaryLabel && onSecondary ? <Button title={secondaryLabel} variant="text" onPress={onSecondary} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xxl },
  icon: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md + 2,
  },
  emoji: { fontSize: 32 },
  title: { ...type.heading, fontSize: 18, textAlign: 'center' },
  message: { ...type.body, color: colors.muted, textAlign: 'center', marginTop: spacing.xs + 2 },
  action: { marginTop: spacing.lg, alignSelf: 'stretch' },
});
