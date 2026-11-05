import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { submitAccountDeletionRequest } from '../../api/account';
import { getApiErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useAppConfig } from '../../hooks/useAppConfig';
import {
  confirmBeforeDeleteAccountFlow,
  confirmSubmitDeletionRequest,
} from '../../utils/deleteAccountConfirm';

type Props = NativeStackScreenProps<{ DeleteAccount: undefined }, 'DeleteAccount'>;

export function DeleteAccountScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const { config } = useAppConfig();
  const deletionUrl = config?.legal?.account_deletion_url;

  const [email, setEmail] = useState(user?.email ?? '');
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const sendRequest = async () => {
    setSubmitting(true);
    try {
      await submitAccountDeletionRequest({ email, notes });
      Alert.alert(
        'Request submitted',
        'We will email you when your account and data have been deleted. You can sign out now.',
        [{ text: 'OK', onPress: () => void signOut() }],
      );
    } catch (error) {
      Alert.alert('Could not submit', getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = () => {
    if (!confirmed) {
      Alert.alert('Confirmation required', 'Please confirm you understand this action is permanent.');
      return;
    }
    confirmSubmitDeletionRequest(() => {
      void sendRequest();
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Delete account</Text>
      <Text style={styles.lead}>
        Request permanent deletion of your RydAid account and personal data. This cannot be undone.
      </Text>

      <Text style={styles.sectionTitle}>What we delete</Text>
      <Text style={styles.body}>
        Profile, vehicles, mechanic listing, push tokens, and sign-in access linked to this account.
      </Text>

      <Text style={styles.sectionTitle}>What we may keep</Text>
      <Text style={styles.body}>
        Help/job records for legal and safety reasons (anonymized where possible), and Play Store subscription records.
        Cancel Mechanic Pro in Google Play separately.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Account email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        editable={!submitting}
      />

      <TextInput
        style={[styles.input, styles.notes]}
        placeholder="Notes (optional)"
        multiline
        value={notes}
        onChangeText={setNotes}
        editable={!submitting}
      />

      <Pressable style={styles.checkRow} onPress={() => setConfirmed((v) => !v)}>
        <Text style={styles.checkbox}>{confirmed ? '☑' : '☐'}</Text>
        <Text style={styles.checkLabel}>
          I understand this is permanent and I will lose access to my account data.
        </Text>
      </Pressable>

      <Pressable style={styles.dangerButton} onPress={onSubmit} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.dangerText}>Submit deletion request</Text>
        )}
      </Pressable>

      {deletionUrl ? (
        <Pressable
          onPress={() =>
            confirmBeforeDeleteAccountFlow(() => {
              Linking.openURL(deletionUrl).catch(() => {});
            })
          }
          style={styles.linkWrap}
        >
          <Text style={styles.link}>Open full deletion policy in browser</Text>
        </Pressable>
      ) : null}

      <Pressable onPress={() => navigation.goBack()} style={styles.linkWrap}>
        <Text style={styles.linkMuted}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  lead: { marginTop: 8, color: '#475569', lineHeight: 22 },
  sectionTitle: { marginTop: 20, fontSize: 14, fontWeight: '700', color: '#334155', textTransform: 'uppercase' },
  body: { marginTop: 6, color: '#64748b', lineHeight: 20, fontSize: 14 },
  input: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 14,
  },
  notes: { minHeight: 88, textAlignVertical: 'top' },
  checkRow: { flexDirection: 'row', gap: 10, marginTop: 16, alignItems: 'flex-start' },
  checkbox: { fontSize: 20, color: '#0284c7' },
  checkLabel: { flex: 1, color: '#475569', lineHeight: 20, fontSize: 14 },
  dangerButton: {
    marginTop: 24,
    backgroundColor: '#dc2626',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  dangerText: { color: '#fff', fontWeight: '600' },
  linkWrap: { marginTop: 20 },
  link: { color: '#0284c7', textAlign: 'center' },
  linkMuted: { color: '#64748b', textAlign: 'center' },
});
