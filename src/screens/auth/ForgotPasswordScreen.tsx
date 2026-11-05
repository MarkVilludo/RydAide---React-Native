import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApiErrorMessage } from '../../api/client';
import { requestPasswordReset } from '../../api/auth';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Email required', 'Enter the email you used for RydAid.');
      return;
    }
    setSubmitting(true);
    try {
      await requestPasswordReset(trimmed);
      Alert.alert(
        'Check your email',
        'If an account exists for that address, we sent reset instructions. You can reset in the email link or enter the token on the next screen.',
        [
          {
            text: 'Enter reset code',
            onPress: () => navigation.navigate('ResetPassword', { email: trimmed }),
          },
          { text: 'OK', style: 'cancel' },
        ],
      );
    } catch (error) {
      Alert.alert('Request failed', getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot password</Text>
      <Text style={styles.subtitle}>We will email you a link and reset token.</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <Pressable style={styles.primaryButton} onPress={onSubmit} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>Send reset email</Text>
        )}
      </Pressable>

      <Pressable onPress={() => navigation.navigate('ResetPassword', { email: email.trim() || undefined })}>
        <Text style={styles.link}>I have a reset token</Text>
      </Pressable>

      <Pressable onPress={() => navigation.goBack()}>
        <Text style={styles.linkMuted}>Back to sign in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#f8fafc' },
  title: { fontSize: 24, fontWeight: '600', color: '#0f172a' },
  subtitle: { color: '#64748b', marginBottom: 20, marginTop: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryText: { color: '#fff', fontWeight: '600' },
  link: { color: '#0284c7', textAlign: 'center', marginTop: 20 },
  linkMuted: { color: '#64748b', textAlign: 'center', marginTop: 16 },
});
