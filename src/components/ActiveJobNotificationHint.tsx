import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePushNotifications } from '../context/NotificationsContext';
import { colors, radii, spacing } from '../theme/tokens';

/** Prompt to enable push while on a live job (updates when app is in background). */
export function ActiveJobNotificationHint() {
  const { pushAvailable, pushToken, registerDevicePush } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!pushAvailable || pushToken || dismissed) {
    return null;
  }

  return (
    <View style={styles.box}>
      <View style={styles.textCol}>
        <Text style={styles.title}>Turn on notifications</Text>
        <Text style={styles.body}>Get alerts when your mechanic updates status or messages you.</Text>
      </View>
      <Pressable
        style={styles.btn}
        disabled={busy}
        onPress={() => {
          setBusy(true);
          void registerDevicePush().finally(() => setBusy(false));
        }}
      >
        <Text style={styles.btnText}>{busy ? '…' : 'Enable'}</Text>
      </Pressable>
      <Pressable onPress={() => setDismissed(true)} hitSlop={8} accessibilityLabel="Dismiss">
        <Text style={styles.dismiss}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '800', color: colors.primaryInk },
  body: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 2 },
  btn: {
    minHeight: 34,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 13, fontWeight: '800', color: colors.onPrimary },
  dismiss: { fontSize: 16, color: colors.muted, paddingHorizontal: 4 },
});