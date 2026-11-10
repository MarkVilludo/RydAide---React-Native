import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string | undefined) => void;
};

export function MechanicDeclineOfferModal({ visible, busy, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!visible) {
      setReason('');
    }
  }, [visible]);

  const trimmed = reason.trim();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.dismissArea} onPress={busy ? undefined : onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Decline this offer?</Text>
          <Text style={styles.sub}>
            Optional — tell us why so we can send you better matches next time.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Too far, busy with another job…"
            placeholderTextColor="#94a3b8"
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={500}
            editable={!busy}
          />
          <View style={styles.actions}>
            <Pressable style={styles.skip} onPress={() => onConfirm(undefined)} disabled={busy}>
              <Text style={styles.skipText}>Skip & decline</Text>
            </Pressable>
            <Pressable
              style={[styles.confirm, busy && styles.confirmDisabled]}
              onPress={() => onConfirm(trimmed || undefined)}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmText}>Decline offer</Text>
              )}
            </Pressable>
          </View>
          <Pressable onPress={onClose} disabled={busy} style={styles.cancelHit}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  dismissArea: { flex: 1 },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  sub: { marginTop: 6, fontSize: 14, color: '#64748b', lineHeight: 20 },
  input: {
    marginTop: 14,
    minHeight: 88,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#0f172a',
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16, alignItems: 'stretch' },
  skip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: { fontWeight: '700', color: '#475569', fontSize: 14 },
  confirm: {
    flex: 1.2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDisabled: { opacity: 0.7 },
  confirmText: { fontWeight: '800', color: '#fff', fontSize: 15 },
  cancelHit: { marginTop: 12, alignItems: 'center' },
  cancel: { color: '#0284c7', fontWeight: '600', fontSize: 15 },
});
