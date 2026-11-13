import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radii, spacing, touch, type } from '../../theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'text';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  variant?: ButtonVariant;
  /** Shows a spinner, keeps the width, and blocks presses. */
  loading?: boolean;
  /** 'large' = 52px (main screen CTA); default 48px. */
  size?: 'default' | 'large';
  /** Optional leading icon (e.g. a DrawerIcon). */
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Stretch to the parent width (default true except for text buttons). */
  block?: boolean;
};

const SPINNER: Record<ButtonVariant, string> = {
  primary: colors.onPrimary,
  secondary: colors.primary,
  danger: colors.onPrimary,
  text: colors.primary,
};

/** Shared button: primary, secondary (outline), danger, text. Min 48px tall, loading state built in. */
export function Button({
  title,
  variant = 'primary',
  loading = false,
  size = 'default',
  icon,
  style,
  block,
  disabled,
  accessibilityLabel,
  ...rest
}: Props) {
  const isDisabled = disabled || loading;
  const stretch = block ?? variant !== 'text';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === 'large' && styles.large,
        styles[variant],
        !stretch && styles.inline,
        pressed && !isDisabled && (variant === 'text' ? styles.textPressed : styles.pressed),
        isDisabled && !loading && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={SPINNER[variant]} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={[styles.label, styles[`${variant}Text`]]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touch.control,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    alignSelf: 'stretch',
  },
  large: { minHeight: touch.large, borderRadius: 14 },
  inline: { alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { ...type.button, textAlign: 'center' },
  primary: { backgroundColor: colors.primary },
  primaryText: { color: colors.onPrimary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary },
  secondaryText: { color: colors.primary },
  danger: { backgroundColor: colors.danger },
  dangerText: { color: colors.onPrimary },
  text: { backgroundColor: 'transparent', minHeight: touch.min, paddingHorizontal: spacing.md },
  textText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.85 },
  textPressed: { opacity: 0.6 },
  disabled: { opacity: 0.5 },
});
