import React from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, Text, View } from 'react-native';
import type { PaymentType } from '../api/paymentMethods';
import { colors } from '../theme/colors';
import { paymentIcon } from '../utils/paymentMethods';

const GCASH = require('../../assets/payment/gcash.png');
const MAYA = require('../../assets/payment/maya.png');

type LogoKey = 'GCASH' | 'MAYA';

const LOGOS: Record<LogoKey, { source: number; aspect: number; label: string }> = {
  GCASH: { source: GCASH, aspect: 120 / 29, label: 'GCash' },
  MAYA: { source: MAYA, aspect: 120 / 35, label: 'Maya' },
};

function normalizeWalletType(type: PaymentType | string | null | undefined): LogoKey | null {
  const key = (type ?? '').toUpperCase();
  if (key === 'GCASH' || key === 'MAYA') return key;
  return null;
}

type Props = {
  type: PaymentType | string | null | undefined;
  /** Target height for the logo mark (wordmark scales by aspect ratio). */
  height?: number;
  style?: StyleProp<ImageStyle>;
  /** When true, show emoji fallback for cash/other instead of nothing. */
  emojiFallback?: boolean;
};

/** GCash / Maya wordmarks; cash and other wallets still use emoji via `paymentIcon`. */
export function PaymentWalletLogo({ type, height = 20, style, emojiFallback = true }: Props) {
  const brand = normalizeWalletType(type);
  if (brand) {
    const meta = LOGOS[brand];
    const width = height * meta.aspect;
    return (
      <Image
        source={meta.source}
        style={[{ width, height }, style]}
        resizeMode="contain"
        accessibilityLabel={meta.label}
      />
    );
  }
  if (!emojiFallback) return null;
  return <Text style={[styles.emoji, { fontSize: height }]}>{paymentIcon(type)}</Text>;
}

export function isBrandedWallet(type: PaymentType | string | null | undefined): boolean {
  return normalizeWalletType(type) != null;
}

const styles = StyleSheet.create({
  emoji: { lineHeight: 22 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
});

/** Chip / list row: brand wordmark, or emoji + label for cash and other wallets. */
export function PaymentWalletChipTitle({
  type,
  label,
  height = 17,
  emphasized,
}: {
  type: PaymentType | string;
  label: string;
  height?: number;
  emphasized?: boolean;
}) {
  if (isBrandedWallet(type)) {
    return <PaymentWalletLogo type={type} height={height} emojiFallback={false} />;
  }
  const labelStyle = [styles.chipLabel, emphasized && { color: colors.primaryInk }];
  return (
    <View style={styles.chipRow}>
      <Text style={{ fontSize: height }}>{paymentIcon(type)}</Text>
      <Text style={labelStyle}>{label}</Text>
    </View>
  );
}