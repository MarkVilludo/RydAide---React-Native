import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAppConfig } from '../hooks/useAppConfig';
import { colors, spacing } from '../theme/tokens';
import { hasAnySupportContact, resolveSupportContacts } from '../utils/supportContacts';
import { navigateToContactSupport, openSupportEmail, openSupportFaq } from '../utils/supportActions';

type Props = {
  /** When set, mailto uses this Contact Support category. */
  problemCategory?: string;
  problemHint?: string;
  /** Light text on splash; default for cards. */
  variant?: 'default' | 'onDark';
  onDark?: boolean;
};

/**
 * Compact “Contact support” / FAQ links on error and recovery screens.
 * Signed-in users open the in-app Contact Support flow; signed-out users get mailto.
 */
export function SupportHelpFooter({
  problemCategory = 'App bug',
  problemHint,
  variant = 'default',
}: Props) {
  const { user } = useAuth();
  const { config } = useAppConfig();
  const contacts = resolveSupportContacts(config);
  const onDark = variant === 'onDark';
  const showFaq = Boolean(contacts.faqUrl);
  if (!hasAnySupportContact(contacts) && !user) {
    return null;
  }

  const onContact = () => {
    if (user?.role === 'owner' || user?.role === 'mechanic') {
      navigateToContactSupport(user.role);
      return;
    }
    openSupportEmail(problemCategory, problemHint);
  };

  return (
    <View style={styles.row}>
      <Pressable onPress={onContact} hitSlop={8} accessibilityRole="button" accessibilityLabel="Contact support">
        <Text style={[styles.link, onDark && styles.linkOnDark]}>Contact support</Text>
      </Pressable>
      {showFaq ? (
        <>
          <Text style={[styles.dot, onDark && styles.dotOnDark]}>·</Text>
          <Pressable onPress={openSupportFaq} hitSlop={8} accessibilityRole="link" accessibilityLabel="Open FAQ">
            <Text style={[styles.link, onDark && styles.linkOnDark]}>FAQ</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  link: { fontSize: 14, fontWeight: '700', color: colors.primary },
  linkOnDark: { color: '#e0f2fe' },
  dot: { fontSize: 14, color: colors.muted },
  dotOnDark: { color: 'rgba(255,255,255,0.65)' },
});