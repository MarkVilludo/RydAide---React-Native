import React from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { ImageURISource } from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  source: ImageURISource | null;
  title: string;
};

/** Full-screen QR for paying or receiving — readable in bright light. */
export function PaymentQrViewerModal({ visible, onClose, source, title }: Props) {
  const { width, height } = useWindowDimensions();
  const qrSize = Math.min(width - 48, height * 0.55, 360);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close QR viewer">
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>Scan to pay · pinch to zoom on your device if needed</Text>
          {source ? (
            <Image source={source} style={{ width: qrSize, height: qrSize }} resizeMode="contain" accessibilityLabel={`${title} QR code`} />
          ) : (
            <Text style={styles.missing}>QR image unavailable</Text>
          )}
          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  hint: { fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: spacing.xs },
  missing: { fontSize: 14, color: colors.muted, paddingVertical: 40 },
  closeBtn: {
    marginTop: spacing.md,
    minHeight: 44,
    minWidth: 120,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontSize: 15, fontWeight: '800', color: colors.onPrimary },
});