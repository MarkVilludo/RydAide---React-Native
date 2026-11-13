import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchPaymentMethods, type PaymentWallet } from '../api/paymentMethods';
import { colors } from '../theme/colors';
import { paymentIcon } from '../utils/paymentMethods';

/** 'cash' or a saved wallet id. */
export type HelpPaymentChoice = 'cash' | number;

/**
 * Review-step picker: how the owner plans to pay (cash always available). Defaults to the preferred method.
 * Older servers without wallets: shows cash only.
 */
export function HelpPaymentPicker({
  value,
  onChange,
  onManage,
}: {
  value: HelpPaymentChoice | null;
  onChange: (choice: HelpPaymentChoice) => void;
  onManage: () => void;
}) {
  const [wallets, setWallets] = useState<PaymentWallet[] | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      fetchPaymentMethods()
        .then((data) => {
          if (!alive) return;
          setWallets(data.wallets);
          if (value == null || (typeof value === 'number' && !data.wallets.some((w) => w.id === value))) {
            onChange(data.preferred.payment_method_id ?? 'cash');
          }
        })
        .catch(() => {
          if (!alive) return;
          setWallets([]);
          if (value == null) onChange('cash');
        })
        .finally(() => alive && setLoading(false));
      return () => {
        alive = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const options: Array<{ key: HelpPaymentChoice; type: string; title: string; sub: string }> = [
    { key: 'cash', type: 'CASH', title: 'Cash', sub: 'Pay in person' },
    ...(wallets ?? []).map((w) => ({ key: w.id as HelpPaymentChoice, type: w.type, title: w.label, sub: w.account_number_masked })),
  ];

  return (
    <View style={styles.block}>
      <View style={styles.headRow}>
        <Text style={styles.label}>Payment</Text>
        <Pressable onPress={onManage} hitSlop={8} accessibilityRole="button">
          <Text style={styles.manage}>{wallets && wallets.length > 0 ? 'Manage' : 'Add a wallet'}</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Shown to your mechanic. You pay them directly after the job.</Text>
      {loading && wallets == null ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <View style={styles.chips}>
          {options.map((o) => {
            const on = value === o.key;
            return (
              <Pressable
                key={String(o.key)}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => onChange(o.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.chipTitle, on && styles.chipTitleOn]}>
                  {paymentIcon(o.type)} {o.title}
                </Text>
                <Text style={styles.chipSub}>{o.sub}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  manage: { fontSize: 14, fontWeight: '700', color: colors.primary },
  hint: { fontSize: 12, color: colors.muted, marginTop: 2 },
  loader: { marginTop: 10, alignSelf: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipOn: { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: colors.primarySoft },
  chipTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  chipTitleOn: { color: colors.primaryInk },
  chipSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
});
