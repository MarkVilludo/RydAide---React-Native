import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getApiErrorMessage } from '../../api/client';
import { resendVerificationEmail } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';

export function VerifyEmailScreen() {
  const { user, signOut, refreshUser } = useAuth();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);

  const onResend = async () => {
    setSending(true);
    try {
      await resendVerificationEmail();
      Alert.alert('Email sent', 'Open the verification link we sent to your inbox, then tap “I verified my email”.');
    } catch (error) {
      Alert.alert('Could not send', getApiErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const onCheckVerified = useCallback(async () => {
    setChecking(true);
    try {
      const current = await refreshUser();
      if (current.email_verified_at) {
        Alert.alert('Verified', 'Your email is verified. Welcome to RydAid!');
      } else {
        Alert.alert('Not yet verified', 'Tap the link in your email first, then try again.');
      }
    } catch (error) {
      Alert.alert('Could not refresh', getApiErrorMessage(error));
    } finally {
      setChecking(false);
    }
  }, [refreshUser]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.body}>
        We sent a verification link to{'\n'}
        <Text style={styles.email}>{user?.email ?? 'your email'}</Text>
      </Text>
      <Text style={styles.hint}>
        Open the link on this device (or any browser), then return here and confirm.
      </Text>

      <Pressable style={styles.primaryButton} onPress={onCheckVerified} disabled={checking}>
        {checking ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>I verified my email</Text>
        )}
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={onResend} disabled={sending}>
        {sending ? (
          <ActivityIndicator color="#0284c7" />
        ) : (
          <Text style={styles.secondaryText}>Resend verification email</Text>
        )}
      </Pressable>

      <Pressable onPress={() => void signOut()} style={styles.signOutWrap}>
        <Text style={styles.signOut}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#f8fafc' },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', textAlign: 'center' },
  body: { textAlign: 'center', color: '#475569', marginTop: 16, lineHeight: 22 },
  email: { fontWeight: '600', color: '#0f172a' },
  hint: { textAlign: 'center', color: '#64748b', marginTop: 12, fontSize: 14, lineHeight: 20 },
  primaryButton: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondaryButton: {
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#0284c7',
    backgroundColor: '#fff',
  },
  secondaryText: { color: '#0284c7', fontWeight: '600' },
  signOutWrap: { marginTop: 28 },
  signOut: { textAlign: 'center', color: '#64748b' },
});
