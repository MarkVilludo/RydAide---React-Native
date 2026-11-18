import Constants from 'expo-constants';
import React, { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View, type TextInputInstance } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApiErrorMessage, getNetworkReachabilityMessage, isApiNetworkError } from '../../api/client';
import { AuthConnectivityBanner } from '../../components/auth/AuthConnectivityBanner';
import { AuthErrorBanner } from '../../components/auth/AuthErrorBanner';
import { AuthLayout, authStyles } from '../../components/auth/AuthLayout';
import { authFieldErrors } from '../../components/auth/authErrors';
import type { KeyboardAwareScrollViewRef } from '../../components/KeyboardAwareScrollView';
import { Button, TextField } from '../../components/ui';
import { API_ORIGIN, API_URL, apiEnvironment } from '../../config';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useAuth } from '../../context/AuthContext';
import { colors, radii, spacing, touch } from '../../theme/tokens';
import { confirmBeforeDeleteAccountFlow } from '../../utils/deleteAccountConfirm';
import { loadLastLoginEmail, saveLastLoginEmail } from '../../utils/lastLoginEmail';
import { googleSignInAvailable, requestGoogleIdToken } from '../../services/googleSignIn';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

/**
 * Sign in. Email + password only — the API's login accepts email (no phone login), so there is no
 * Email/Mobile switch. Auth logic is unchanged: signIn(email, password) from AuthContext.
 */
