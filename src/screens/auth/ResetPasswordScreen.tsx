import React, { useRef, useState } from 'react';
import { Alert, View, type TextInputInstance } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApiErrorMessage } from '../../api/client';
import { resetPassword } from '../../api/auth';
import { AuthErrorBanner } from '../../components/auth/AuthErrorBanner';
import { AuthLayout, authStyles } from '../../components/auth/AuthLayout';
import { authFieldErrors } from '../../components/auth/authErrors';
import { Button, TextField } from '../../components/ui';
import { spacing } from '../../theme/tokens';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

export function ResetPasswordScreen({ navigation, route }: Props) {
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [token, setToken] = useState(route.params?.token ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const tokenRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (submitting) return;
    const local: Record<string, string> = {};
    if (!email.trim()) local.email = 'Enter your email.';
    if (!token.trim()) local.token = 'Paste the reset token from the email.';
    if (password.length < 8) local.password = 'Use at least 8 characters.';
    else if (password !== confirm) local.password_confirmation = 'Passwords don’t match.';
    setErrors(local);
    setFormError(null);
    if (Object.keys(local).length) return;
    setSubmitting(true);
    try {
      await resetPassword({
        email: email.trim(),
        token: token.trim(),
        password,
        password_confirmation: confirm,
      });
      Alert.alert('Password updated', 'You can sign in with your new password.', [
        { text: 'Sign in', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (error) {
      const fields = authFieldErrors(error);
      setErrors(fields);
      setFormError(Object.keys(fields).length ? 'Please fix the highlighted fields.' : getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const clear = (key: string) => {
    if (errors[key]) setErrors(({ [key]: _drop, ...rest }) => rest);
    if (formError) setFormError(null);
  };

  return (
    <AuthLayout
      onBack={() => navigation.goBack()}
      title="Reset password"
      subtitle="Paste the token from your reset email, or reset via the link in the email in your browser."
      extraBottomPadding={160}
    >
      <AuthErrorBanner message={formError} />
      <View style={authStyles.fields}>
        <TextField
          size="large"
          leadingIcon="mail"
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
          error={errors.email}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => tokenRef.current?.focus()}
        />
        <TextField
          ref={tokenRef}
          size="large"
          leadingIcon="shield"
          label="Reset token"
          placeholder="From the reset email"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          value={token}
          onChangeText={(t) => {
            setToken(t);
            clear('token');
          }}
          error={errors.token}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <TextField
          ref={passwordRef}
          size="large"
          leadingIcon="lock"
          label="New password"
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
          error={errors.password}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => confirmRef.current?.focus()}
        />
        <TextField
          ref={confirmRef}
          size="large"
          leadingIcon="lock"
          label="Confirm new password"
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
          error={errors.password_confirmation}
          returnKeyType="go"
          onSubmitEditing={() => void onSubmit()}
        />
      </View>
      <Button title="Update password" size="large" loading={submitting} onPress={() => void onSubmit()} style={authStyles.primary} />
      <Button title="Back to sign in" variant="text" onPress={() => navigation.navigate('Login')} style={{ marginTop: spacing.sm }} />
    </AuthLayout>
  );
}
