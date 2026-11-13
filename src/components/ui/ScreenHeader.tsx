import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing, type } from '../../theme/tokens';

type Props = {
  title: string;
  subtitle?: string;
  /** Small uppercase line above the title. */
  eyebrow?: string;
  /** Right-aligned element (e.g. a text Button). */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  align?: 'left' | 'center';
};

/** In-page title block for screens without a native header title (auth, dashboards, lists). */
export function ScreenHeader({ title, subtitle, eyebrow, right, style, align = 'left' }: Props) {
  const center = align === 'center';
  return (
    <View style={[styles.row, style]}>
      <View style={styles.text}>
        {eyebrow ? <Text style={[styles.eyebrow, center && styles.center]}>{eyebrow}</Text> : null}
        <Text style={[styles.title, center && styles.center]} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={[styles.subtitle, center && styles.center]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg },
  text: { flex: 1 },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryInk,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  title: type.display,
  subtitle: { ...type.body, color: colors.muted, marginTop: spacing.xs + 2 },
  center: { textAlign: 'center' },
});
