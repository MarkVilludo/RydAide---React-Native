import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function JobStatusConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onCancel} accessibilityLabel="Dismiss" />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <Pressable style={styles.confirmBtn} onPress={onConfirm} accessibilityRole="button">
            <Text style={styles.confirmText}>{confirmLabel}</Text>
          </Pressable>
          <Pressable onPress={onCancel} accessibilityRole="button">
            <Text style={styles.cancel}>Undo</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  dismissArea: { flex: 1 },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 28,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  message: { fontSize: 14, color: '#64748b', lineHeight: 20, marginBottom: 16 },
  confirmBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  cancel: { textAlign: 'center', marginTop: 14, color: '#0284c7', fontWeight: '700', fontSize: 15 },
});
