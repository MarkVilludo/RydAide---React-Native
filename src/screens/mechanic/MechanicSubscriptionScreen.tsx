import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  cancelMechanicSubscription,
  fetchMechanicSubscription,
  simulateMechanicProPurchaseDev,
  type MechanicSubscriptionDetails,
  type PaymentHistoryItem,
} from '../../api/mechanicSubscription';
import { CenteredLoading } from '../../components/CenteredLoading';
import { MechanicCreditsCard } from '../../components/MechanicCreditsCard';
import { useAppConfig } from '../../hooks/useAppConfig';
import type { MechanicStackParamList } from '../../navigation/types';
import { getApiErrorMessage } from '../../api/client';
import { RydAidRefreshControl } from '../../components/RydAidRefreshControl';
import { logger } from '../../utils/logger';
import {
  isStoreBillingNativeAvailable,
  mechanicProMonthlyProductId,
  mechanicProYearlyProductId,
  purchaseMechanicPro,
  STORE_BILLING_UNAVAILABLE_MESSAGE,
} from '../../services/mechanicProStore';
import { MECHANIC_PRO_SUBSCRIPTION_ID } from '../../constants/storeBilling';
import { isMechanicProPlanCode } from '../../utils/mechanicProPricing';

type Props = NativeStackScreenProps<MechanicStackParamList, 'MechanicSubscription'>;

