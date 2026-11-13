import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform, Pressable, StyleSheet, Text, View, type TextInputInstance } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApiErrorMessage } from '../../api/client';
import { AuthErrorBanner } from '../../components/auth/AuthErrorBanner';
import { AuthLayout, authStyles } from '../../components/auth/AuthLayout';
import { authFieldErrors } from '../../components/auth/authErrors';
import type { KeyboardAwareScrollViewRef } from '../../components/KeyboardAwareScrollView';
import { Button, TextField } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useAppConfig } from '../../hooks/useAppConfig';
import { colors, radii, spacing, touch } from '../../theme/tokens';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

/** Extra space under the form so lower fields (confirm password) can scroll above the keyboard. */
const KEYBOARD_SCROLL_PAD = Platform.OS === 'android' ? 280 : 260;

const ROLES = [
  {
    value: 'owner',
    icon: '🚗',
    label: 'Vehicle owner',
    sub: 'I need help with my vehicle',
    note: 'Request roadside help, book a service and pay your mechanic in the app.',
  },
  {
    value: 'mechanic',
    icon: '🔧',
    label: 'Mechanic',
    sub: 'I fix vehicles',
    note: 'Get nearby job requests. You’ll set up your mechanic listing after you sign up.',
  },
] as const;

export function RegisterScreen({ navigation, route }: Props) {
  const { signUp } = useAuth();
  const { config } = useAppConfig();
  const requireVerification = config?.auth?.require_email_verification !== false;
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);
  const formOffsetY = useRef(0);
  const fieldOffsetY = useRef<Record<string, number>>({});
  const focusedField = useRef<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<'owner' | 'mechanic'>(route.params?.role ?? 'owner');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const runScrollToField = (key: string) => {
    const fieldY = fieldOffsetY.current[key];
    if (typeof fieldY !== 'number') {
      scrollRef.current?.scrollToEnd({ animated: true });
      return;
    }
    // Android resize: window height is already the area above the keyboard.
    const visibleH = Dimensions.get('window').height;
    const fieldTop = formOffsetY.current + fieldY;
    // Keep the focused field in the upper portion of the visible area (above keypad).
    const targetY = fieldTop - Math.max(72, visibleH * 0.28);
    scrollRef.current?.scrollTo({ y: Math.max(0, targetY), animated: true });
  };

  const scrollFieldIntoView = (key: string) => {
    focusedField.current = key;
    // Retry after keyboard opens / window resizes so Confirm password stays visible.
    requestAnimationFrame(() => runScrollToField(key));
    setTimeout(() => runScrollToField(key), Platform.OS === 'android' ? 320 : 120);
    setTimeout(() => runScrollToField(key), Platform.OS === 'android' ? 520 : 280);
  };

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvent, () => {
      const key = focusedField.current;
      if (!key) return;
      setTimeout(() => runScrollToField(key), Platform.OS === 'android' ? 80 : 0);
    });
    return () => sub.remove();
  }, []);

  const onSubmit = async () => {
    if (submitting) return;
    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await signUp({
        name: name.trim(),
        email: email.trim(),
        password,
        password_confirmation: confirm,
        role,
      });
    } catch (error) {
      const fields = authFieldErrors(error);
      setFieldErrors(fields);
      setFormError(Object.keys(fields).length ? 'Please fix the highlighted fields.' : getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const clear = (key: string) => {
    if (fieldErrors[key]) setFieldErrors(({ [key]: _drop, ...rest }) => rest);
    if (formError) setFormError(null);
  };

  const fieldProps = (key: string) => ({
    onContainerLayout: (e: { nativeEvent: { layout: { y: number } } }) => {
      fieldOffsetY.current[key] = e.nativeEvent.layout.y;
    },
    onFocus: () => scrollFieldIntoView(key),
    onBlur: () => {
      if (focusedField.current === key) focusedField.current = null;
    },
  });

  const mismatch = confirm.length > 0 && confirm.length >= password.length && confirm !== password;
  const selected = ROLES.find((r) => r.value === role)!;

  return (
    <AuthLayout
      ref={scrollRef}
      onBack={() => navigation.goBack()}
      title="Create your account"
      subtitle={requireVerification ? 'We’ll email you a link to verify your account.' : undefined}
      onFormLayout={(y) => {
        formOffsetY.current = y;
      }}
      extraBottomPadding={KEYBOARD_SCROLL_PAD}
    >
      <AuthErrorBanner message={formError} />

      <View style={authStyles.fields}>
        <Text style={styles.roleLabel}>I am a…</Text>
        <View style={styles.roleRow} accessibilityRole="radiogroup">
          {ROLES.map((r) => {
            const on = role === r.value;
            return (
              <Pressable
                key={r.value}
                style={[styles.roleChip, on && styles.roleChipActive]}
                onPress={() => setRole(r.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${r.label}. ${r.sub}`}
              >
                <Text style={styles.roleIcon}>{r.icon}</Text>
                <Text style={[styles.roleText, on && styles.roleTextActive]}>{r.label}</Text>
                <Text style={[styles.roleSub, on && styles.roleSubActive]}>{r.sub}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.roleNote}>{selected.note}</Text>
        {fieldErrors.role ? <Text style={styles.roleError}>{fieldErrors.role}</Text> : null}

        <TextField
          size="large"
          leadingIcon="user"
          editable={!submitting}
          label="Full name"
          placeholder="e.g. Juan Dela Cruz"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          value={name}
          onChangeText={(t) => {
            setName(t);
            clear('name');
          }}
          error={fieldErrors.name}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
          {...fieldProps('name')}
        />
        <TextField
          ref={emailRef}
          size="large"
          leadingIcon="mail"
          editable={!submitting}
          label="Email"
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            clear('email');
          }}
          error={fieldErrors.email}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          {...fieldProps('email')}
        />
        <TextField
          ref={passwordRef}
          size="large"
          leadingIcon="lock"
          editable={!submitting}
          label="Password"
          placeholder="At least 8 characters"
          secureTextEntry
          revealable
          autoComplete="new-password"
          textContentType="newPassword"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            clear('password');
          }}
          error={fieldErrors.password}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => confirmRef.current?.focus()}
          {...fieldProps('password')}
        />
        <TextField
          ref={confirmRef}
          size="large"
          leadingIcon="lock"
          editable={!submitting}
          label="Confirm password"
          placeholder="Type it again"
          secureTextEntry
          revealable
          autoComplete="new-password"
          textContentType="newPassword"
          value={confirm}
          onChangeText={(t) => {
            setConfirm(t);
            clear('password_confirmation');
          }}
          error={mismatch ? 'Passwords don’t match.' : fieldErrors.password_confirmation}
          returnKeyType="go"
          onSubmitEditing={() => void onSubmit()}
          {...fieldProps('confirm')}
        />
      </View>

      <Button title="Create account" size="large" loading={submitting} onPress={() => void onSubmit()} style={authStyles.primary} />

      <View style={authStyles.linkRow}>
        <Text style={authStyles.linkRowText}>Already have an account?</Text>
        <Button title="Sign in" variant="text" onPress={() => navigation.goBack()} style={{ paddingHorizontal: spacing.xs + 2 }} />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  roleLabel: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: spacing.xs + 2 },
  roleRow: { flexDirection: 'row', gap: spacing.sm },
  roleChip: {
    flex: 1,
    minHeight: touch.large + 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  roleChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  roleIcon: { fontSize: 18 },
  roleText: { fontSize: 15, fontWeight: '800', color: colors.text },
  roleTextActive: { color: colors.primaryInk },
  roleSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  roleSubActive: { color: colors.primaryInk },
  roleNote: { fontSize: 13, color: colors.muted, lineHeight: 18, marginTop: spacing.sm, marginBottom: spacing.md },
  roleError: { color: colors.danger, fontSize: 13, fontWeight: '600', marginTop: -spacing.sm, marginBottom: spacing.md },
});
