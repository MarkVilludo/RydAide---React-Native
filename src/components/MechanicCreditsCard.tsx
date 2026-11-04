import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MechanicSubscriptionDetails } from '../api/mechanicSubscription';

type Props = {
  dashboard: MechanicSubscriptionDetails | null;
  entitlementsRemaining: number | null | undefined;
  entitlementsTotal: number | null | undefined;
  isPro: boolean;
  proPrice: number;
  onSubscribe: () => void;
};

export function MechanicCreditsCard({
  dashboard,
  entitlementsRemaining,
  entitlementsTotal,
  isPro,
  proPrice,
  onSubscribe,
}: Props) {
  const total = dashboard?.free_credits.total ?? entitlementsTotal ?? 5;
  const remaining = dashboard?.free_credits.remaining ?? entitlementsRemaining ?? total;
  const billingStatus = dashboard?.billing_status;

  if (isPro || billingStatus === 'ACTIVE') {
    return (
      <View style={[styles.card, styles.cardPro]}>
        <Text style={styles.badge}>PRO MECHANIC</Text>
        <Text style={styles.title}>Subscription: ACTIVE</Text>
        <Text style={styles.price}>₱{proPrice}/month</Text>
        <Text style={styles.body}>Unlimited eligible HELP request acceptances.</Text>
        {dashboard?.subscription?.expires_at ? (
          <Text style={styles.meta}>Renews / expires: {new Date(dashboard.subscription.expires_at).toLocaleDateString()}</Text>
        ) : null}
      </View>
    );
  }

  if (remaining <= 0) {
    return (
      <View style={[styles.card, styles.cardWarn]}>
        <Text style={styles.badge}>FREE CREDITS USED</Text>
        <Text style={styles.title}>
          {remaining} / {total} remaining
        </Text>
        <Text style={styles.body}>
          Your free HELP request credits have been used. Subscribe to Pro for ₱{proPrice}/month to continue accepting
          customer requests.
        </Text>
        <Pressable style={styles.cta} onPress={onSubscribe}>
          <Text style={styles.ctaText}>Subscribe in app</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.badge}>NEW MECHANIC</Text>
      <Text style={styles.title}>Free HELP Credits</Text>
      <Text style={styles.count}>
        {remaining} / {total} remaining
      </Text>
      <Text style={styles.body}>You can accept {remaining} customer HELP request{remaining === 1 ? '' : 's'} for free.</Text>
      <Text style={styles.hint}>After using your free credits, upgrade to Pro for ₱{proPrice}/month.</Text>
      <Pressable style={styles.linkBtn} onPress={onSubscribe}>
        <Text style={styles.linkText}>View Mechanic Pro</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardPro: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  cardWarn: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  badge: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#64748b',
    marginBottom: 6,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  count: { fontSize: 28, fontWeight: '800', color: '#0284c7', marginVertical: 6 },
  price: { fontSize: 18, fontWeight: '700', color: '#0284c7', marginVertical: 4 },
  body: { fontSize: 14, lineHeight: 20, color: '#475569', marginTop: 4 },
  hint: { fontSize: 13, color: '#64748b', marginTop: 8 },
  meta: { fontSize: 12, color: '#64748b', marginTop: 8 },
  cta: {
    marginTop: 14,
    backgroundColor: '#0070f3',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  linkBtn: { marginTop: 10 },
  linkText: { color: '#0284c7', fontWeight: '600', fontSize: 14 },
});
