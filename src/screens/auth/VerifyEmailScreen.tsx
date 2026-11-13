import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { getApiErrorMessage } from '../../api/client';
import { resendVerificationEmail } from '../../api/auth';
import { AuthLayout, authStyles } from '../../components/auth/AuthLayout';
import { Button } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing } from '../../theme/tokens';

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
    <AuthLayout
      title="Verify your email"
      subtitle={
        <>
          We sent a verification link to{' '}
          <Text style={styles.email}>{user?.email ?? 'your email'}</Text>.
        </>
      }
    >
      <View style={styles.steps}>
        <Text style={styles.step}>1. Open the link on this device (or any browser).</Text>
        <Text style={styles.step}>2. Come back here and tap “I verified my email”.</Text>
      </View>
      <Button title="I verified my email" size="large" loading={checking} onPress={() => void onCheckVerified()} style={authStyles.primary} />
      <Button title="Resend verification email" variant="secondary" loading={sending} onPress={() => void onResend()} style={styles.secondaryButton} />
      <Button title="Sign out" variant="text" onPress={() => void signOut()} style={styles.signOut} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  email: { fontWeight: '700', color: colors.text },
  steps: { marginTop: spacing.lg, marginBottom: spacing.sm, gap: spacing.xs + 2 },
  step: { fontSize: 14, lineHeight: 20, color: '#475569' },
  secondaryButton: { marginTop: spacing.md },
  signOut: { marginTop: spacing.sm },
});
