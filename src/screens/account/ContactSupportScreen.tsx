import Constants from 'expo-constants';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CenteredLoading } from '../../components/CenteredLoading';
import { DrawerIcon, type DrawerIconName } from '../../components/DrawerIcons';
import { useAuth } from '../../context/AuthContext';
import { useAppConfig } from '../../hooks/useAppConfig';
import type { PaymentMethodsParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { hasAnySupportContact, resolveSupportContacts } from '../../utils/supportContacts';

type Props = NativeStackScreenProps<PaymentMethodsParamList, 'ContactSupport'>;

type Option = { key: string; icon: DrawerIconName; title: string; value: string; url: string; hint: string };

/** Owners and mechanics: contact options from server config (or app env fallback). Nothing hard-coded. */
export function ContactSupportScreen(_props: Props) {
  const { user } = useAuth();
  const { config, loading } = useAppConfig();
  const contacts = useMemo(() => resolveSupportContacts(config), [config]);
  const version = Constants.expoConfig?.version ?? '—';
  const roleLabel = user?.role === 'mechanic' ? 'Mechanic' : 'Vehicle owner';
  const reference = `${roleLabel} · Account #${user?.id ?? '—'} · App v${version} (${Platform.OS})`;

  const options: Option[] = [];
  if (contacts.phone) {
    options.push({
      key: 'phone',
      icon: 'phone',
      title: 'Call support',
      value: contacts.phone,
      url: `tel:${contacts.phone.replace(/[^\d+]/g, '')}`,
      hint: 'Opens your phone app',
    });
  }
  if (contacts.messengerUrl) {
    options.push({
      key: 'messenger',
      icon: 'chat',
      title: 'Chat on Messenger',
      value: 'Message our page',
      url: contacts.messengerUrl,
      hint: 'Opens Messenger',
    });
  }
  if (contacts.email) {
    const subject = encodeURIComponent(`RydAid support — ${roleLabel} #${user?.id ?? ''}`);
    const body = encodeURIComponent(`\n\n— Please keep this line —\n${reference}`);
    options.push({
      key: 'email',
      icon: 'mail',
      title: 'Email support',
      value: contacts.email,
      url: `mailto:${contacts.email}?subject=${subject}&body=${body}`,
      hint: 'Opens your email app with your account details filled in',
    });
  }
  if (contacts.faqUrl) {
    options.push({
      key: 'faq',
      icon: 'faq',
      title: 'Help center & FAQ',
      value: 'Answers to common questions',
      url: contacts.faqUrl,
      hint: 'Opens in your browser',
    });
  }

  const open = async (o: Option) => {
    try {
      const supported = await Linking.canOpenURL(o.url);
      if (!supported && !o.url.startsWith('http')) {
        Alert.alert(o.title, `This device can't open it. You can reach us at: ${o.value}`);
        return;
      }
      await Linking.openURL(o.url);
    } catch {
      Alert.alert(o.title, `Couldn't open it. You can reach us at: ${o.value}`);
    }
  };

  if (loading && !config) {
    return <CenteredLoading message="Loading support options…" />;
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>How can we help?</Text>
      <Text style={styles.lead}>
        {contacts.hours ? `Our team is available ${contacts.hours}.` : 'Reach the RydAid team using any option below.'}
      </Text>

      <View style={styles.emergency} accessible accessibilityRole="text">
        <Text style={styles.emergencyTitle}>In danger or in an accident?</Text>
        <Text style={styles.emergencyBody}>Call 911 first. RydAid support can't dispatch emergency services.</Text>
        <Pressable
          style={styles.emergencyBtn}
          onPress={() => void Linking.openURL('tel:911')}
          accessibilityRole="button"
          accessibilityLabel="Call 911"
        >
          <Text style={styles.emergencyBtnText}>Call 911</Text>
        </Pressable>
      </View>

      {hasAnySupportContact(contacts) ? (
        <View style={styles.list}>
          {options.map((o, i) => (
            <Pressable
              key={o.key}
              style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && styles.rowPressed]}
              onPress={() => void open(o)}
              accessibilityRole="button"
              accessibilityLabel={`${o.title}, ${o.value}`}
              accessibilityHint={o.hint}
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
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Support contacts are being set up</Text>
          <Text style={styles.emptyBody}>
            Phone, email and chat options will appear here soon. For a job in progress, call your mechanic or customer from the job screen.
          </Text>
        </View>
      )}

      <Text style={styles.refLabel}>Include this when you contact us</Text>
      <Text style={styles.ref} selectable>
        {reference}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  flex: { flex: 1, minWidth: 0 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  lead: { fontSize: 15, color: colors.muted, marginTop: 4, lineHeight: 21 },
  emergency: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  emergencyTitle: { fontSize: 15, fontWeight: '800', color: colors.dangerInk },
  emergencyBody: { fontSize: 14, color: colors.dangerInk, marginTop: 2, lineHeight: 19 },
  emergencyBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: colors.danger,
    justifyContent: 'center',
  },
  emergencyBtnText: { color: colors.onPrimary, fontSize: 15, fontWeight: '800' },
  list: {
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  rowValue: { fontSize: 14, color: colors.muted, marginTop: 2 },
  chevron: { fontSize: 24, color: colors.mutedSoft },
  empty: {
    marginTop: 16,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptyBody: { fontSize: 14, color: colors.muted, marginTop: 4, lineHeight: 20 },
  refLabel: { fontSize: 12, fontWeight: '700', color: colors.mutedSoft, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 24 },
  ref: { fontSize: 14, color: colors.text, marginTop: 4 },
});
