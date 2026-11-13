import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApiErrorMessage } from '../../api/client';
import { requestPasswordReset } from '../../api/auth';
import { AuthErrorBanner } from '../../components/auth/AuthErrorBanner';
import { AuthLayout, authStyles } from '../../components/auth/AuthLayout';
import { authFieldErrors } from '../../components/auth/authErrors';
import { Button, TextField } from '../../components/ui';
import { spacing } from '../../theme/tokens';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = async () => {
    const trimmed = email.trim();
    setFormError(null);
    if (!trimmed) {
      setError('Enter the email you used for RydAid.');
      return;
    }
    setError(null);
    if (submitting) return;
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
      const fields = authFieldErrors(error);
      if (fields.email) setError(fields.email);
      else setFormError(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout onBack={() => navigation.goBack()} title="Forgot password" subtitle="We will email you a link and reset token.">
      <AuthErrorBanner message={formError} />
      <View style={authStyles.fields}>
        <TextField
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
            if (error) setError(null);
          }}
          error={error}
          returnKeyType="send"
          onSubmitEditing={() => void onSubmit()}
        />
      </View>
      <Button title="Send reset email" size="large" loading={submitting} onPress={() => void onSubmit()} style={authStyles.primary} />
      <Button
        title="I have a reset token"
        variant="text"
        onPress={() => navigation.navigate('ResetPassword', { email: email.trim() || undefined })}
        style={{ marginTop: spacing.sm }}
      />
      <Button title="Back to sign in" variant="text" onPress={() => navigation.goBack()} />
    </AuthLayout>
  );
}
