import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  acting: boolean;
  onAccept: () => void;
  onDecline: () => void;
  /**
   * Set when the mechanic can't accept (free requests used, no Mechanic Pro).
   * Explains it before they tap, and swaps Accept for the upgrade action when one exists.
   */
  upgrade?: { message: string; onUpgrade?: () => void } | null;
};

export function MechanicIncomingOfferFooter({ acting, onAccept, onDecline, upgrade }: Props) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8);

  return (
    <View style={[styles.bar, { paddingBottom: bottomPad }]}>
      {upgrade ? (
        <Text style={styles.upgradeNote} accessibilityRole="text">
          {upgrade.message}
        </Text>
      ) : null}
      {upgrade?.onUpgrade ? (
        <Pressable
          style={({ pressed }) => [styles.upgrade, pressed && styles.upgradePressed]}
          onPress={upgrade.onUpgrade}
          accessibilityRole="button"
          accessibilityLabel="Get Mechanic Pro"
          accessibilityHint="Opens Mechanic Pro plans"
        >
          <Text style={styles.acceptText}>Get Mechanic Pro</Text>
        </Pressable>
      ) : upgrade ? null : (
      <Pressable
        style={({ pressed }) => [styles.accept, pressed && styles.acceptPressed, acting && styles.disabled]}
        onPress={onAccept}
        disabled={acting}
        accessibilityRole="button"
        accessibilityLabel="Accept job"
      >
        {acting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.acceptText}>Accept job</Text>
        )}
      </Pressable>
      )}
      <Pressable
        style={({ pressed }) => [styles.decline, pressed && styles.declinePressed, acting && styles.disabled]}
        onPress={onDecline}
        disabled={acting}
        accessibilityRole="button"
        accessibilityLabel="Decline offer"
      >
        <Text style={styles.declineText}>Decline</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  accept: {
    backgroundColor: '#16a34a',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  acceptPressed: { backgroundColor: '#15803d' },
  upgradeNote: {
    color: '#92400e',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  upgrade: {
    backgroundColor: '#0284c7',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  upgradePressed: { backgroundColor: '#0369a1' },
  acceptText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  decline: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  declinePressed: { opacity: 0.75 },
  declineText: { color: '#64748b', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.65 },
});
