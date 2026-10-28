import React, { type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  children: ReactNode;
  /** Added on top of system bottom inset (home indicator / Android gesture bar). */
  bottomInset?: number;
  /** Android system nav is hidden (immersive) — use minimal bottom pad only. */
  immersiveBottom?: boolean;
};

export function GrabStyleBottomSheet({
  children,
  bottomInset = 0,
  immersiveBottom = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const systemBottom = immersiveBottom
    ? Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 0)
    : insets.bottom > 0
      ? insets.bottom
      : Platform.OS === 'android'
        ? 20
        : 0;

  return (
    <View style={[styles.sheet, { paddingBottom: 24 + systemBottom + bottomInset }]}>
      <View style={styles.handle} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    marginTop: -16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    marginBottom: 12,
  },
});
