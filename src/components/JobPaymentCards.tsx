import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getApiErrorMessage } from '../api/client';
import type { HelpRequest } from '../api/helpRequests';
import {
  fetchMechanicPaymentInfo,
  fetchPaymentMethods,
  isPaymentApiMissing,
  mechanicRecordPayment,
  ownerRecordPayment,
  type JobPaymentRecord,
  type MechanicPaymentInfo,
  type PaymentWallet,
} from '../api/paymentMethods';
import { colors } from '../theme/colors';
import { formatPeso, ownerPaymentPlanLabel, paymentIcon } from '../utils/paymentMethods';
import { protectedImageSource } from '../utils/protectedImage';
import { showAppToast } from './AppToast';

type Choice = { key: string; type: string; label: string; walletId: number | null };

const CASH_CHOICE: Choice = { key: 'cash', type: 'CASH', label: 'Cash', walletId: null };

function choiceFor(w: PaymentWallet): Choice {
  return { key: `w${w.id}`, type: w.type, label: w.label, walletId: w.id };
}

function recordedAt(payment: JobPaymentRecord | null | undefined): string | null {
  if (!payment?.recorded_at) return null;
  const d = new Date(payment.recorded_at);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** "Customer pays with: GCash" — mechanic offer/job screens and the owner's active request. */
export function PaymentPlanLine({
  request,
  prefix = 'Customer plans to pay with',
}: {
  request: Pick<HelpRequest, 'payment_preference'>;
  prefix?: string;
}) {
  const label = ownerPaymentPlanLabel(request);
  if (!label) return null;
  return (
    <View style={styles.planLine}>
      <Text style={styles.planIcon}>{paymentIcon(request.payment_preference?.type)}</Text>
      <Text style={styles.planText}>
        {prefix}: <Text style={styles.planStrong}>{label}</Text>
      </Text>
    </View>
  );
}

function PaidState({ payment, who }: { payment: JobPaymentRecord; who: 'owner' | 'mechanic' }) {
  const when = recordedAt(payment);
  const label = payment.method_label || payment.method || 'Recorded';
  return (
    <View style={[styles.card, styles.paidCard]}>
      <Text style={styles.paidTitle}>✓ {who === 'owner' ? 'Payment recorded' : 'Payment received'}</Text>
      <Text style={styles.paidBody}>
        Paid with {label}
        {payment.details?.account_number_masked ? ` · ${payment.details.account_number_masked}` : ''}
        {when ? ` · ${when}` : ''}
      </Text>
    </View>
  );
}

function QrModal({ wallet, onClose }: { wallet: PaymentWallet | null; onClose: () => void }) {
  return (
    <Modal visible={wallet != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.qrBackdrop} onPress={onClose}>
        {wallet?.qr_url ? (
          <View style={styles.qrSheet}>
            <Text style={styles.qrTitle}>{wallet.label}</Text>
            <Text style={styles.qrSub}>
              {wallet.account_name} · {wallet.account_number_display ?? wallet.account_number_masked}
            </Text>
            <Image source={protectedImageSource(wallet.qr_url)!} style={styles.qrLarge} resizeMode="contain" />
            <Text style={styles.qrHint}>Scan with your wallet app. Tap anywhere to close.</Text>
          </View>
        ) : null}
      </Pressable>
    </Modal>
  );
}

/**
 * Owner: how to pay the assigned mechanic (cash + their wallets with full number and QR),
 * then record which method was used. Display only — no money moves.
 */
export function OwnerPayMechanicCard({
  request,
  onUpdated,
}: {
  request: HelpRequest;
  onUpdated: (updated: HelpRequest) => void;
}) {
  const jobCompleted = request.job?.status === 'COMPLETED' || request.status === 'COMPLETED';
  const [info, setInfo] = useState<MechanicPaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [legacy, setLegacy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [qrWallet, setQrWallet] = useState<PaymentWallet | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMechanicPaymentInfo(request.id);
      setInfo(data);
      setLegacy(false);
      setError(null);
      setSelected((prev) => {
        if (prev) return prev;
        const preferred = data.wallets.find((w) => w.is_preferred);
        return preferred ? `w${preferred.id}` : 'cash';
      });
    } catch (e) {
      if (isPaymentApiMissing(e)) {
        setLegacy(true);
        setSelected('cash');
        setError(null);
      } else {
        setError(getApiErrorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  }, [request.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const payment = request.job?.payment ?? info?.payment ?? null;
  const legacyPaid = request.job?.pricing?.payment_status === 'paid';

  const choices = useMemo<Choice[]>(
    () => [CASH_CHOICE, ...(info?.wallets ?? []).map(choiceFor)],
    [info],
  );
  const choice = choices.find((c) => c.key === selected) ?? CASH_CHOICE;
  const amount = formatPeso(info?.amount_php ?? request.job?.pricing?.final_service_amount_php ?? null);
  const mechanicName =
    info?.mechanic_name || request.mechanic?.display_name || request.mechanic?.business_name || 'your mechanic';

  if (payment?.is_paid) return <PaidState payment={payment} who="owner" />;
  if (legacyPaid) {
    return (
      <View style={[styles.card, styles.paidCard]}>
        <Text style={styles.paidTitle}>✓ Payment recorded</Text>
        {request.job?.pricing?.payment_method ? (
          <Text style={styles.paidBody}>Method: {request.job.pricing.payment_method}</Text>
        ) : null}
      </View>
    );
  }

  const confirmPaid = () => {
    Alert.alert(
      `Mark as paid with ${choice.label}?`,
      `${amount ? `${amount} to ${mechanicName}. ` : ''}This only records how you paid — RydAid doesn't move money.`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: "Yes, I've paid",
          onPress: async () => {
            setSaving(true);
            try {
              const updated = await ownerRecordPayment(request.id, {
                payment_method: choice.type.toLowerCase(),
                payment_method_id: choice.walletId,
              });
              showAppToast('Payment recorded. Thank you!');
              onUpdated(updated);
            } catch (e) {
              Alert.alert('Could not record payment', getApiErrorMessage(e));
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Pay {mechanicName}</Text>
      {amount ? <Text style={styles.amount}>{amount}</Text> : null}
      <Text style={styles.sub}>
        {jobCompleted ? 'Choose how you paid. Cash is always accepted.' : 'Pay when the job is complete. Cash is always accepted.'}
      </Text>

      {loading && !info && !legacy ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.options}>
          {choices.map((c) => {
            const wallet = info?.wallets.find((w) => w.id === c.walletId) ?? null;
            const on = c.key === choice.key;
            return (
              <Pressable
                key={c.key}
                style={[styles.option, on && styles.optionOn]}
                onPress={() => setSelected(c.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                <Text style={styles.optionIcon}>{paymentIcon(c.type)}</Text>
                <View style={styles.flex}>
                  <Text style={styles.optionTitle}>
                    {c.label}
                    {wallet?.is_preferred || (c.walletId == null && info?.cash.is_preferred) ? (
                      <Text style={styles.optionTag}>  · Mechanic's preferred</Text>
                    ) : null}
                  </Text>
                  {wallet ? (
                    <>
                      <Text style={styles.optionName}>{wallet.account_name}</Text>
                      <Text style={styles.optionNumber} selectable>
                        {wallet.account_number_display ?? wallet.account_number ?? wallet.account_number_masked}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.optionName}>Pay in person</Text>
                  )}
                </View>
                {wallet?.qr_url ? (
                  <Pressable onPress={() => setQrWallet(wallet)} accessibilityLabel={`Show ${wallet.label} QR code`}>
                    <Image source={protectedImageSource(wallet.qr_url)!} style={styles.qrThumb} />
                    <Text style={styles.qrTap}>Tap to scan</Text>
                  </Pressable>
                ) : null}
              </Pressable>
            );
          })}
          {legacy ? <Text style={styles.note}>Wallet details will appear here after the next server update.</Text> : null}
          {info && info.wallets.length === 0 ? (
            <Text style={styles.note}>This mechanic hasn't added a digital wallet — pay in cash.</Text>
          ) : null}
          {info && info.wallets.length > 0 ? (
            <Text style={styles.note}>Long-press a number to copy it. Check the account name before sending.</Text>
          ) : null}
        </View>
      )}

      {jobCompleted ? (
        <Pressable
          style={[styles.primaryBtn, (saving || (!!error && !info)) && styles.btnDisabled]}
          disabled={saving || (!!error && !info)}
          onPress={confirmPaid}
        >
          {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryBtnText}>I've paid with {choice.label}</Text>}
        </Pressable>
      ) : null}

      <QrModal wallet={qrWallet} onClose={() => setQrWallet(null)} />
    </View>
  );
}

/**
 * Mechanic: payment status on a completed job and "Mark as received" (cash or one of your wallets).
 */
export function MechanicJobPaymentCard({
  request,
  onUpdated,
}: {
  request: HelpRequest;
  onUpdated: (updated: HelpRequest) => void;
}) {
  const [wallets, setWallets] = useState<PaymentWallet[]>([]);
  const [selected, setSelected] = useState<string>('cash');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchPaymentMethods()
      .then((data) => {
        if (!alive) return;
        setWallets(data.wallets);
        const plan = request.payment_preference?.type;
        const match = plan && plan !== 'CASH' ? data.wallets.find((w) => w.type === plan) : null;
        setSelected(match ? `w${match.id}` : 'cash');
      })
      .catch(() => {
        // Older server or offline: cash only.
      });
    return () => {
      alive = false;
    };
  }, [request.payment_preference?.type]);

  const payment = request.job?.payment ?? null;
  if (payment?.is_paid) return <PaidState payment={payment} who="mechanic" />;
  if (request.job?.pricing?.payment_status === 'paid') {
    return (
      <View style={[styles.card, styles.paidCard]}>
        <Text style={styles.paidTitle}>✓ Payment received</Text>
      </View>
    );
  }

  const choices: Choice[] = [CASH_CHOICE, ...wallets.map(choiceFor)];
  const choice = choices.find((c) => c.key === selected) ?? CASH_CHOICE;
  const amount = formatPeso(request.job?.pricing?.final_service_amount_php ?? null);

  const confirm = () => {
    Alert.alert(
      'Mark payment as received?',
      `${amount ? `${amount} via ` : 'Via '}${choice.label}. This only records the payment — RydAid doesn't move money.`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Mark received',
          onPress: async () => {
            setSaving(true);
            try {
              const updated = await mechanicRecordPayment(request.id, {
                payment_method: choice.type.toLowerCase(),
                payment_method_id: choice.walletId,
              });
              showAppToast('Payment marked as received.');
              onUpdated(updated);
            } catch (e) {
              Alert.alert('Could not record payment', getApiErrorMessage(e));
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Payment</Text>
      {amount ? <Text style={styles.amount}>{amount}</Text> : null}
      <PaymentPlanLine request={request} />
      <Text style={styles.sub}>Waiting for payment. Mark it once you've received it.</Text>
      <View style={styles.chips}>
        {choices.map((c) => {
          const on = c.key === choice.key;
          return (
            <Pressable
              key={c.key}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => setSelected(c.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {paymentIcon(c.type)} {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable style={[styles.primaryBtn, saving && styles.btnDisabled]} disabled={saving} onPress={confirm}>
        {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryBtnText}>Mark as received</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginTop: 12,
  },
  paidCard: { backgroundColor: colors.liveSoft, borderColor: colors.liveBorder },
  paidTitle: { fontSize: 16, fontWeight: '800', color: colors.liveInk },
  paidBody: { fontSize: 14, color: colors.liveInk, marginTop: 4 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  amount: { fontSize: 26, fontWeight: '800', color: colors.text, marginTop: 2, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },
  loader: { marginVertical: 16 },
  options: { marginTop: 12, gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionOn: { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: colors.primarySoft },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.mutedSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  optionIcon: { fontSize: 20 },
  optionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  optionTag: { fontSize: 12, fontWeight: '600', color: colors.primaryInk },
  optionName: { fontSize: 13, color: colors.muted, marginTop: 2 },
  optionNumber: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 2, letterSpacing: 0.5 },
  qrThumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.surfaceMuted },
  qrTap: { fontSize: 10, color: colors.primary, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  note: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 },
  errorBox: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: colors.dangerSoft },
  errorText: { fontSize: 13, color: colors.dangerInk },
  retryBtn: { marginTop: 6, alignSelf: 'flex-start' },
  retryText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  primaryBtn: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnDisabled: { opacity: 0.55 },
  primaryBtnText: { color: colors.onPrimary, fontSize: 16, fontWeight: '800' },
  planLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  planIcon: { fontSize: 15 },
  planText: { fontSize: 14, color: colors.muted, flexShrink: 1 },
  planStrong: { fontWeight: '800', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.text },
  chipTextOn: { color: colors.primaryInk },
  qrBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.75)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  qrSheet: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, alignItems: 'center', width: '100%', maxWidth: 380 },
  qrTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  qrSub: { fontSize: 14, color: colors.muted, marginTop: 4, textAlign: 'center' },
  qrLarge: { width: 280, height: 280, marginTop: 14, backgroundColor: colors.surfaceMuted, borderRadius: 12 },
  qrHint: { fontSize: 12, color: colors.muted, marginTop: 12, textAlign: 'center' },
});
