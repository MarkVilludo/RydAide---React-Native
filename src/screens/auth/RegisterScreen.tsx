import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiErrorMessage } from '../../api/client';
import { BrandLogo } from '../../components/BrandLogo';
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
        <Text style={styles.title}>Create account</Text>
        {requireVerification ? (
          <Text style={styles.subtitle}>
            We will email you a verification link before you can use the app.
          </Text>
        ) : null}

        <View style={styles.roleRow}>
          <Pressable
            style={[styles.roleChip, role === 'owner' && styles.roleChipActive]}
            onPress={() => setRole('owner')}
          >
            <Text style={role === 'owner' ? styles.roleTextActive : styles.roleText}>Owner</Text>
          </Pressable>
          <Pressable
            style={[styles.roleChip, role === 'mechanic' && styles.roleChipActive]}
            onPress={() => setRole('mechanic')}
          >
            <Text style={role === 'mechanic' ? styles.roleTextActive : styles.roleText}>Mechanic</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Full name"
          placeholderTextColor="#94a3b8"
          value={name}
          onChangeText={setName}
          returnKeyType="next"
          onLayout={(e) => {
            fieldOffsetY.current.name = e.nativeEvent.layout.y;
          }}
          onFocus={() => scrollFieldIntoView('name')}
          onBlur={() => {
            if (focusedField.current === 'name') focusedField.current = null;
          }}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
          returnKeyType="next"
          onLayout={(e) => {
            fieldOffsetY.current.email = e.nativeEvent.layout.y;
          }}
          onFocus={() => scrollFieldIntoView('email')}
          onBlur={() => {
            if (focusedField.current === 'email') focusedField.current = null;
          }}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          value={password}
          onChangeText={setPassword}
          returnKeyType="next"
          onLayout={(e) => {
            fieldOffsetY.current.password = e.nativeEvent.layout.y;
          }}
          onFocus={() => scrollFieldIntoView('password')}
          onBlur={() => {
            if (focusedField.current === 'password') focusedField.current = null;
          }}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          value={confirm}
          onChangeText={setConfirm}
          returnKeyType="done"
          onLayout={(e) => {
            fieldOffsetY.current.confirm = e.nativeEvent.layout.y;
          }}
          onFocus={() => scrollFieldIntoView('confirm')}
          onBlur={() => {
            if (focusedField.current === 'confirm') focusedField.current = null;
          }}
          onSubmitEditing={() => void onSubmit()}
        />

        <Pressable style={styles.primaryButton} onPress={onSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>Register</Text>
          )}
        </Pressable>

        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Back to sign in</Text>
        </Pressable>
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f8fafc' },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  form: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  logo: { marginBottom: 12, alignSelf: 'center' },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    color: '#0f172a',
    textAlign: 'center',
  },
  subtitle: {
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 20,
    textAlign: 'center',
  },
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  roleChip: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  roleChipActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  roleText: { color: '#334155' },
  roleTextActive: { color: '#fff', fontWeight: '600' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    color: '#0f172a',
  },
  primaryButton: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryText: { color: '#fff', fontWeight: '600' },
  link: { color: '#0284c7', textAlign: 'center', marginTop: 20, marginBottom: 12 },
});
