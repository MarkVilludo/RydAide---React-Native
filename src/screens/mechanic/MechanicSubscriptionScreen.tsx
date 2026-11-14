import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchMechanicSubscription,
  simulateMechanicProPurchaseDev,
  type MechanicSubscriptionDetails,
  type PaymentHistoryItem,
} from '../../api/mechanicSubscription';
import { fetchEntitlements } from '../../api/auth';
import type { Entitlements } from '../../api/types';
import { CenteredLoading } from '../../components/CenteredLoading';
import { useAppConfig } from '../../hooks/useAppConfig';
import type { MechanicStackParamList } from '../../navigation/types';
import { getApiAuthToken, getApiErrorMessage, isUnauthenticatedError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { RydAidRefreshControl } from '../../components/RydAidRefreshControl';
import { logger } from '../../utils/logger';
import {
  isStoreBillingNativeAvailable,
  mechanicProMonthlyProductId,
  mechanicProYearlyProductId,
  purchaseMechanicPro,
  restoreMechanicProPurchases,
  STORE_BILLING_UNAVAILABLE_MESSAGE,
} from '../../services/mechanicProStore';
import { useMechanicProStorePrices } from '../../hooks/useMechanicProStorePrices';
import { MECHANIC_PRO_SUBSCRIPTION_ID } from '../../constants/storeBilling';
import {
  MECHANIC_PRO_MONTHLY_PRICE_PHP,
  MECHANIC_PRO_YEARLY_PRICE_PHP,
  formatPhpAmount,
  isMechanicProPlanCode,
  resolvePriceLabel,
  yearlySavingsVsMonthly,
} from '../../utils/mechanicProPricing';

type Props = NativeStackScreenProps<MechanicStackParamList, 'MechanicSubscription'>;

const C = {
  brand: '#0284c7',
  brandDark: '#0369a1',
  brandSoft: '#e0f2fe',
  ink: '#0f172a',
  muted: '#475569',
  faint: '#64748b',
  line: '#e2e8f0',
  bg: '#f8fafc',
  ok: '#16a34a',
  okSoft: '#dcfce7',
  bad: '#dc2626',
  badSoft: '#fee2e2',
  warn: '#b45309',
  warnSoft: '#fef3c7',
};

const STORE_NAME = Platform.OS === 'ios' ? 'App Store' : 'Google Play';
const STORE_ACCOUNT = Platform.OS === 'ios' ? 'Apple ID' : 'Google account';
const MANAGE_URL =
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';

type PlanState =
  | { kind: 'pro'; title: string; detail: string }
  | { kind: 'pending'; title: string; detail: string }
  | { kind: 'failed'; title: string; detail: string }
  | { kind: 'ended'; title: string; detail: string }
  | { kind: 'free'; title: string; detail: string }
  | { kind: 'free_unlimited'; title: string; detail: string };

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isFuture(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t > Date.now();
}

export function MechanicSubscriptionScreen(_props: Props) {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { config } = useAppConfig();
  const cmsMonthlyPrice = config?.mechanic_monetization.pro_monthly_price_php ?? MECHANIC_PRO_MONTHLY_PRICE_PHP;
  const cmsYearlyPrice = config?.mechanic_monetization.pro_yearly_price_php ?? MECHANIC_PRO_YEARLY_PRICE_PHP;
  const monthlyStoreId =
    Platform.OS === 'ios'
      ? config?.mechanic_monetization.store_product_ids?.ios
      : config?.mechanic_monetization.store_product_ids?.android;
  const yearlyStoreId =
    Platform.OS === 'ios'
      ? config?.mechanic_monetization.store_product_ids?.ios_yearly
      : config?.mechanic_monetization.store_product_ids?.android_yearly;

  const resolvedMonthlyId = monthlyStoreId?.trim() || mechanicProMonthlyProductId() || MECHANIC_PRO_SUBSCRIPTION_ID;
  const resolvedYearlyId = yearlyStoreId?.trim() || mechanicProYearlyProductId();
  const yearlyConfigured = resolvedYearlyId.length > 0;

  const { storePrices, storePricesLoading } = useMechanicProStorePrices(
    resolvedMonthlyId,
    yearlyConfigured ? resolvedYearlyId : undefined,
  );

  // Store price is what Google Play / App Store will charge. CMS amount is only an estimate.
  const monthlyLabel = resolvePriceLabel(storePrices.monthly?.displayPrice, cmsMonthlyPrice);
  const yearlyLabel = resolvePriceLabel(storePrices.yearly?.displayPrice, cmsYearlyPrice);
  const monthlyFromStore = Boolean(storePrices.monthly?.displayPrice);
  const yearlyFromStore = Boolean(storePrices.yearly?.displayPrice);
  // Show yearly even when the store SKU isn't configured yet, using the CMS / website price.
  const showYearly = yearlyLabel != null;

  const yearlySavings = useMemo(() => {
    // Only compare like with like: both store prices, or both CMS amounts.
    const m = monthlyFromStore && yearlyFromStore ? storePrices.monthly?.price : !monthlyFromStore && !yearlyFromStore ? cmsMonthlyPrice : null;
    const y = monthlyFromStore && yearlyFromStore ? storePrices.yearly?.price : !monthlyFromStore && !yearlyFromStore ? cmsYearlyPrice : null;
    return yearlySavingsVsMonthly(m, y);
  }, [monthlyFromStore, yearlyFromStore, storePrices, cmsMonthlyPrice, cmsYearlyPrice]);

  const [dashboard, setDashboard] = useState<MechanicSubscriptionDetails | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [billingCycle, setBillingCycle] = useState<'month' | 'year'>('month');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [busy, setBusy] = useState<null | 'buy' | 'restore' | 'sim'>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    // Token is set during AuthProvider bootstrap before this screen can mount.
    // If it is missing or the server later rejects it, skip a red error box.
    if (!getApiAuthToken()) {
      logger.warn('Subscription', 'Skipped subscription load — no auth token');
      if (!mounted.current) return;
      setSessionExpired(true);
      setLoadError('Session expired, please sign in again');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const [sub, ent] = await Promise.allSettled([fetchMechanicSubscription(), fetchEntitlements()]);
    if (!mounted.current) return;
    if (sub.status === 'fulfilled') {
      setDashboard(sub.value.subscription);
      setHistory(sub.value.payment_history ?? []);
      setLoadError(null);
      setSessionExpired(false);
    } else if (isUnauthenticatedError(sub.reason)) {
      logger.warn('Subscription', 'Load subscription failed — unauthenticated (401)');
      setSessionExpired(true);
      setLoadError('Session expired, please sign in again');
    } else {
      logger.error('Subscription', 'Load subscription failed', sub.reason);
      setSessionExpired(false);
      setLoadError(getApiErrorMessage(sub.reason));
    }
    if (ent.status === 'fulfilled') {
      setEntitlements(ent.value);
    } else if (isUnauthenticatedError(ent.reason)) {
      logger.warn('Subscription', 'Load entitlements failed — unauthenticated (401)');
      setSessionExpired(true);
      if (sub.status !== 'fulfilled') {
        setLoadError('Session expired, please sign in again');
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const status = dashboard?.billing_status;
  const sub = dashboard?.subscription ?? null;
  const isPro = status === 'ACTIVE';
  const onYearlyPlan =
    isPro &&
    isMechanicProPlanCode(dashboard?.plan_code) &&
    (dashboard?.billing_interval?.toLowerCase() === 'year' || dashboard?.plan_code === 'MECHANIC_PRO_YEARLY');
  const onMonthlyPlan = isPro && !onYearlyPlan;
  const simulateEnabled = config?.mechanic_monetization?.simulate_purchase_enabled === true;
  const storeReady = isStoreBillingNativeAvailable();

  const freeTotal = dashboard?.free_credits.total ?? entitlements?.accepted_requests?.limit ?? null;
  const freeLeft = dashboard?.free_credits.remaining ?? null;
  const unlimitedAccepts =
    entitlements?.accepted_requests?.unlimited ?? entitlements?.unlimited_accepted_requests ?? false;
  /** Server isn't enforcing the free limit right now (and mechanic isn't Pro). */
  const limitsOff = !isPro && entitlements != null && unlimitedAccepts;

  useEffect(() => {
    if (onYearlyPlan) setBillingCycle('year');
    else if (onMonthlyPlan) setBillingCycle('month');
  }, [onMonthlyPlan, onYearlyPlan]);

  const plan: PlanState = useMemo(() => {
    if (isPro) {
      const renew = formatDate(sub?.next_billing_at);
      const ends = formatDate(sub?.expires_at);
      const cycle = onYearlyPlan ? 'Yearly' : 'Monthly';
      return {
        kind: 'pro',
        title: 'Mechanic Pro is active',
        detail: renew
          ? `${cycle} plan · renews ${renew}`
          : ends
            ? `${cycle} plan · current period ends ${ends}`
            : `${cycle} plan · billed through ${STORE_NAME}`,
      };
    }
    if (status === 'PAYMENT_PENDING') {
      return {
        kind: 'pending',
        title: 'Confirming your payment',
        detail: `${STORE_NAME} is still processing it. Pull down to refresh in a moment.`,
      };
    }
    if (status === 'PAYMENT_FAILED') {
      return {
        kind: 'failed',
        title: "Payment didn't go through",
        detail: `Check your payment method in ${STORE_NAME}, then subscribe again.`,
      };
    }
    if (sub && (status === 'CANCELLED' || status === 'EXPIRED')) {
      const when = formatDate(status === 'CANCELLED' ? sub.cancelled_at : sub.expires_at);
      const prefix = status === 'CANCELLED' ? 'Cancelled' : 'Ended';
      return {
        kind: 'ended',
        title: 'Mechanic Pro has ended',
        detail: `${when ? `${prefix} ${when}. ` : ''}${
          freeLeft && freeLeft > 0
            ? `You have ${freeLeft} free request${freeLeft === 1 ? '' : 's'} left.`
            : 'Subscribe again to keep accepting requests.'
        }`,
      };
    }
    if (limitsOff) {
      return {
        kind: 'free_unlimited',
        title: 'Free plan',
        detail:
          freeLeft != null && freeTotal != null
            ? `${freeLeft} of ${freeTotal} free requests left. Free credits aren't used right now.`
            : "Free credits aren't used right now.",
      };
    }
    if (freeLeft != null && freeLeft <= 0) {
      return {
        kind: 'free',
        title: `You've used your ${freeTotal ?? ''} free requests`.replace('  ', ' '),
        detail: 'You can still see and decline offers. Get Mechanic Pro to accept them.',
      };
    }
    return {
      kind: 'free',
      title: 'Free plan',
      detail:
        freeLeft != null && freeTotal != null
          ? `${freeLeft} of ${freeTotal} free requests left. Free requests are one-time and don't reset.`
          : 'Free requests are one-time and don\u2019t reset.',
    };
  }, [isPro, status, sub, onYearlyPlan, limitsOff, freeLeft, freeTotal]);

  const yearlySelected = billingCycle === 'year' && showYearly;
  const canPurchaseYearly = yearlySelected && yearlyConfigured;
  const selectedProductId = canPurchaseYearly ? resolvedYearlyId : resolvedMonthlyId;
  const selectedLabel = yearlySelected ? yearlyLabel : monthlyLabel;
  const selectedFromStore = yearlySelected ? yearlyFromStore : monthlyFromStore;
  const selectedUnit = yearlySelected ? 'year' : 'month';
  const yearlyCheckoutUnavailable = yearlySelected && !yearlyConfigured;

  const subscribe = async (productId: string) => {
    if (!storeReady) {
      Alert.alert(`${STORE_NAME} not available`, STORE_BILLING_UNAVAILABLE_MESSAGE);
      return;
    }
    setBusy('buy');
    try {
      await purchaseMechanicPro(productId);
      await load(true);
      Alert.alert('Thanks!', 'Mechanic Pro is being activated. If it still shows Free, pull down to refresh.');
    } catch (e) {
      logger.error('Subscription', 'Store purchase failed', e);
      Alert.alert('Purchase not completed', getApiErrorMessage(e));
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const restore = async () => {
    if (!storeReady) {
      Alert.alert(`${STORE_NAME} not available`, STORE_BILLING_UNAVAILABLE_MESSAGE);
      return;
    }
    setBusy('restore');
    try {
      const found = await restoreMechanicProPurchases(
        [resolvedMonthlyId, yearlyConfigured ? resolvedYearlyId : ''].filter(Boolean),
      );
      await load(true);
      Alert.alert(
        found > 0 ? 'Purchase restored' : 'Nothing to restore',
        found > 0
          ? 'We found your Mechanic Pro purchase. If it still shows Free, pull down to refresh.'
          : `No Mechanic Pro subscription was found for the ${STORE_ACCOUNT} on this device.`,
      );
    } catch (e) {
      logger.error('Subscription', 'Restore purchases failed', e);
      Alert.alert('Could not restore', getApiErrorMessage(e));
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const openManage = async () => {
    try {
      await Linking.openURL(MANAGE_URL);
    } catch {
      Alert.alert(
        'Manage subscription',
        Platform.OS === 'ios'
          ? 'Open Settings › your name › Subscriptions.'
          : 'Open Google Play › Profile › Payments & subscriptions › Subscriptions.',
      );
    }
  };

  const switchToYearly = () => {
    Alert.alert(
      'Switch to yearly',
      `${STORE_NAME} will show the yearly price${yearlyLabel ? ` (${yearlyLabel})` : ''} and how unused monthly time is handled before you confirm.`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Continue', onPress: () => void subscribe(resolvedYearlyId) },
      ],
    );
  };

  const simulate = async () => {
    setBusy('sim');
    try {
      await simulateMechanicProPurchaseDev(selectedProductId, Platform.OS === 'ios' ? 'ios' : 'android');
      await load(true);
      Alert.alert('Mechanic Pro (dev)', 'Simulated payment applied.');
    } catch (e) {
      logger.error('Subscription', 'Dev simulate purchase failed', e);
      Alert.alert('Simulation failed', getApiErrorMessage(e));
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  if (loading && !dashboard && !loadError) {
    return <CenteredLoading message="Loading your plan…" />;
  }

  const canBuy = !isPro && status !== 'PAYMENT_PENDING';
  const priceUnavailable = !storePricesLoading && selectedLabel == null;
  const primary = isPro
    ? { label: `Manage in ${STORE_NAME}`, hint: `Opens ${STORE_NAME} subscriptions`, onPress: () => void openManage(), disabled: false }
    : status === 'PAYMENT_PENDING'
      ? { label: 'Refresh status', hint: 'Checks whether your payment went through', onPress: () => void load(true), disabled: false }
      : yearlyCheckoutUnavailable
        ? {
            label: yearlyLabel ? `Yearly · ${yearlyLabel}/year` : 'Yearly billing',
            hint: 'Yearly checkout is not in the store yet. Choose Monthly to subscribe now.',
            onPress: () => {},
            disabled: true,
          }
        : sessionExpired
          ? {
              label: 'Sign in again to subscribe',
              hint: 'Your session expired. Sign in again, then subscribe.',
              onPress: () => void signOut(),
              disabled: false,
            }
          : {
              label:
                selectedLabel && !storePricesLoading
                  ? `Subscribe · ${selectedLabel}/${selectedUnit}`
                  : 'Subscribe to Mechanic Pro',
              hint: `Opens ${STORE_NAME} to confirm the price and pay`,
              onPress: () => void subscribe(selectedProductId),
              disabled: false,
            };

  const tone =
    plan.kind === 'pro'
      ? styles.statusOk
      : plan.kind === 'failed' || (plan.kind === 'free' && freeLeft != null && freeLeft <= 0)
        ? styles.statusBad
        : plan.kind === 'pending' || plan.kind === 'ended' || (plan.kind === 'free' && freeLeft != null && freeLeft <= 2)
          ? styles.statusWarn
          : styles.statusNeutral;
  const pillText =
    plan.kind === 'pro' ? 'PRO' : plan.kind === 'pending' ? 'PENDING' : plan.kind === 'failed' ? 'ACTION NEEDED' : plan.kind === 'ended' ? 'ENDED' : 'FREE';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
      alwaysBounceVertical={Platform.OS === 'ios'}
      refreshControl={<RydAidRefreshControl refreshing={refreshing} onRefresh={() => load(true)} title="Pull to refresh" />}
    >
      {/* Hero: what Pro changes, from the server's real rules only. */}
      <View style={styles.hero} accessibilityRole="header">
        <Text style={styles.heroEyebrow}>MECHANIC PRO</Text>
        <Text style={styles.heroTitle}>Accept every request you want</Text>
        <Text style={styles.heroSub}>
          {freeTotal != null
            ? `The free plan includes ${freeTotal} accepted requests, one time. Pro removes that limit.`
            : 'Pro removes the free accepted-request limit.'}
        </Text>
      </View>

      {loadError && !dashboard ? (
        <View style={[styles.card, styles.errorCard]} accessibilityRole="alert">
          <Text style={styles.cardTitle}>{sessionExpired ? 'Session expired' : "Couldn't load your plan"}</Text>
          <Text style={styles.body}>
            {sessionExpired
              ? 'Please sign in again to load your plan. Monthly and yearly prices are still shown below.'
              : loadError}
          </Text>
          <View style={styles.secondaryRow}>
            <Pressable
              style={styles.linkBtn}
              onPress={() => void load()}
              accessibilityRole="button"
              accessibilityLabel="Try loading your plan again"
            >
              <Text style={styles.linkBtnText}>Try again</Text>
            </Pressable>
            {sessionExpired ? (
              <Pressable
                style={styles.linkBtn}
                onPress={() => void signOut()}
                accessibilityRole="button"
                accessibilityLabel="Sign in again"
              >
                <Text style={styles.linkBtnText}>Sign in again</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : (
        <View
          style={[styles.card, styles.statusCard, tone]}
          accessible
          accessibilityLabel={`Your plan. ${plan.title}. ${plan.detail}`}
        >
          <View style={styles.statusHead}>
            <Text style={styles.statusLabel}>Your plan</Text>
            <View style={[styles.pill, plan.kind === 'pro' ? styles.pillOk : styles.pillNeutral]}>
              <Text style={[styles.pillText, plan.kind === 'pro' && styles.pillTextOk]}>{pillText}</Text>
            </View>
          </View>
          <Text style={styles.statusTitle}>{plan.title}</Text>
          <Text style={styles.body}>{plan.detail}</Text>
          {(plan.kind === 'free' || plan.kind === 'free_unlimited') && freeTotal != null && freeTotal > 0 && freeLeft != null ? (
            <View style={styles.meter} importantForAccessibility="no-hide-descendants">
              <View
                style={[
                  styles.meterFill,
                  {
                    width: `${Math.max(0, Math.min(100, ((freeTotal - freeLeft) / freeTotal) * 100))}%`,
                    backgroundColor: freeLeft <= 0 ? C.bad : freeLeft <= 2 ? C.warn : C.brand,
                  },
                ]}
              />
            </View>
          ) : null}
        </View>
      )}

      {/* Free vs Pro */}
      <View style={styles.card}>
        <View style={styles.compareHead}>
          <Text style={[styles.compareCell, styles.compareFeature, styles.compareHeadText]}>What you get</Text>
          <Text style={[styles.compareCell, styles.compareHeadText]}>Free</Text>
          <Text style={[styles.compareCell, styles.compareHeadText, { color: C.brandDark }]}>Pro</Text>
        </View>
        <CompareRow feature="Accept requests" free={freeTotal != null ? `${freeTotal} total` : 'Limited'} pro="Unlimited" />
        <CompareRow feature="See incoming offers" free="✓" pro="✓" />
        <CompareRow feature="Decline requests" free="✓" pro="✓" />
        <CompareRow feature="Directory listing" free="✓" pro="✓" last />
      </View>

      {/* Price + plan choice */}
      {canBuy || (isPro && onMonthlyPlan && showYearly) ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{isPro ? 'Your billing' : 'Choose how to pay'}</Text>
          {storePricesLoading && !monthlyLabel ? (
            <View style={styles.priceLoading} accessibilityLabel="Loading prices">
              <ActivityIndicator color={C.brand} />
              <Text style={styles.bodyMuted}>Getting prices from {STORE_NAME}…</Text>
            </View>
          ) : (
            <View style={styles.planRow} accessibilityRole="radiogroup">
              <PlanOption
                title="Monthly"
                price={monthlyLabel}
                unit="month"
                selected={billingCycle === 'month'}
                current={onMonthlyPlan}
                disabled={isPro}
                onPress={() => setBillingCycle('month')}
              />
              {showYearly ? (
                <PlanOption
                  title="Yearly"
                  price={yearlyLabel}
                  unit="year"
                  note={
                    yearlySavings != null
                      ? `Save ${formatPhpAmount(yearlySavings.amount)} · ${yearlySavings.percent}% less than 12 months`
                      : undefined
                  }
                  selected={billingCycle === 'year'}
                  current={onYearlyPlan}
                  disabled={isPro}
                  onPress={() => setBillingCycle('year')}
                />
              ) : null}
            </View>
          )}
          <Text style={styles.priceNote}>
            {yearlyCheckoutUnavailable
              ? 'Yearly checkout is not in the store yet. The price matches the website so you can compare plans. Choose Monthly to subscribe now.'
              : priceUnavailable
                ? `Price isn't available right now. ${STORE_NAME} shows it before you pay.`
                : selectedFromStore
                  ? `Price from ${STORE_NAME}. Renews each ${selectedUnit} until you cancel.`
                  : `Estimated price. ${STORE_NAME} shows the final price before you pay.`}
          </Text>
        </View>
      ) : null}

      {/* One primary action */}
      <Pressable
        style={({ pressed }) => [
          styles.primaryBtn,
          pressed && !primary.disabled && styles.pressed,
          (busy != null || primary.disabled) && styles.btnDisabled,
        ]}
        disabled={busy != null || primary.disabled}
        onPress={primary.onPress}
        accessibilityRole="button"
        accessibilityLabel={primary.label}
        accessibilityHint={primary.hint}
        accessibilityState={{ disabled: busy != null || primary.disabled, busy: busy === 'buy' }}
      >
        {busy === 'buy' ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{primary.label}</Text>}
      </Pressable>

      <View style={styles.secondaryRow}>
        {isPro && onMonthlyPlan && showYearly && yearlyConfigured ? (
          <Pressable
            style={styles.linkBtn}
            onPress={switchToYearly}
            disabled={busy != null}
            accessibilityRole="button"
            accessibilityLabel="Switch to yearly billing"
          >
            <Text style={styles.linkBtnText}>Switch to yearly</Text>
          </Pressable>
        ) : null}
        {!isPro ? (
          <Pressable
            style={styles.linkBtn}
            onPress={() => void restore()}
            disabled={busy != null}
            accessibilityRole="button"
            accessibilityLabel="Restore purchases"
            accessibilityHint={`Looks for a Mechanic Pro subscription on this ${STORE_ACCOUNT}`}
            accessibilityState={{ busy: busy === 'restore' }}
          >
            {busy === 'restore' ? <ActivityIndicator color={C.brand} /> : <Text style={styles.linkBtnText}>Restore purchases</Text>}
          </Pressable>
        ) : null}
      </View>

      {/* Questions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Good to know</Text>
        <Faq
          q="How am I billed?"
          a={`Through ${STORE_NAME}, using the payment method on your ${STORE_ACCOUNT}. It renews automatically until you cancel.`}
        />
        <Faq
          q="How do I cancel?"
          a={
            Platform.OS === 'ios'
              ? 'Settings › your name › Subscriptions, or tap Manage above when Pro is active. Cancelling stops the next renewal.'
              : 'Google Play › Payments & subscriptions › Subscriptions, or tap Manage above when Pro is active. Cancelling stops the next renewal.'
          }
        />
        <Faq
          q="New phone or reinstalled the app?"
          a={`Sign in to RydAid and the same ${STORE_ACCOUNT}, then tap Restore purchases.`}
          last
        />
      </View>

      {history.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment history</Text>
          {history.map((item, i) => (
            <View key={item.id} style={[styles.historyRow, i === history.length - 1 && styles.rowLast]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyMain}>
                  {item.currency === 'PHP' || !item.currency ? '₱' : `${item.currency} `}
                  {item.amount}
                </Text>
                <Text style={styles.historySub}>{formatDate(item.paid_at ?? item.created_at) ?? item.payment_reference}</Text>
              </View>
              <Text style={styles.historyStatus}>{item.status}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Developer-only details (hidden in release builds). */}
      {__DEV__ || simulateEnabled ? (
        <View style={styles.devBox}>
          <Text style={styles.devTitle}>Developer</Text>
          {__DEV__ ? (
            <Text style={styles.devText}>
              Product: {selectedProductId}. {selectedFromStore ? 'Price from store.' : 'No store price (Expo Go / sideload / SKU missing) — showing CMS estimate.'}{' '}
              Use sandbox / license testers for TestFlight and Play internal testing. Status: {status ?? 'unknown'}.
            </Text>
          ) : null}
          {simulateEnabled && canBuy && !yearlyCheckoutUnavailable ? (
            <Pressable
              style={[styles.devBtn, busy != null && styles.btnDisabled]}
              disabled={busy != null}
              onPress={() => void simulate()}
              accessibilityRole="button"
              accessibilityLabel="Simulate payment, local development only"
            >
              {busy === 'sim' ? <ActivityIndicator color={C.warn} /> : <Text style={styles.devBtnText}>Simulate payment (local dev, no charge)</Text>}
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function CompareRow({ feature, free, pro, last }: { feature: string; free: string; pro: string; last?: boolean }) {
  return (
    <View
      style={[styles.compareRow, last && styles.rowLast]}
      accessible
      accessibilityLabel={`${feature}. Free: ${free === '✓' ? 'included' : free}. Pro: ${pro === '✓' ? 'included' : pro}.`}
    >
      <Text style={[styles.compareCell, styles.compareFeature]}>{feature}</Text>
      <Text style={styles.compareCell}>{free}</Text>
      <Text style={[styles.compareCell, styles.compareProCell]}>{pro}</Text>
    </View>
  );
}

function PlanOption({
  title,
  price,
  unit,
  note,
  selected,
  current,
  disabled,
  onPress,
}: {
  title: string;
  price: string | null;
  unit: string;
  note?: string;
  selected: boolean;
  current: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.planCard, selected && styles.planCardOn, current && styles.planCardCurrent]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={`${title}, ${price ? `${price} per ${unit}` : 'price unavailable'}${current ? ', current plan' : ''}`}
    >
      <View style={styles.planTop}>
        <Text style={styles.planTitle}>{title}</Text>
        <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
      </View>
      <Text style={styles.planPrice}>{price ?? '—'}</Text>
      <Text style={styles.planUnit}>per {unit}</Text>
      {note ? <Text style={styles.planNote}>{note}</Text> : null}
      {current ? <Text style={styles.planCurrent}>Current plan</Text> : null}
    </Pressable>
  );
}

function Faq({ q, a, last }: { q: string; a: string; last?: boolean }) {
  return (
    <View style={[styles.faq, last && styles.rowLast]} accessible accessibilityLabel={`${q} ${a}`}>
      <Text style={styles.faqQ}>{q}</Text>
      <Text style={styles.faqA}>{a}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16 },
  hero: { backgroundColor: C.brandDark, borderRadius: 18, padding: 20, marginBottom: 12 },
  heroEyebrow: { color: C.brandSoft, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 6, lineHeight: 30 },
  heroSub: { color: C.brandSoft, fontSize: 15, lineHeight: 22, marginTop: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  errorCard: { borderColor: C.bad, backgroundColor: C.badSoft },
  cardTitle: { fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 10 },
  body: { fontSize: 15, lineHeight: 22, color: C.muted },
  bodyMuted: { fontSize: 14, color: C.faint, marginLeft: 10 },
  statusCard: { borderLeftWidth: 4 },
  statusOk: { borderLeftColor: C.ok },
  statusWarn: { borderLeftColor: C.warn },
  statusBad: { borderLeftColor: C.bad },
  statusNeutral: { borderLeftColor: C.brand },
  statusHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLabel: { fontSize: 13, fontWeight: '700', color: C.faint, textTransform: 'uppercase', letterSpacing: 0.6 },
  statusTitle: { fontSize: 18, fontWeight: '800', color: C.ink, marginTop: 6, marginBottom: 4 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillOk: { backgroundColor: C.okSoft },
  pillNeutral: { backgroundColor: C.brandSoft },
  pillText: { fontSize: 11, fontWeight: '800', color: C.brandDark, letterSpacing: 0.6 },
  pillTextOk: { color: C.ok },
  meter: { height: 8, borderRadius: 4, backgroundColor: C.line, marginTop: 12, overflow: 'hidden' },
  meterFill: { height: 8, borderRadius: 4 },
  compareHead: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  compareHeadText: { fontSize: 13, fontWeight: '800', color: C.faint },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  compareCell: { width: 76, textAlign: 'center', fontSize: 14, color: C.muted },
  compareFeature: { flex: 1, textAlign: 'left', color: C.ink, fontWeight: '600' },
  compareProCell: { color: C.brandDark, fontWeight: '800' },
  rowLast: { borderBottomWidth: 0 },
  priceLoading: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  planRow: { flexDirection: 'row', gap: 10 },
  planCard: {
    flex: 1,
    minHeight: 112,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: C.line,
    padding: 12,
    backgroundColor: '#fff',
  },
  planCardOn: { borderColor: C.brand, backgroundColor: C.brandSoft },
  planCardCurrent: { borderColor: C.ok },
  planTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planTitle: { fontSize: 15, fontWeight: '700', color: C.ink },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: C.brand },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.brand },
  planPrice: { fontSize: 22, fontWeight: '800', color: C.ink, marginTop: 8 },
  planUnit: { fontSize: 13, color: C.faint },
  planNote: { fontSize: 12, color: C.brandDark, marginTop: 6, fontWeight: '600' },
  planCurrent: { fontSize: 12, color: C.ok, marginTop: 6, fontWeight: '800' },
  priceNote: { fontSize: 13, lineHeight: 19, color: C.faint, marginTop: 10 },
  primaryBtn: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 4,
  },
  pressed: { backgroundColor: C.brandDark },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  btnDisabled: { opacity: 0.6 },
  secondaryRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 4, marginBottom: 12 },
  linkBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  linkBtnText: { color: C.brandDark, fontSize: 15, fontWeight: '700' },
  faq: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  faqQ: { fontSize: 15, fontWeight: '700', color: C.ink },
  faqA: { fontSize: 14, lineHeight: 20, color: C.muted, marginTop: 4 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  historyMain: { fontSize: 15, fontWeight: '700', color: C.ink },
  historySub: { fontSize: 13, color: C.faint, marginTop: 2 },
  historyStatus: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'capitalize' },
  devBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.warn,
    backgroundColor: C.warnSoft,
    padding: 12,
    marginBottom: 12,
  },
  devTitle: { fontSize: 12, fontWeight: '800', color: C.warn, textTransform: 'uppercase', marginBottom: 4 },
  devText: { fontSize: 12, lineHeight: 18, color: '#78350f' },
  devBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  devBtnText: { color: C.warn, fontWeight: '800', fontSize: 14 },
});
