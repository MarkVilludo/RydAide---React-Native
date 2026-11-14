import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ServiceJobPricing } from '../api/helpRequests';
import {
  digitsFromPhpInput,
  formatPhpAmount,
  formatPhpInputDisplay,
  parsePhpDigits,
} from '../utils/helpRequestUi';

type MechanicProps = {
  role: 'mechanic';
  pricing: ServiceJobPricing | null | undefined;
  busy?: boolean;
  onSubmit: (amountPhp: number, description: string) => void;
};

type OwnerProps = {
  role: 'owner';
  pricing: ServiceJobPricing | null | undefined;
  busy?: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

type Props = MechanicProps | OwnerProps;

export function ServiceQuotePanel(props: Props) {
  const pricing = props.pricing;
  if (!pricing) return null;

  const status = (pricing.quote_status ?? 'none').toLowerCase();
  const requireQuote = pricing.require_quote_before_work === true;
  const amountLabel = formatPhpAmount(pricing.quoted_service_amount_php ?? null);
  const canSubmit =
    props.role === 'mechanic' &&
    (pricing.can_submit_quote === true ||
      (requireQuote && status !== 'accepted' && status !== 'pending'));

  if (props.role === 'owner') {
    if (status === 'pending' && amountLabel) {
      return (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Service quote</Text>
          <Text style={styles.amount}>{amountLabel}</Text>
          {pricing.quote_description ? (
            <Text style={styles.desc}>{pricing.quote_description}</Text>
          ) : null}
          <Text style={styles.hint}>Approve this estimate so your mechanic can start work.</Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.btn, styles.btnDecline, props.busy && styles.btnOff]}
              disabled={props.busy}
              onPress={props.onDecline}
            >
              {props.busy ? (
                <ActivityIndicator color="#991b1b" />
              ) : (
                <Text style={styles.btnDeclineText}>Decline</Text>
              )}
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnAccept, props.busy && styles.btnOff]}
              disabled={props.busy}
              onPress={props.onAccept}
            >
              {props.busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnAcceptText}>Accept quote</Text>
              )}
            </Pressable>
          </View>
        </View>
      );
    }

    if (status === 'accepted' && amountLabel) {
      return (
        <View style={[styles.card, styles.cardOk]}>
          <Text style={styles.eyebrowOk}>Quote accepted</Text>
          <Text style={styles.amountOk}>{amountLabel}</Text>
          {pricing.quote_description ? (
            <Text style={styles.desc}>{pricing.quote_description}</Text>
          ) : null}
        </View>
      );
    }

    if (status === 'rejected') {
      return (
        <View style={[styles.card, styles.cardWarn]}>
          <Text style={styles.eyebrowWarn}>Quote declined</Text>
          <Text style={styles.hint}>Waiting for your mechanic to send a new estimate.</Text>
        </View>
      );
    }

    if (requireQuote) {
      return (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Service quote</Text>
          <Text style={styles.hint}>Your mechanic will send a price estimate before work starts.</Text>
        </View>
      );
    }

    return null;
  }

  // Mechanic
  if (status === 'accepted' && amountLabel) {
    return (
      <View style={[styles.card, styles.cardOk]}>
        <Text style={styles.eyebrowOk}>Owner accepted your quote</Text>
        <Text style={styles.amountOk}>{amountLabel}</Text>
        {pricing.quote_description ? (
          <Text style={styles.desc}>{pricing.quote_description}</Text>
        ) : null}
      </View>
    );
  }

  if (status === 'pending' && amountLabel) {
    return (
      <View style={[styles.card, styles.cardWarn]}>
        <Text style={styles.eyebrowWarn}>Waiting for owner</Text>
        <Text style={styles.amount}>{amountLabel}</Text>
        {pricing.quote_description ? (
          <Text style={styles.desc}>{pricing.quote_description}</Text>
        ) : null}
        <Text style={styles.hint}>
          {requireQuote
            ? 'Start job unlocks after they accept this quote.'
            : 'They can accept or decline in the app.'}
        </Text>
        {canSubmit ? <MechanicQuoteForm busy={props.busy} onSubmit={props.onSubmit} replace /> : null}
      </View>
    );
  }

  if (canSubmit || requireQuote || status === 'rejected' || status === 'none') {
    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>
          {status === 'rejected' ? 'Send a new quote' : 'Service quote'}
        </Text>
        <Text style={styles.hint}>
          {requireQuote
            ? 'Send a price estimate. The owner must accept it before you can start work.'
            : 'Optional estimate for the owner.'}
        </Text>
        {status === 'rejected' && amountLabel ? (
          <Text style={styles.prev}>Previously declined: {amountLabel}</Text>
        ) : null}
        <MechanicQuoteForm busy={props.busy} onSubmit={props.onSubmit} />
      </View>
    );
  }

  return null;
}

function MechanicQuoteForm({
  busy,
  onSubmit,
  replace,
}: {
  busy?: boolean;
  onSubmit: (amountPhp: number, description: string) => void;
  replace?: boolean;
}) {
  const [amountDigits, setAmountDigits] = useState('');
  const [description, setDescription] = useState('');
  const parsed = parsePhpDigits(amountDigits);

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Amount (₱)</Text>
      <TextInput
        style={styles.input}
        value={formatPhpInputDisplay(amountDigits)}
        onChangeText={(t) => setAmountDigits(digitsFromPhpInput(t))}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor="#94a3b8"
        editable={!busy}
      />
      <Text style={styles.label}>What’s included (optional)</Text>
      <TextInput
        style={[styles.input, styles.inputMulti]}
        value={description}
        onChangeText={setDescription}
        placeholder="e.g. Battery jump + labor"
        placeholderTextColor="#94a3b8"
        editable={!busy}
        multiline
      />
      <Pressable
        style={[styles.btn, styles.btnAccept, (busy || parsed == null) && styles.btnOff]}
        disabled={busy || parsed == null}
        onPress={() => {
          if (parsed == null) return;
          onSubmit(parsed, description.trim());
        }}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnAcceptText}>{replace ? 'Update quote' : 'Send quote'}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    gap: 6,
  },
  cardOk: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  cardWarn: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  eyebrowOk: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  eyebrowWarn: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400e',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  amount: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  amountOk: { fontSize: 22, fontWeight: '800', color: '#166534' },
  desc: { fontSize: 13, color: '#475569', lineHeight: 18 },
  hint: { fontSize: 13, color: '#64748b', lineHeight: 18 },
  prev: { fontSize: 12, color: '#92400e', fontWeight: '600' },
  form: { marginTop: 6, gap: 4 },
  label: { fontSize: 12, fontWeight: '700', color: '#64748b', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  inputMulti: { minHeight: 64, fontWeight: '500', textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  btnAccept: { backgroundColor: '#0284c7' },
  btnDecline: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca' },
  btnOff: { opacity: 0.55 },
  btnAcceptText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnDeclineText: { color: '#991b1b', fontWeight: '800', fontSize: 14 },
});
