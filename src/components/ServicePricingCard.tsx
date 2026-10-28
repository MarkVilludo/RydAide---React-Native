import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type ServiceJobPricing = {
  quoted_service_amount_php?: number | null;
  quote_status?: string;
  quote_description?: string | null;
  final_service_amount_php?: number | null;
  payment_status?: string;
  platform_assistance_fee_php?: number;
  mechanic_commission_php?: number;
  mechanic_net_earnings_php?: number;
  preview?: {
    fee_model?: string;
    breakdown?: {
      service_amount_php?: number;
      assistance_fee_php?: number;
      rider_total_php?: number;
      platform_revenue_php?: number;
      mechanic_net_earnings_php?: number;
    };
  } | null;
  require_quote_before_work?: boolean;
};

type Props = {
  pricing: ServiceJobPricing | null | undefined;
  viewerRole: 'owner' | 'mechanic';
  onAcceptQuote?: () => void;
  onRejectQuote?: () => void;
  acting?: boolean;
};

function peso(amount?: number | null) {
  if (amount == null) return '—';
  return `₱${amount.toLocaleString('en-PH')}`;
}

export function ServicePricingCard({
  pricing,
  viewerRole,
  onAcceptQuote,
  onRejectQuote,
  acting,
}: Props) {
  if (!pricing) return null;

  const breakdown = pricing.preview?.breakdown;
  const pendingQuote = pricing.quote_status === 'pending';

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Service pricing</Text>
      {pricing.quote_description ? (
        <Text style={styles.muted}>{pricing.quote_description}</Text>
      ) : null}
      <Text style={styles.row}>
        Quote: {peso(pricing.quoted_service_amount_php)}{' '}
        <Text style={styles.badge}>{pricing.quote_status ?? 'none'}</Text>
      </Text>
      {breakdown && (
        <>
          <Text style={styles.row}>Service amount: {peso(breakdown.service_amount_php)}</Text>
          {(breakdown.assistance_fee_php ?? 0) > 0 && (
            <Text style={styles.row}>Platform assistance fee: {peso(breakdown.assistance_fee_php)}</Text>
          )}
          <Text style={styles.row}>Estimated rider total: {peso(breakdown.rider_total_php)}</Text>
        </>
      )}
      {pricing.final_service_amount_php != null && (
        <Text style={styles.final}>Final service: {peso(pricing.final_service_amount_php)}</Text>
      )}
      <Text style={styles.payment}>Payment: {pricing.payment_status ?? 'pending'}</Text>

      {viewerRole === 'owner' && pendingQuote && onAcceptQuote && onRejectQuote && (
        <View style={styles.actions}>
          <Pressable style={styles.accept} disabled={acting} onPress={onAcceptQuote}>
            <Text style={styles.btnText}>Accept quote</Text>
          </Pressable>
          <Pressable style={styles.reject} disabled={acting} onPress={onRejectQuote}>
            <Text style={styles.rejectText}>Decline</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  title: { fontWeight: '800', fontSize: 16, marginBottom: 6 },
  muted: { color: '#64748b', marginBottom: 8 },
  row: { color: '#334155', marginTop: 4 },
  badge: { fontSize: 12, color: '#0369a1', fontWeight: '700', textTransform: 'uppercase' },
  final: { marginTop: 8, fontWeight: '700' },
  payment: { marginTop: 6, color: '#475569', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  accept: {
    flex: 1,
    backgroundColor: '#16a34a',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  reject: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700' },
  rejectText: { color: '#64748b', fontWeight: '600' },
});
