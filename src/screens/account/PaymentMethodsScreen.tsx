import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getApiErrorMessage } from '../../api/client';
import {
  deleteWallet,
  fetchPaymentMethods,
  isPaymentApiMissing,
  setPreferredPaymentMethod,
  type PaymentMethodsSummary,
  type PaymentWallet,
} from '../../api/paymentMethods';
import { CenteredLoading } from '../../components/CenteredLoading';
import { showAppToast } from '../../components/AppToast';
import type { PaymentMethodsParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { protectedImageSource } from '../../utils/protectedImage';
import { paymentIcon } from '../../utils/paymentMethods';

type Props = NativeStackScreenProps<PaymentMethodsParamList, 'PaymentMethods'>;

type LoadState = 'loading' | 'ready' | 'error' | 'unavailable';

/** Shared by owners and mechanics: cash (always on) + saved wallets, preferred method, add/edit/delete. */
export function PaymentMethodsScreen({ navigation }: Props) {
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PaymentMethodsSummary | null>(null);
  const [busyId, setBusyId] = useState<number | 'cash' | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setState('loading');
    try {
      const data = await fetchPaymentMethods();
      setSummary(data);
      setError(null);
      setState('ready');
    } catch (e) {
      if (isPaymentApiMissing(e)) {
        setState('unavailable');
      } else {
        setError(getApiErrorMessage(e));
        setState('error');
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(summary != null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  const makePreferred = async (id: number | null) => {
    setBusyId(id ?? 'cash');
    try {
      const data = await setPreferredPaymentMethod(id);
      setSummary(data);
      showAppToast(`${data.preferred.label} is now your preferred payment method.`);
    } catch (e) {
      Alert.alert('Could not update', getApiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = (wallet: PaymentWallet) => {
    Alert.alert(
      `Delete ${wallet.label}?`,
      `${wallet.account_name} · ${wallet.account_number_masked} will be removed${wallet.qr_url ? ' along with its QR code' : ''}.${
        wallet.is_preferred ? ' Cash will become your preferred method.' : ''
      }`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusyId(wallet.id);
            try {
              const data = await deleteWallet(wallet.id);
              setSummary(data);
              showAppToast('Wallet deleted.');
            } catch (e) {
              Alert.alert('Could not delete', getApiErrorMessage(e));
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  if (state === 'loading' && !summary) {
    return <CenteredLoading message="Loading payment methods…" />;
  }

  if (state === 'unavailable') {
    return (
      <View style={styles.centerBox}>
        <Text style={styles.centerIcon}>💵</Text>
        <Text style={styles.centerTitle}>Cash is ready to use</Text>
        <Text style={styles.centerBody}>
          Saving GCash, Maya and other wallets isn't available on the server yet. You can still pay or get paid in cash.
        </Text>
      </View>
    );
  }

  if (state === 'error' && !summary) {
    return (
      <View style={styles.centerBox}>
        <Text style={styles.centerTitle}>Couldn't load payment methods</Text>
        <Text style={styles.centerBody}>{error}</Text>
        <Pressable style={styles.primaryBtn} onPress={() => void load()}>
          <Text style={styles.primaryBtnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const data = summary!;
  const atLimit = data.wallets.length >= data.limits.max_wallets;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.lead}>
        Choose how you pay or get paid. RydAid only shows these details to the other person on your job — no money moves through the app.
      </Text>

      <Text style={styles.sectionTitle}>Preferred</Text>
      <View style={styles.preferredCard}>
        <Text style={styles.preferredIcon}>{paymentIcon(data.preferred.type)}</Text>
        <View style={styles.flex}>
          <Text style={styles.preferredLabel}>{data.preferred.label}</Text>
          <Text style={styles.preferredHint}>Shown first on your help requests and jobs.</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Cash</Text>
      <View style={[styles.card, data.cash.is_preferred && styles.cardPreferred]}>
        <View style={styles.cardRow}>
          <Text style={styles.cardIcon}>💵</Text>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>Cash</Text>
            <Text style={styles.cardSub}>Always available · pay in person</Text>
          </View>
          {data.cash.is_preferred ? (
            <Text style={styles.badge}>Preferred</Text>
          ) : (
            <Pressable
              style={styles.smallBtn}
              disabled={busyId != null}
              onPress={() => void makePreferred(null)}
              accessibilityLabel="Set cash as preferred"
            >
              {busyId === 'cash' ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.smallBtnText}>Set preferred</Text>}
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Digital wallets</Text>
        <Text style={styles.sectionCount}>
          {data.wallets.length}/{data.limits.max_wallets}
        </Text>
      </View>

      {data.wallets.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>👛</Text>
          <Text style={styles.emptyTitle}>No wallets yet</Text>
          <Text style={styles.emptyBody}>
            Add GCash, Maya or another wallet with its QR code so the other person can pay you or see how you'll pay.
          </Text>
        </View>
      ) : (
        data.wallets.map((w) => (
          <View key={w.id} style={[styles.card, w.is_preferred && styles.cardPreferred]}>
            <View style={styles.cardRow}>
              <Text style={styles.cardIcon}>{paymentIcon(w.type)}</Text>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{w.label}</Text>
                <Text style={styles.cardSub} numberOfLines={1}>
                  {w.account_name} · {w.account_number_masked}
                </Text>
                <Text style={styles.cardMeta}>{w.qr_url ? 'QR code added' : 'No QR code'}</Text>
              </View>
              {w.qr_url ? (
                <Image source={protectedImageSource(w.qr_url)!} style={styles.qrThumb} accessibilityLabel={`${w.label} QR code`} />
              ) : null}
            </View>
            <View style={styles.actionsRow}>
              {w.is_preferred ? (
                <Text style={styles.badge}>Preferred</Text>
              ) : (
                <Pressable style={styles.smallBtn} disabled={busyId != null} onPress={() => void makePreferred(w.id)}>
                  {busyId === w.id ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.smallBtnText}>Set preferred</Text>}
                </Pressable>
              )}
              <View style={styles.flex} />
              <Pressable
                style={styles.linkBtn}
                disabled={busyId != null}
                onPress={() => navigation.navigate('PaymentMethodForm', { wallet: w })}
              >
                <Text style={styles.linkBtnText}>Edit</Text>
              </Pressable>
              <Pressable style={styles.linkBtn} disabled={busyId != null} onPress={() => confirmDelete(w)}>
                <Text style={[styles.linkBtnText, styles.dangerText]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Pressable
        style={[styles.primaryBtn, atLimit && styles.btnDisabled]}
        disabled={atLimit}
        onPress={() =>
          navigation.navigate('PaymentMethodForm', {
            maxQrMb: data.limits.max_qr_mb,
            firstWallet: data.wallets.length === 0,
          })
        }
      >
        <Text style={styles.primaryBtnText}>＋ Add a wallet</Text>
      </Pressable>
      {atLimit ? (
        <Text style={styles.limitNote}>You can save up to {data.limits.max_wallets} wallets. Delete one to add another.</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  flex: { flex: 1, minWidth: 0 },
  lead: { fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedSoft,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionCount: { fontSize: 12, fontWeight: '700', color: colors.muted },
  preferredCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  preferredIcon: { fontSize: 26 },
  preferredLabel: { fontSize: 17, fontWeight: '800', color: colors.primaryInk },
  preferredHint: { fontSize: 13, color: colors.muted, marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  cardPreferred: { borderColor: colors.primary, borderWidth: 1.5 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon: { fontSize: 24 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 14, color: colors.muted, marginTop: 2 },
  cardMeta: { fontSize: 12, color: colors.mutedSoft, marginTop: 2 },
  qrThumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: colors.surfaceMuted },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 4,
  },
  badge: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryInk,
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryBorder,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  smallBtn: {
    minHeight: 34,
    minWidth: 96,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  linkBtn: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center' },
  linkBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  dangerText: { color: colors.danger },
  empty: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyIcon: { fontSize: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 6 },
  emptyBody: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 4, lineHeight: 20 },
  primaryBtn: {
    marginTop: 18,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  btnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: colors.onPrimary, fontSize: 16, fontWeight: '800' },
  limitNote: { fontSize: 13, color: colors.warnInk, textAlign: 'center', marginTop: 8 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: colors.bg },
  centerIcon: { fontSize: 40 },
  centerTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 8, textAlign: 'center' },
  centerBody: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