export function LoginScreen({ navigation }: Props) {
  const { signIn, signInWithGoogle } = useAuth();
  const { config, loading: configLoading, reload: reloadConfig, refreshFailed: configUnreachable } = useAppConfig();
  const [configRetrying, setConfigRetrying] = useState(false);
  const googleAuth = config?.auth?.google_sign_in;
  const showGoogleSignIn = googleSignInAvailable(googleAuth?.enabled, {
    webClientId: googleAuth?.web_client_id,
    iosClientId: googleAuth?.ios_client_id,
  });
  const privacyUrl = config?.legal?.privacy_url ?? `${API_ORIGIN}/privacy`;
  const deletionUrl = config?.legal?.account_deletion_url ?? `${API_ORIGIN}/account-deletion`;
  const version = Constants.expoConfig?.version;
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const formOffsetY = useRef(0);
  const fieldOffsetY = useRef<Record<string, number>>({});
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [pendingGoogleToken, setPendingGoogleToken] = useState<string | null>(null);
  const [pendingGoogleRole, setPendingGoogleRole] = useState<'owner' | 'mechanic'>('owner');

  // Prefill the last email used on this device.
  useEffect(() => {
    let alive = true;
    void loadLastLoginEmail().then((saved) => {
      if (alive && saved) setEmail((cur) => cur || saved);
    });
    return () => {
      alive = false;
    };
  }, []);

  const scrollFieldIntoView = (key: string) => {
    const fieldY = fieldOffsetY.current[key];
    setTimeout(() => {
      if (typeof fieldY === 'number') {
        // Keep the field and the Sign in button below it in view.
        scrollRef.current?.scrollTo({ y: Math.max(0, formOffsetY.current + fieldY - 16), animated: true });
      } else {
        scrollRef.current?.scrollToEnd({ animated: true });
      }
    }, Platform.OS === 'android' ? 220 : 80);
  };

  const onSubmit = async () => {
    if (submitting) return;
    const local: Record<string, string> = {};
    if (!email.trim()) local.email = 'Enter your email.';
    if (!password) local.password = 'Enter your password.';
    setFieldErrors(local);
    setFormError(null);
    if (Object.keys(local).length) return;
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      void saveLastLoginEmail(email);
    } catch (error) {
      const message = isApiNetworkError(error) ? getNetworkReachabilityMessage() : getApiErrorMessage(error);
      const fields = authFieldErrors(error);
      // Wrong credentials come back on "email" with the same text as the banner — show it once.
      if (fields.email === message) delete fields.email;
      setFieldErrors(fields);
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const clearErrors = (key: string) => {
    if (fieldErrors[key]) setFieldErrors(({ [key]: _drop, ...rest }) => rest);
    if (formError) setFormError(null);
  };

  const completeGoogleSignIn = async (idToken: string, role?: 'owner' | 'mechanic') => {
    try {
      await signInWithGoogle(idToken, role);
      setPendingGoogleToken(null);
    } catch (error) {
      const fields = authFieldErrors(error);
      if (fields.role && !role) {
        setPendingGoogleToken(idToken);
        setFormError(fields.role);
        return;
      }
      setFormError(isApiNetworkError(error) ? getNetworkReachabilityMessage() : getApiErrorMessage(error));
      throw error;
    }
  };

  const onGooglePress = async () => {
    if (googleBusy || submitting) return;
    setFormError(null);
    setGoogleBusy(true);
    try {
      const result = await requestGoogleIdToken({
        webClientId: googleAuth?.web_client_id,
        iosClientId: googleAuth?.ios_client_id,
      });
      if (!result.ok) {
        if (!result.cancelled && result.message) setFormError(result.message);
        return;
      }
      await completeGoogleSignIn(result.idToken);
    } catch {
      // formError set in completeGoogleSignIn
    } finally {
      setGoogleBusy(false);
    }
  };

  const onGoogleRoleContinue = async () => {
    if (!pendingGoogleToken || googleBusy) return;
    setGoogleBusy(true);
    setFormError(null);
    try {
      await completeGoogleSignIn(pendingGoogleToken, pendingGoogleRole);
    } catch {
      /* banner */
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <AuthLayout
      ref={scrollRef}
      onFormLayout={(y) => {
        formOffsetY.current = y;
      }}
      footer={
        <>
          <View style={authStyles.footerRow}>
            <Pressable onPress={() => Linking.openURL(privacyUrl).catch(() => {})} style={authStyles.footerLink} accessibilityRole="link" hitSlop={6}>
              <Text style={authStyles.footerText}>Privacy</Text>
            </Pressable>
            <Text style={authStyles.footerDot}>·</Text>
            <Pressable
              onPress={() =>
                confirmBeforeDeleteAccountFlow(() => {
                  Linking.openURL(deletionUrl).catch(() => {});
                })
              }
              style={authStyles.footerLink}
              accessibilityRole="link"
              accessibilityLabel="Delete account and data"
              hitSlop={6}
            >
              <Text style={authStyles.footerText}>Delete account</Text>
            </Pressable>
            {version ? (
              <>
                <Text style={authStyles.footerDot}>·</Text>
                <Text style={[authStyles.footerText, styles.version]}>v{version}</Text>
              </>
            ) : null}
          </View>
          {__DEV__ ? (
            <Text style={authStyles.devHint} numberOfLines={1} selectable>
              {apiEnvironment()} · {API_URL}
            </Text>
          ) : null}
        </>
      }
    >
      <AuthConnectivityBanner
        visible={configUnreachable && !configLoading}
        retrying={configRetrying}
        onRetry={() => {
          setConfigRetrying(true);
          void reloadConfig().finally(() => setConfigRetrying(false));
        }}
      />

      <AuthErrorBanner message={formError} />

      {configUnreachable && !showGoogleSignIn ? (
        <Text style={styles.offlineHint}>Google sign-in needs a server connection — use email and password if you can reach the API.</Text>
      ) : null}

      {showGoogleSignIn ? (
        <>
          <Button
            title="Continue with Google"
            variant="secondary"
            size="large"
            loading={googleBusy}
            disabled={submitting}
            onPress={() => void onGooglePress()}
            style={authStyles.primary}
          />
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>
        </>
      ) : null}

      {pendingGoogleToken ? (
        <View style={styles.googleRoleBlock}>
          <Text style={styles.googleRoleTitle}>How will you use RydAid?</Text>
          <View style={styles.chips}>
            <Pressable
              style={({ pressed }) => [styles.chip, pendingGoogleRole === 'owner' && styles.chipActive, pressed && styles.chipPressed]}
              onPress={() => setPendingGoogleRole('owner')}
              accessibilityRole="button"
            >
              <Text style={styles.chipText}>🚗 I need roadside help</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.chip, pendingGoogleRole === 'mechanic' && styles.chipActive, pressed && styles.chipPressed]}
              onPress={() => setPendingGoogleRole('mechanic')}
              accessibilityRole="button"
            >
              <Text style={styles.chipText}>🔧 I’m a mechanic</Text>
            </Pressable>
          </View>
          <Button
            title="Continue"
            size="large"
            loading={googleBusy}
            onPress={() => void onGoogleRoleContinue()}
            style={authStyles.primary}
          />
        </View>
      ) : null}

      <View style={styles.fieldsTop}>
        <TextField
          size="large"
          leadingIcon="mail"
          label="Email"
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="username"
          importantForAutofill="yes"
          editable={!submitting}
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            clearErrors('email');
          }}
          error={fieldErrors.email}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          onContainerLayout={(e) => {
            fieldOffsetY.current.email = e.nativeEvent.layout.y;
          }}
          onFocus={() => scrollFieldIntoView('email')}
        />
        <TextField
          ref={passwordRef}
          size="large"
          leadingIcon="lock"
          label="Password"
          placeholder="Your password"
          secureTextEntry
          revealable
          autoComplete="current-password"
          textContentType="password"
          importantForAutofill="yes"
          editable={!submitting}
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            clearErrors('password');
          }}
          error={fieldErrors.password}
          labelAccessory={
            <Pressable
              onPress={() => navigation.navigate('ForgotPassword')}
              hitSlop={{ top: 12, bottom: 12, left: 16, right: 8 }}
              accessibilityRole="link"
              accessibilityLabel="Forgot password?"
            >
              <Text style={styles.forgot}>Forgot?</Text>
            </Pressable>
          }
          returnKeyType="go"
          onContainerLayout={(e) => {
            fieldOffsetY.current.password = e.nativeEvent.layout.y;
          }}
          onFocus={() => scrollFieldIntoView('password')}
          onSubmitEditing={() => void onSubmit()}
        />
      </View>

      <Button title="Sign in" size="large" loading={submitting} onPress={() => void onSubmit()} style={authStyles.primary} />

      <View style={authStyles.linkRow}>
        <Text style={authStyles.linkRowText}>New to RydAid?</Text>
        <Button title="Create account" variant="text" onPress={() => navigation.navigate('Register')} style={styles.inlineLink} />
      </View>
      <View style={styles.chips}>
        <Pressable
          style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          onPress={() => navigation.navigate('Register', { role: 'owner' })}
          accessibilityRole="button"
          accessibilityLabel="Create an account: I need roadside help"
        >
          <Text style={styles.chipText}>🚗 I need roadside help</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          onPress={() => navigation.navigate('Register', { role: 'mechanic' })}
          accessibilityRole="button"
          accessibilityLabel="Create an account: I'm a mechanic"
        >
          <Text style={styles.chipText}>🔧 I’m a mechanic</Text>
        </Pressable>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.md },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  googleRoleBlock: { marginBottom: spacing.md, gap: spacing.sm },
  googleRoleTitle: { fontSize: 15, fontWeight: '700', color: colors.text, textAlign: 'center' },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  fieldsTop: { marginTop: 0 },
  forgot: { fontSize: 14, fontWeight: '700', color: colors.primary },
  inlineLink: { paddingHorizontal: spacing.xs + 2 },
  chips: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    flex: 1,
    minHeight: touch.min,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  chipPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.primaryInk },
  version: { paddingHorizontal: spacing.xs },
  offlineHint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
});
