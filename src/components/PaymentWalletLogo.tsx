import React from 'react';
import { Image, StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
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

/** Fixed logo height on Payment methods list rows (cash, GCash, Maya, other). */
export const PAYMENT_METHOD_ROW_LOGO_HEIGHT = 28;
/** Matches `PaymentMethodsScreen` icon column — wordmarks scale with `maxWidth`. */
export const PAYMENT_METHOD_ROW_LOGO_MAX_WIDTH = 92;

/** Same outer size as {@link OtherWalletMark} so list rows align. */
export const paymentLogoTileWidth = (height: number) => height * 1.42;

function walletKind(type: PaymentType | string | null | undefined): 'GCASH' | 'MAYA' | 'OTHER' | 'CASH' | null {
  const key = (type ?? '').toUpperCase();
  if (key === 'GCASH' || key === 'MAYA') return key;
  if (key === 'CASH') return 'CASH';
  if (key === 'OTHER') return 'OTHER';
  return null;
}

function normalizeWalletType(type: PaymentType | string | null | undefined): LogoKey | null {
  const kind = walletKind(type);
  return kind === 'GCASH' || kind === 'MAYA' ? kind : null;
}

/** In-person cash — same tile size as other wallet marks on payment lists. */
export function CashWalletMark({
  height,
  style,
  accessibilityLabel = 'Cash',
}: {
  height: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const cardW = paymentLogoTileWidth(height);
  const cardH = height;
  return (
    <View
      style={[styles.cashCard, { width: cardW, height: cardH, borderRadius: cardH * 0.18 }, style]}
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={[styles.cashEmoji, { fontSize: cardH * 0.62, lineHeight: cardH * 0.72 }]} accessibilityElementsHidden importantForAccessibility="no">
        💵
      </Text>
    </View>
  );
}

/** RydAid-styled card for ShopeePay, banks, and other QR wallets (matches primary brand blue). */
export function OtherWalletMark({
  height,
  style,
  accessibilityLabel = 'Other wallet or bank',
}: {
  height: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const cardW = paymentLogoTileWidth(height);
  const cardH = height;
  return (
    <View
      style={[styles.otherCard, { width: cardW, height: cardH, borderRadius: cardH * 0.18 }, style]}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.otherChip, { height: cardH * 0.2, width: cardW * 0.17, borderRadius: 3 }]} />
      <View style={styles.otherLines}>
        <View style={[styles.otherLine, { width: cardW * 0.34 }]} />
        <View style={[styles.otherLine, { width: cardW * 0.26, opacity: 0.55 }]} />
      </View>
      <Text style={[styles.otherPeso, { fontSize: cardH * 0.44 }]}>₱</Text>
    </View>
  );
}

type Props = {
  type: PaymentType | string | null | undefined;
  /** Target height for the logo mark (wordmark scales by aspect ratio). */
  height?: number;
  /** Keeps wide wordmarks inside narrow list columns (e.g. Digital wallets row). */
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
  /** When true, show emoji fallback for cash/other instead of nothing. */
  emojiFallback?: boolean;
};

/** GCash / Maya wordmarks; cash & other wallets use branded tiles. */
export function PaymentWalletLogo({ type, height = 20, maxWidth, style, emojiFallback = true }: Props) {
  const kind = walletKind(type);
  if (kind === 'CASH') {
    return <CashWalletMark height={height} style={style} />;
  }
  if (kind === 'OTHER') {
    return <OtherWalletMark height={height} style={style} />;
  }
  const brand = normalizeWalletType(type);
  if (brand) {
    const meta = LOGOS[brand];
    let boxWidth = height * meta.aspect;
    let boxHeight = height;
    if (maxWidth != null && boxWidth > maxWidth) {
      const scale = maxWidth / boxWidth;
      boxWidth = maxWidth;
      boxHeight = height * scale;
    }
    return (
      <View style={[{ width: boxWidth, height: boxHeight }, style]} accessibilityLabel={meta.label}>
        <Image
          source={meta.source}
          style={{ width: boxWidth, height: boxHeight }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }
  if (!emojiFallback) return null;
  return <Text style={[styles.emoji, { fontSize: height }]}>{paymentIcon(type)}</Text>;
}

export function isBrandedWallet(type: PaymentType | string | null | undefined): boolean {
  return normalizeWalletType(type) != null;
}

export function isOtherWallet(type: PaymentType | string | null | undefined): boolean {
  return walletKind(type) === 'OTHER';
}

const styles = StyleSheet.create({
  emoji: { lineHeight: 22 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  otherCard: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    paddingHorizontal: 5,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    overflow: 'hidden',
  },
  otherChip: { backgroundColor: 'rgba(255,255,255,0.35)' },
  otherLines: { flex: 1, gap: 3, minWidth: 0 },
  otherLine: { height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.5)' },
  otherPeso: { color: colors.onPrimary, fontWeight: '800', marginLeft: 2 },
  cashCard: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashEmoji: { textAlign: 'center' },
  logoSlot: {
    flexShrink: 0,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
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
  const labelStyle = [styles.chipLabel, emphasized && { color: colors.primaryInk }];
  if (isBrandedWallet(type)) {
    return <PaymentWalletLogo type={type} height={height} emojiFallback={false} />;
  }
  if (isOtherWallet(type)) {
    return (
      <View style={styles.chipRow}>
        <PaymentWalletLogo type="OTHER" height={height} emojiFallback={false} />
        <Text style={labelStyle}>{label}</Text>
      </View>
    );
  }
  if (walletKind(type) === 'CASH') {
    return (
      <View style={styles.chipRow}>
        <PaymentWalletLogo type="CASH" height={height} emojiFallback={false} />
        <Text style={labelStyle}>{label}</Text>
      </View>
    );
  }
  return (
    <View style={styles.chipRow}>
      <Text style={{ fontSize: height }}>{paymentIcon(type)}</Text>
      <Text style={labelStyle}>{label}</Text>
    </View>
  );
}

type SlotProps = {
  type: PaymentType | string | null | undefined;
  height?: number;
  maxWidth?: number;
};

/** Uniform icon column for payment method list cards. */
export function PaymentMethodLogoSlot({
  type,
  height = PAYMENT_METHOD_ROW_LOGO_HEIGHT,
  maxWidth = PAYMENT_METHOD_ROW_LOGO_MAX_WIDTH,
}: SlotProps) {
  return (
    <View style={[styles.logoSlot, { height, minWidth: maxWidth }]}>
      <PaymentWalletLogo type={type} height={height} maxWidth={maxWidth} emojiFallback={false} />
    </View>
  );
}