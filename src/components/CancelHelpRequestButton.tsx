import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { compactBottomInset } from '../utils/screenInsets';

type Props = {
  onPress: () => void;
  /** Pin to bottom of screen with safe-area padding (always visible). */
  fixedFooter?: boolean;
};

export function CancelHelpRequestButton({ onPress, fixedFooter = false }: Props) {
  const bottomPad = compactBottomInset();

  const button = (
    <Pressable
      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Cancel request"
    >
      <Text style={styles.btnText}>Cancel request</Text>
    </Pressable>
  );

  if (fixedFooter) {
    return (
      <View style={[styles.footer, { paddingBottom: Math.max(bottomPad, 12) }]}>
        {button}
      </View>
    );
  }

  return <View style={styles.inlineWrap}>{button}</View>;
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 6,
  },
  inlineWrap: { marginTop: 16 },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
    alignItems: 'center',
  },
  btnPressed: { opacity: 0.88, backgroundColor: '#fee2e2' },
  btnText: { color: '#dc2626', fontWeight: '800', fontSize: 16 },
});
