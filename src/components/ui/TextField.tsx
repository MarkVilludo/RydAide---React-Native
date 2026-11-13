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
        <Text style={styles.label} nativeID={rest.nativeID ? `${rest.nativeID}-label` : undefined}>
          {label}
          {required ? <Text style={styles.req}> *</Text> : null}
          {optional ? <Text style={styles.opt}> (optional)</Text> : null}
        </Text>
      ) : null}
      <View
        style={[
          styles.box,
          multiline && styles.boxMultiline,
          focused && styles.boxFocused,
          !!error && styles.boxError,
          !editable && styles.boxDisabled,
        ]}
      >
        <TextInput
          ref={ref}
          style={[styles.input, multiline && styles.inputMultiline, style]}
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
            <Text style={styles.revealText}>{revealed ? 'Hide' : 'Show'}</Text>
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
  label: { ...type.label, marginBottom: spacing.xs + 2 },
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
  boxMultiline: { alignItems: 'flex-start' },
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
  revealText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  helper: { ...type.caption, marginTop: spacing.xs + 2 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '600', marginTop: spacing.xs + 2, lineHeight: 18 },
});
