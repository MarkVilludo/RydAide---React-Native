import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, elevation, radii, spacing, type } from '../../theme/tokens';

type Props = {
  title?: string;
  subtitle?: string;
  /** Right side of the header row (e.g. a text Button). */
  action?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Remove inner padding (lists that draw their own rows). */
  flush?: boolean;
};

/** White rounded card with an optional header — the standard grouping surface. */
export function SectionCard({ title, subtitle, action, children, style, flush }: Props) {
  return (
    <View style={[styles.card, style]}>
      {title || action ? (
        <View style={styles.head}>
          <View style={styles.headText}>
            {title ? (
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
            ) : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {action}
        </View>
      ) : null}
      <View style={flush ? undefined : styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...elevation.card,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md + 2,
  },
  headText: { flex: 1 },
  title: type.heading,
  subtitle: { ...type.caption, marginTop: 2 },
  body: { padding: spacing.lg, paddingTop: spacing.md },
});
