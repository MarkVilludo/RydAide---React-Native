import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextInputInstance,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiErrorMessage } from '../../api/client';
import { BrandLogo } from '../../components/BrandLogo';
import { Button, TextField } from '../../components/ui';
import { colors, radii, spacing, touch, type as typeScale } from '../../theme/tokens';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from '../../components/KeyboardAwareScrollView';
import { useAuth } from '../../context/AuthContext';
import { useAppConfig } from '../../hooks/useAppConfig';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

/** Extra space under the form so lower fields (confirm password) can scroll above the keyboard. */
const KEYBOARD_SCROLL_PAD = Platform.OS === 'android' ? 280 : 260;

export function RegisterScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const { config } = useAppConfig();
  const insets = useSafeAreaInsets();
  const requireVerification = config?.auth?.require_email_verification !== false;
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const formOffsetY = useRef(0);
  const fieldOffsetY = useRef<Record<string, number>>({});
  const focusedField = useRef<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<'owner' | 'mechanic'>('owner');
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);

  const minContentHeight = useMemo(() => {
    const windowHeight = Dimensions.get('window').height;
    return Math.max(480, windowHeight - insets.top - insets.bottom);
  }, [insets.bottom, insets.top]);

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
      Alert.alert('Registration failed', getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      ref={scrollRef}
      keyboardMode="scroll"
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        {
          minHeight: minContentHeight,
          paddingTop: Math.max(16, insets.top + 8),
          paddingBottom: Math.max(24, insets.bottom + 16) + KEYBOARD_SCROLL_PAD,
        },
      ]}
      extraBottomPadding={KEYBOARD_SCROLL_PAD}
    >
      <View
        style={styles.form}
        onLayout={(e) => {
          formOffsetY.current = e.nativeEvent.layout.y;
        }}
      >
        <BrandLogo width={176} style={styles.logo} />
        <Text style={styles.title} accessibilityRole="header">
          Create account
        </Text>
        {requireVerification ? (
          <Text style={styles.subtitle}>
            We will email you a verification link before you can use the app.
          </Text>
        ) : null}

        <Text style={styles.roleLabel}>I am a…</Text>
        <View style={styles.roleRow} accessibilityRole="radiogroup">
          {(
            [
              ['owner', 'Vehicle owner', 'I need help with my vehicle'],
              ['mechanic', 'Mechanic', 'I fix vehicles'],
            ] as const
          ).map(([value, label, sub]) => {
            const on = role === value;
            return (
              <Pressable
                key={value}
                style={[styles.roleChip, on && styles.roleChipActive]}
                onPress={() => setRole(value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${label}. ${sub}`}
              >
                <Text style={[styles.roleText, on && styles.roleTextActive]}>{label}</Text>
                <Text style={[styles.roleSub, on && styles.roleSubActive]}>{sub}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextField
          label="Full name"
          placeholder="e.g. Juan Dela Cruz"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          value={name}
          onChangeText={setName}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
          onContainerLayout={(e) => {
            fieldOffsetY.current.name = e.nativeEvent.layout.y;
          }}
          onFocus={() => scrollFieldIntoView('name')}
          onBlur={() => {
            if (focusedField.current === 'name') focusedField.current = null;
          }}
        />
        <TextField
          ref={emailRef}
          label="Email"
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          onContainerLayout={(e) => {
            fieldOffsetY.current.email = e.nativeEvent.layout.y;
          }}
          onFocus={() => scrollFieldIntoView('email')}
          onBlur={() => {
            if (focusedField.current === 'email') focusedField.current = null;
          }}
        />
        <TextField
          ref={passwordRef}
          label="Password"
          placeholder="At least 8 characters"
          secureTextEntry
          revealable
          autoComplete="new-password"
          textContentType="newPassword"
          value={password}
          onChangeText={setPassword}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => confirmRef.current?.focus()}
          onContainerLayout={(e) => {
            fieldOffsetY.current.password = e.nativeEvent.layout.y;
          }}
          onFocus={() => scrollFieldIntoView('password')}
          onBlur={() => {
            if (focusedField.current === 'password') focusedField.current = null;
          }}
        />
        <TextField
          ref={confirmRef}
          label="Confirm password"
          placeholder="Type it again"
          secureTextEntry
          revealable
          autoComplete="new-password"
          textContentType="newPassword"
          value={confirm}
          onChangeText={setConfirm}
          error={confirm.length > 0 && password.length > 0 && confirm.length >= password.length && confirm !== password ? 'Passwords don’t match.' : null}
          returnKeyType="go"
          onSubmitEditing={() => void onSubmit()}
          onContainerLayout={(e) => {
            fieldOffsetY.current.confirm = e.nativeEvent.layout.y;
          }}
          onFocus={() => scrollFieldIntoView('confirm')}
          onBlur={() => {
            if (focusedField.current === 'confirm') focusedField.current = null;
          }}
        />

        <Button title="Create account" size="large" loading={submitting} onPress={() => void onSubmit()} style={styles.primaryButton} />

        <Button title="Back to sign in" variant="text" onPress={() => navigation.goBack()} style={styles.link} />
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  form: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  logo: { marginBottom: spacing.md, alignSelf: 'center' },
  title: { ...typeScale.display, marginBottom: spacing.sm, textAlign: 'center' },
  subtitle: { ...typeScale.body, color: colors.muted, marginBottom: spacing.lg, textAlign: 'center' },
  roleLabel: { ...typeScale.label, marginBottom: spacing.xs + 2 },
  roleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  roleChip: {
    flex: 1,
    minHeight: touch.large + 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  roleChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  roleText: { fontSize: 15, fontWeight: '700', color: colors.text },
  roleTextActive: { color: colors.primaryInk },
  roleSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  roleSubActive: { color: colors.primaryInk },
  primaryButton: { marginTop: spacing.sm },
  link: { marginTop: spacing.md, marginBottom: spacing.md },
});
