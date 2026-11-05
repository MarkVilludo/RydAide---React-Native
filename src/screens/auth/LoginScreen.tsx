import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApiErrorMessage } from '../../api/client';
import { API_ORIGIN, API_URL, apiEnvironment } from '../../config';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useAuth } from '../../context/AuthContext';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const { config } = useAppConfig();
  const privacyUrl = config?.legal?.privacy_url ?? `${API_ORIGIN}/privacy`;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    <View style={styles.container}>
      <Text style={styles.brand}>RydAid</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
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

      {__DEV__ ? (
        <Text style={styles.apiHint} selectable>
          API ({apiEnvironment()}): {API_URL}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#f8fafc' },
  brand: { fontSize: 32, fontWeight: '700', color: '#0369a1', textAlign: 'center' },
  subtitle: { textAlign: 'center', color: '#64748b', marginBottom: 24, marginTop: 8 },
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
  forgotWrap: { marginTop: 16 },
  forgotLink: { color: '#0284c7', textAlign: 'center', fontSize: 14 },
  link: { color: '#0284c7', textAlign: 'center', marginTop: 20 },
  privacyWrap: { marginTop: 28 },
  privacyLink: { textAlign: 'center', color: '#64748b', fontSize: 13, textDecorationLine: 'underline' },
  apiHint: { marginTop: 16, fontSize: 11, color: '#94a3b8', textAlign: 'center' },
});
