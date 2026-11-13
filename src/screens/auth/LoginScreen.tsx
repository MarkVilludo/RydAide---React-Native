import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
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
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          returnKeyType="done"
          onLayout={(e) => {
            fieldOffsetY.current.password = e.nativeEvent.layout.y;
          }}
          onFocus={() => scrollFieldIntoView('password')}
          onSubmitEditing={() => void onSubmit()}
        />

        <Pressable style={styles.primaryButton} onPress={onSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Sign in</Text>}
        </Pressable>

        <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotWrap}>
          <Text style={styles.forgotLink}>Forgot password?</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Register')}>
          <Text style={styles.link}>Create an account</Text>
        </Pressable>

        <Pressable onPress={() => Linking.openURL(privacyUrl).catch(() => {})} style={styles.privacyWrap}>
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
  logo: { marginBottom: 8, alignSelf: 'center' },
  subtitle: { textAlign: 'center', color: '#64748b', marginBottom: 24, marginTop: 8 },
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
  forgotWrap: { marginTop: 16 },
  forgotLink: { color: '#0284c7', textAlign: 'center', fontSize: 14 },
  link: { color: '#0284c7', textAlign: 'center', marginTop: 20 },
  privacyWrap: { marginTop: 28 },
  privacyLink: { textAlign: 'center', color: '#64748b', fontSize: 13, textDecorationLine: 'underline' },
  apiHint: { marginTop: 16, fontSize: 11, color: '#94a3b8', textAlign: 'center' },
});