export function MechanicSubscriptionScreen(_props: Props) {
  const { config } = useAppConfig();
  const proMonthlyPrice = config?.mechanic_monetization.pro_monthly_price_php ?? 99;
  const proYearlyPrice = config?.mechanic_monetization.pro_yearly_price_php;
  const monthlyStoreId =
    Platform.OS === 'ios'
      ? config?.mechanic_monetization.store_product_ids?.ios
      : config?.mechanic_monetization.store_product_ids?.android;
  const yearlyStoreId =
    Platform.OS === 'ios'
      ? config?.mechanic_monetization.store_product_ids?.ios_yearly
      : config?.mechanic_monetization.store_product_ids?.android_yearly;

  const fallbackMonthly = mechanicProMonthlyProductId() ?? MECHANIC_PRO_SUBSCRIPTION_ID;
  const fallbackYearly = mechanicProYearlyProductId();

  const resolvedMonthlyId = monthlyStoreId?.trim() || fallbackMonthly;
  const resolvedYearlyId = yearlyStoreId?.trim() || fallbackYearly;
  const yearlyAvailable = resolvedYearlyId.length > 0;

  const yearlySavingsPct = useMemo(() => {
    if (!proYearlyPrice || !proMonthlyPrice || proMonthlyPrice <= 0 || proYearlyPrice <= 0) return null;
    const full = proMonthlyPrice * 12;
    if (full <= proYearlyPrice) return null;
    return Math.round(((full - proYearlyPrice) / full) * 100);
  }, [proMonthlyPrice, proYearlyPrice]);

  const [dashboard, setDashboard] = useState<MechanicSubscriptionDetails | null>(null);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [billingCycle, setBillingCycle] = useState<'month' | 'year'>('month');
  const [loading, setLoading] = useState(true);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const productIdForPurchase = billingCycle === 'year' && yearlyAvailable ? resolvedYearlyId : resolvedMonthlyId;

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await fetchMechanicSubscription();
      setDashboard(data.subscription);
      setHistory(data.payment_history ?? []);
    } catch {
      setDashboard(null);
      setHistory([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const isPro = dashboard?.billing_status === 'ACTIVE';
  const onYearlyPlan =
    isPro &&
    isMechanicProPlanCode(dashboard?.plan_code) &&
    (dashboard?.billing_interval?.toLowerCase() === 'year' || dashboard?.plan_code === 'MECHANIC_PRO_YEARLY');
  const onMonthlyPlan =
    isPro &&
    isMechanicProPlanCode(dashboard?.plan_code) &&
    !onYearlyPlan;
  const simulateEnabled = config?.mechanic_monetization?.simulate_purchase_enabled === true;

  useEffect(() => {
    if (!dashboard || !isPro) return;
    if (onYearlyPlan) {
      setBillingCycle('year');
    } else if (onMonthlyPlan) {
      setBillingCycle('month');
    }
  }, [dashboard, isPro, onMonthlyPlan, onYearlyPlan]);

  const onSimulateDevPurchase = async () => {
    setPurchaseBusy(true);
    try {
      await simulateMechanicProPurchaseDev(
        productIdForPurchase,
        Platform.OS === 'ios' ? 'ios' : 'android',
      );
      await load(true);
      Alert.alert('Mechanic Pro (dev)', 'Simulated payment applied. You can accept HELP requests again.');
    } catch (e) {
      logger.error('Subscription', 'Dev simulate purchase failed', e);
      Alert.alert('Simulation failed', getApiErrorMessage(e));
    } finally {
      setPurchaseBusy(false);
    }
  };

  const storeBillingReady = isStoreBillingNativeAvailable();

  const onSubscribe = async (overrideProductId?: string) => {
    if (!storeBillingReady) {
      Alert.alert('Install RydAid app build', STORE_BILLING_UNAVAILABLE_MESSAGE);
      return;
    }

    const pid =
      overrideProductId ??
      (billingCycle === 'year' && yearlyAvailable ? resolvedYearlyId : resolvedMonthlyId);

    setPurchaseBusy(true);
    try {
      await purchaseMechanicPro(pid);
      await load(true);
      Alert.alert('Mechanic Pro', 'Your subscription is being activated. Pull to refresh if status does not update yet.');
    } catch (e) {
      logger.error('Subscription', 'Store purchase failed', e);
      Alert.alert('Purchase failed', getApiErrorMessage(e));
    } finally {
      setPurchaseBusy(false);
    }
  };

  const onUpgradeToYearly = () => {
    if (!yearlyAvailable || !resolvedYearlyId) {
      Alert.alert('Yearly plan', 'Yearly billing is not configured yet. Check with support.');
      return;
    }
    Alert.alert(
      'Upgrade to yearly',
      `Your store will charge the yearly rate (about ₱${proYearlyPrice ?? '—'}/yr). Any unused time on your monthly plan may be credited by ${Platform.OS === 'ios' ? 'Apple' : 'Google'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => void onSubscribe(resolvedYearlyId) },
      ],
    );
  };

  const onCancel = () => {
    Alert.alert(
      'Manage subscription',
      'Renewals are managed in the App Store or Google Play subscription settings on your device. You can also mark cancellation in RydAid (local status only).',
      [
        { text: 'Close', style: 'cancel' },
        {
          text: 'Mark cancelled here',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelMechanicSubscription();
              await load(true);
            } catch (e) {
              logger.error('Subscription', 'Cancel subscription failed', e);
              Alert.alert('Could not update', getApiErrorMessage(e));
            }
          },
        },
      ],
    );
  };

  if (loading && !dashboard) {
    return <CenteredLoading message="Loading subscription…" />;
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      alwaysBounceVertical={Platform.OS === 'ios'}
      refreshControl={
        <RydAidRefreshControl refreshing={refreshing} onRefresh={() => load(true)} title="Pull to refresh" />
      }
    >
      <Text style={styles.title}>Mechanic Pro</Text>
      <Text style={styles.subtitle}>
        {Platform.OS === 'ios' ? 'App Store' : Platform.OS === 'android' ? 'Google Play' : 'In-app'} subscription
      </Text>

      <MechanicCreditsCard
        dashboard={dashboard}
        entitlementsRemaining={dashboard?.free_credits.remaining}
        entitlementsTotal={dashboard?.free_credits.total}
        isPro={isPro}
        proMonthlyPrice={proMonthlyPrice}
        proYearlyPrice={proYearlyPrice}
        onSubscribe={() => void onSubscribe()}
      />

      {yearlyAvailable && proYearlyPrice != null && proYearlyPrice > 0 ? (
        <View style={styles.pricingSection}>
          <Text style={styles.pricingSectionTitle}>Pricing options</Text>
          <Text style={styles.pricingSectionHint}>Amounts match your admin settings; the store may show local pricing.</Text>
          <View style={styles.planRow}>
            <Pressable
              style={[styles.planCard, billingCycle === 'month' && styles.planCardOn, onMonthlyPlan && isPro && styles.planCardCurrent]}
              onPress={() => setBillingCycle('month')}
              disabled={isPro}
            >
              <Text style={styles.planCardTitle}>Monthly</Text>
              <Text style={styles.planCardPrice}>₱{proMonthlyPrice}</Text>
              <Text style={styles.planCardUnit}>per month</Text>
              {onMonthlyPlan && isPro ? <Text style={styles.planBadge}>Current plan</Text> : null}
            </Pressable>
            <Pressable
              style={[styles.planCard, billingCycle === 'year' && styles.planCardOn, onYearlyPlan && isPro && styles.planCardCurrent]}
              onPress={() => setBillingCycle('year')}
              disabled={isPro}
            >
              <Text style={styles.planCardTitle}>Yearly</Text>
              <Text style={styles.planCardPrice}>₱{proYearlyPrice}</Text>
              <Text style={styles.planCardUnit}>per year</Text>
              {yearlySavingsPct != null ? (
                <Text style={styles.planSavings}>Save ~{yearlySavingsPct}% vs 12× monthly</Text>
              ) : null}
              {onYearlyPlan && isPro ? <Text style={styles.planBadge}>Current plan</Text> : null}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.pricingSection}>
          <Text style={styles.pricingSectionTitle}>Mechanic Pro</Text>
          <Text style={styles.pricingSectionHint}>
            ₱{proMonthlyPrice}/month. {yearlyAvailable ? 'Yearly CMS price not set — add it in admin.' : 'Add a yearly plan and store SKUs to offer yearly billing.'}
          </Text>
        </View>
      )}

      {isPro && onMonthlyPlan && yearlyAvailable ? (
        <Pressable
          style={[styles.upgradeBtn, purchaseBusy && styles.btnDisabled]}
          disabled={purchaseBusy}
          onPress={onUpgradeToYearly}
        >
          <Text style={styles.upgradeBtnTitle}>Upgrade to yearly</Text>
          <Text style={styles.upgradeBtnSub}>
            {proYearlyPrice != null ? `About ₱${proYearlyPrice}/yr in the store` : 'See Play / App Store for price'}
          </Text>
        </Pressable>
      ) : null}

      {isPro && onYearlyPlan ? (
        <View style={styles.note}>
          <Text style={styles.noteText}>
            You are on the yearly plan. To change or cancel, use subscription settings in the {Platform.OS === 'ios' ? 'App Store' : 'Google Play Store'}.
          </Text>
        </View>
      ) : null}

      {!isPro && yearlyAvailable ? (
        <View style={styles.cycleRow}>
          <Pressable
            style={[styles.cycleChip, billingCycle === 'month' && styles.cycleChipOn]}
            onPress={() => setBillingCycle('month')}
          >
            <Text style={[styles.cycleChipText, billingCycle === 'month' && styles.cycleChipTextOn]}>Monthly</Text>
            <Text style={[styles.cycleSub, billingCycle === 'month' && styles.cycleSubOn]}>₱{proMonthlyPrice}/mo</Text>
          </Pressable>
          <Pressable
            style={[styles.cycleChip, billingCycle === 'year' && styles.cycleChipOn]}
            onPress={() => setBillingCycle('year')}
          >
            <Text style={[styles.cycleChipText, billingCycle === 'year' && styles.cycleChipTextOn]}>Yearly</Text>
            <Text style={[styles.cycleSub, billingCycle === 'year' && styles.cycleSubOn]}>
              ₱{proYearlyPrice ?? '—'}/yr
            </Text>
          </Pressable>
        </View>
      ) : null}

      {!isPro && simulateEnabled ? (
        <Pressable
          style={[styles.devSimBtn, purchaseBusy && styles.btnDisabled]}
          disabled={purchaseBusy}
          onPress={() => void onSimulateDevPurchase()}
        >
          <Text style={styles.devSimBtnText}>Simulate payment (local dev — no GCash / store charge)</Text>
        </Pressable>
      ) : null}

      {!isPro ? (
        <Pressable
          style={[styles.primaryBtn, purchaseBusy && styles.btnDisabled]}
          disabled={purchaseBusy}
          onPress={() => void onSubscribe()}
        >
          {purchaseBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {simulateEnabled
                ? 'Subscribe via App Store / Play (requires EAS build)'
                : `Subscribe — ${billingCycle === 'year' && yearlyAvailable ? 'Yearly' : 'Monthly'} via ${Platform.OS === 'ios' ? 'App Store' : 'Google Play'}`}
            </Text>
          )}
        </Pressable>
      ) : (
        <Pressable style={styles.secondaryBtn} onPress={onCancel}>
          <Text style={styles.secondaryBtnText}>Manage subscription</Text>
        </Pressable>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What stays free</Text>
        <Text style={styles.body}>Directory listing, incoming offers, browsing, and declining requests.</Text>
      </View>

      <View style={styles.note}>
        <Text style={styles.noteText}>
          Store product ID: {productIdForPurchase}. Price in the store may differ from CMS amounts. Use sandbox testers
          for TestFlight/internal builds.
          {!yearlyAvailable ? ' Yearly billing appears when yearly product IDs are set on the server and in the app env.' : ''}
        </Text>
      </View>

      {history.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment history</Text>
          {history.map((item) => (
            <View key={item.id} style={styles.historyRow}>
              <Text style={styles.historyMain}>
                ₱{item.amount} · {item.status}
              </Text>
              <Text style={styles.historySub}>{item.payment_reference}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 16, fontWeight: '600', color: '#0284c7', marginTop: 6, marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  body: { fontSize: 15, lineHeight: 22, color: '#475569' },
  cycleRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  cycleChip: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  cycleChipOn: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  cycleChipText: { fontSize: 15, fontWeight: '700', color: '#64748b' },
  cycleChipTextOn: { color: '#0f172a' },
  cycleSub: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  cycleSubOn: { color: '#0369a1' },
  pricingSection: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pricingSectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  pricingSectionHint: { fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 17, marginBottom: 12 },
  planRow: { flexDirection: 'row', gap: 10 },
  planCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  planCardOn: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  planCardCurrent: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  planCardTitle: { fontSize: 13, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4 },
  planCardPrice: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginTop: 6 },
  planCardUnit: { fontSize: 12, color: '#64748b', marginTop: 2 },
  planSavings: { fontSize: 11, fontWeight: '700', color: '#059669', marginTop: 8 },
  planBadge: { marginTop: 8, fontSize: 11, fontWeight: '800', color: '#15803d' },
  upgradeBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  upgradeBtnTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  upgradeBtnSub: { color: '#94a3b8', fontSize: 12, marginTop: 4, textAlign: 'center' },
  note: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  noteText: { fontSize: 14, lineHeight: 20, color: '#475569' },
  devSimBtn: {
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  devSimBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: '#0070f3',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnDisabled: { opacity: 0.7 },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  secondaryBtnText: { color: '#64748b', fontWeight: '600' },
  historyRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  historyMain: { fontWeight: '600', color: '#0f172a' },
  historySub: { fontSize: 12, color: '#64748b', marginTop: 2 },
});
