import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Linking,
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
import { colors, spacing, type as typeScale } from '../../theme/tokens';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from '../../components/KeyboardAwareScrollView';
import { API_ORIGIN, API_URL, apiEnvironment } from '../../config';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useAuth } from '../../context/AuthContext';
import { confirmBeforeDeleteAccountFlow } from '../../utils/deleteAccountConfirm';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const { config } = useAppConfig();
  const insets = useSafeAreaInsets();
  const privacyUrl = config?.legal?.privacy_url ?? `${API_ORIGIN}/privacy`;
  const deletionUrl = config?.legal?.account_deletion_url ?? `${API_ORIGIN}/account-deletion`;
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const formOffsetY = useRef(0);
  const fieldOffsetY = useRef<Record<string, number>>({});
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  // Lock content height to the full screen so the keyboard does not "lift"/re-center the form.
  const minContentHeight = useMemo(() => {
    const windowHeight = Dimensions.get('window').height;
    return Math.max(480, windowHeight - insets.top - insets.bottom);
  }, [insets.bottom, insets.top]);

  const scrollFieldIntoView = (key: string) => {
    const fieldY = fieldOffsetY.current[key];
    setTimeout(() => {
      if (typeof fieldY === 'number') {
        scrollRef.current?.scrollTo({
          y: Math.max(0, formOffsetY.current + fieldY - 24),
          animated: true,
        });
      } else {
        scrollRef.current?.scrollToEnd({ animated: true });
      }
    }, Platform.OS === 'android' ? 200 : 80);
  };

  const onSubmit = async () => {
    if (submitting) return;
    if (!email.trim() || !password) {
      Alert.alert('Sign in', 'Enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (error) {
      Alert.alert('Login failed', getApiErrorMessage(error));
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
          paddingBottom: Math.max(24, insets.bottom + 16),
        },
      ]}
      extraBottomPadding={24}
    >
      <View
        style={styles.form}
        onLayout={(e) => {
          formOffsetY.current = e.nativeEvent.layout.y;
        }}
      >
        <BrandLogo width={200} style={styles.logo} />
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <TextField
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
        />
        <TextField
          ref={passwordRef}
          label="Password"
          placeholder="Your password"
          secureTextEntry
          revealable
          autoComplete="password"
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          returnKeyType="go"
          onContainerLayout={(e) => {
            fieldOffsetY.current.password = e.nativeEvent.layout.y;
          }}
          onFocus={() => scrollFieldIntoView('password')}
          onSubmitEditing={() => void onSubmit()}
        />

        <Button title="Sign in" size="large" loading={submitting} onPress={() => void onSubmit()} style={styles.primaryButton} />

        <Button title="Forgot password?" variant="text" onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotWrap} />

        <View style={styles.registerRow}>
          <Text style={styles.registerText}>New to RydAid?</Text>
          <Button title="Create an account" variant="text" onPress={() => navigation.navigate('Register')} />
        </View>

        <Pressable onPress={() => Linking.openURL(privacyUrl).catch(() => {})} style={styles.privacyWrap} accessibilityRole="link">
          <Text style={styles.privacyLink}>Privacy Policy</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            confirmBeforeDeleteAccountFlow(() => {
              Linking.openURL(deletionUrl).catch(() => {});
            })
          }
          style={styles.privacyWrap}
        >
          <Text style={styles.privacyLink}>Delete account & data</Text>
        </Pressable>

        {__DEV__ ? (
          <Text style={styles.apiHint} selectable>
            API ({apiEnvironment()}): {API_URL}
          </Text>
        ) : null}
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
  logo: { marginBottom: spacing.sm, alignSelf: 'center' },
  subtitle: { ...typeScale.body, textAlign: 'center', color: colors.muted, marginBottom: spacing.xxl, marginTop: spacing.sm },
  primaryButton: { marginTop: spacing.sm },
  forgotWrap: { marginTop: spacing.sm },
  registerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginTop: spacing.xs },
  registerText: { ...typeScale.body, color: colors.muted },
  privacyWrap: { marginTop: spacing.lg, minHeight: 44, justifyContent: 'center' },
  privacyLink: { textAlign: 'center', color: colors.muted, fontSize: 13, textDecorationLine: 'underline' },
  apiHint: { marginTop: spacing.lg, fontSize: 11, color: colors.mutedSoft, textAlign: 'center' },
});
