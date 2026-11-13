import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, radii, spacing, touch, type } from '../../theme/tokens';
import { DrawerIcon, type DrawerIconName } from '../DrawerIcons';

type Props = TextInputProps & {
  label?: string;
  /** Marks the label with a red asterisk. */
  required?: boolean;
  /** "(optional)" after the label. */
  optional?: boolean;
  helper?: string | null;
  error?: string | null;
  /** Password fields get a Show/Hide toggle. */
  revealable?: boolean;
  /** Icon inside the field, on the left (DrawerIcons name). */
  leadingIcon?: DrawerIconName;
  /** 'large' = 52 dp (auth forms); default 48 dp. */
  size?: 'default' | 'large';
  /** Right side of the label row (e.g. "Forgot password?"). */
  labelAccessory?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  /** Layout of the whole field (label included) — use for scroll-to-field. */
  onContainerLayout?: (e: LayoutChangeEvent) => void;
};

/**
 * Shared text input: visible label, helper, inline error, 48px height, focus ring.
 * Forward the ref (useRef<TextInputInstance>) to chain fields: returnKeyType="next" + onSubmitEditing={() => next.current?.focus()}.
 */
export const TextField = forwardRef<TextInputInstance, Props>(function TextField(
  {
    label,
    required,
    optional,
    helper,
    error,
    revealable,
    labelAccessory,
    leadingIcon,
    size = 'default',
    secureTextEntry,
    containerStyle,
    onContainerLayout,
    style,
    onFocus,
    onBlur,
    editable = true,
    multiline,
    ...rest
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const hidden = !!secureTextEntry && !revealed;
  return (
    <View style={[styles.wrap, containerStyle]} onLayout={onContainerLayout}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label} nativeID={rest.nativeID ? `${rest.nativeID}-label` : undefined}>
            {label}
            {required ? <Text style={styles.req}> *</Text> : null}
            {optional ? <Text style={styles.opt}> (optional)</Text> : null}
          </Text>
          {labelAccessory}
        </View>
      ) : null}
      <View
        style={[
          styles.box,
          size === 'large' && styles.boxLarge,
          multiline && styles.boxMultiline,
          focused && styles.boxFocused,
          !!error && styles.boxError,
          !editable && styles.boxDisabled,
        ]}
      >
        {leadingIcon ? (
          <View style={styles.lead}>
            <DrawerIcon name={leadingIcon} size={20} color={error ? colors.danger : focused ? colors.primary : colors.mutedSoft} />
          </View>
        ) : null}
        <TextInput
          ref={ref}
          style={[styles.input, size === 'large' && styles.inputLarge, !!leadingIcon && styles.inputWithIcon, multiline && styles.inputMultiline, style]}
          placeholderTextColor={colors.mutedSoft}
          secureTextEntry={hidden}
          editable={editable}
          multiline={multiline}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          accessibilityHint={error ?? helper ?? undefined}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {revealable && secureTextEntry ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            style={styles.reveal}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          >
            <DrawerIcon name={revealed ? 'eyeOff' : 'eye'} size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs + 2 },
  label: { ...type.label, flexShrink: 1 },
  req: { color: colors.danger },
  opt: { color: colors.mutedSoft, fontWeight: '600' },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touch.control,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: radii.md,
  },
  boxLarge: { minHeight: touch.large },
  boxMultiline: { alignItems: 'flex-start' },
  lead: { width: 24, height: 24, marginLeft: spacing.md, alignItems: 'center', justifyContent: 'center' },
  inputLarge: { minHeight: touch.large - 2 },
  inputWithIcon: { paddingLeft: spacing.sm + 2 },
  boxFocused: { borderColor: colors.primary, borderWidth: 1.5 },
  boxError: { borderColor: colors.danger, borderWidth: 1.5 },
  boxDisabled: { backgroundColor: colors.surfaceMuted },
  input: {
    flex: 1,
    minHeight: touch.control - 2,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.text,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  reveal: { minHeight: touch.min, minWidth: touch.min + 12, alignItems: 'center', justifyContent: 'center' },
  helper: { ...type.caption, marginTop: spacing.xs + 2 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600', marginTop: spacing.xs + 2, lineHeight: 18 },
});
