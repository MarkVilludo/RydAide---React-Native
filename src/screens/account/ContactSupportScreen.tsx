import Constants from 'expo-constants';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { DrawerIcon, type DrawerIconName } from '../../components/DrawerIcons';
import { KeyboardAwareScrollView } from '../../components/KeyboardAwareScrollView';
import { Button, SectionCard, TextField } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useAppConfig } from '../../hooks/useAppConfig';
import type { PaymentMethodsParamList } from '../../navigation/types';
import { colors, radii, spacing, touch, type } from '../../theme/tokens';
import { resolveSupportContacts } from '../../utils/supportContacts';

type Props = NativeStackScreenProps<PaymentMethodsParamList, 'ContactSupport'>;

export const PROBLEM_CATEGORIES = [
  'App bug',
  'Account / login',
  'Payment',
  'Help request / job issue',
  'Mechanic listing',
  'Other',
] as const;
type Category = (typeof PROBLEM_CATEGORIES)[number];

const MIN_DESCRIPTION = 10;

type Extra = { key: string; icon: DrawerIconName; title: string; value: string; url: string };

/** mailto: URL with an encoded subject and body. */
export function problemReportMailto(
  to: string,
  category: string,
  description: string,
  meta: { role: string; accountId: number | string | null | undefined; version: string; platform: string },
): string {
  const subject = `[RydAid] ${category}`;
  const body = [
    description.trim(),
    '',
    '— Details (please keep) —',
    `Category: ${category}`,
    `Role: ${meta.role}`,
    `Account #: ${meta.accountId ?? '—'}`,
    `App version: ${meta.version}`,
    `Platform: ${meta.platform}`,
  ].join('\n');
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Contact Support = "Report a problem" with the RydAid platform (not emergencies).
 * Pick a category, describe it, and Send opens the mail app addressed to support with the
 * category in the subject and role / account / app version / platform in the body.
 * Screenshots: a mailto link can't carry attachments, so we ask the user to attach one in their mail app.
 */
export function ContactSupportScreen(_props: Props) {
  const { user } = useAuth();
  const { config } = useAppConfig();
  const contacts = useMemo(() => resolveSupportContacts(config), [config]);
  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [sending, setSending] = useState(false);

  const version = Constants.expoConfig?.version ?? '—';
  const roleLabel = user?.role === 'mechanic' ? 'Mechanic' : 'Vehicle owner';
  const platform = `${Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS} ${String(Platform.Version)}`;

  const categoryError = showErrors && !category ? 'Choose what the problem is about.' : null;
  const descriptionError =
    showErrors && description.trim().length < MIN_DESCRIPTION
      ? `Tell us a bit more (at least ${MIN_DESCRIPTION} characters).`
      : null;

  const extras: Extra[] = [];
  if (contacts.phone) {
    extras.push({ key: 'phone', icon: 'phone', title: 'Call support', value: contacts.phone, url: `tel:${contacts.phone.replace(/[^\d+]/g, '')}` });
  }
  if (contacts.messengerUrl) {
    extras.push({ key: 'messenger', icon: 'chat', title: 'Chat on Messenger', value: 'Message our page', url: contacts.messengerUrl });
  }
  if (contacts.faqUrl) {
    extras.push({ key: 'faq', icon: 'faq', title: 'Help center & FAQ', value: 'Answers to common questions', url: contacts.faqUrl });
  }

  const send = async () => {
    setShowErrors(true);
    if (!category || description.trim().length < MIN_DESCRIPTION) return;
    const url = problemReportMailto(contacts.email, category, description, {
      role: roleLabel,
      accountId: user?.id,
      version,
      platform,
    });
    setSending(true);
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) throw new Error('no mail app');
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        'No email app found',
        `Please email ${contacts.email} with “[RydAid] ${category}” as the subject and describe the problem.`,
      );
    } finally {
      setSending(false);
    }
  };

  const openExtra = (o: Extra) => {
    Linking.openURL(o.url).catch(() => Alert.alert(o.title, `Couldn't open it. You can reach us at: ${o.value}`));
  };

  return (
    <KeyboardAwareScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title} accessibilityRole="header">
        Report a problem
      </Text>
      <Text style={styles.lead}>
        Something not working in RydAid? Tell us and our team will look into it
        {contacts.hours ? ` (${contacts.hours})` : ''}.
      </Text>

      <SectionCard title="What is it about?" style={styles.card}>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {PROBLEM_CATEGORIES.map((c) => {
            const on = category === c;
            return (
              <Pressable
                key={c}
                style={[styles.chip, on && styles.chipOn, !!categoryError && !on && styles.chipErr]}
                onPress={() => setCategory(c)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>
        {categoryError ? <Text style={styles.err}>{categoryError}</Text> : null}
      </SectionCard>

      <SectionCard title="What happened?" style={styles.card}>
        <TextField
          multiline
          placeholder="What were you doing, what did you expect, and what happened instead?"
          value={description}
          onChangeText={setDescription}
          error={descriptionError}
          helper="Got a screenshot? Attach it in your email app before sending."
          maxLength={2000}
          containerStyle={styles.noMargin}
          accessibilityLabel="Describe the problem"
        />
      </SectionCard>

      <Button title="Send report" size="large" loading={sending} onPress={() => void send()} />
      <Text style={styles.sendNote}>
        Opens your email app addressed to <Text style={styles.bold}>{contacts.email}</Text>. Your role, account number, app
        version and device are added for you.
      </Text>

      {extras.length > 0 ? (
        <SectionCard title="Other ways to reach us" style={[styles.card, styles.extrasCard]} flush>
          {extras.map((o, i) => (
            <Pressable
              key={o.key}
              style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && styles.rowPressed]}
              onPress={() => openExtra(o)}
              accessibilityRole="button"
              accessibilityLabel={`${o.title}, ${o.value}`}
            >
              <View style={styles.rowIcon}>
                <DrawerIcon name={o.icon} color={colors.primary} bg={colors.primarySoft} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{o.title}</Text>
                <Text style={styles.rowValue} numberOfLines={1}>
                  {o.value}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </SectionCard>
      ) : null}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl + spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  title: { ...type.display, letterSpacing: -0.4 },
  lead: { ...type.body, color: colors.muted, marginTop: spacing.xs, marginBottom: spacing.lg },
  card: { marginBottom: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: touch.min,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipErr: { borderColor: colors.dangerBorder },
  chipText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  chipTextOn: { color: colors.primaryInk },
  err: { color: colors.danger, fontSize: 13, fontWeight: '600', marginTop: spacing.sm },
  noMargin: { marginBottom: 0 },
  sendNote: { ...type.caption, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
  bold: { fontWeight: '700', color: colors.text },
  extrasCard: { marginTop: spacing.xs },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  rowValue: { fontSize: 14, color: colors.muted, marginTop: 2 },
  chevron: { fontSize: 24, color: colors.mutedSoft },
});
