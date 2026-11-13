import { DrawerContentScrollView } from '@react-navigation/drawer';
import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandLogo } from '../components/BrandLogo';
import { colors } from '../theme/colors';
import { statusBarTopInset } from '../utils/screenInsets';

export function DrawerLink({
  label,
  onPress,
  danger,
  muted,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  muted?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text
        style={[
          styles.linkLabel,
          muted && styles.linkMuted,
          danger && styles.linkDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function DrawerSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

type ShellProps = {
  name: string;
  email: string;
  roleLabel?: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AppDrawerShell({ name, email, roleLabel, children, footer }: ShellProps) {
  return (
    <DrawerContentScrollView
      contentContainerStyle={[styles.scroll, { paddingTop: statusBarTopInset() + 12 }]}
      style={styles.root}
    >
      <View style={styles.header}>
        <BrandLogo width={128} style={styles.logo} />
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {roleLabel ? (
          <Text style={styles.role} numberOfLines={1}>
            {roleLabel}
          </Text>
        ) : null}
        {email ? (
          <Text style={styles.email} numberOfLines={1}>
            {email}
          </Text>
        ) : null}
      </View>

      <View style={styles.body}>{children}</View>

      <View style={styles.footer}>
        <View style={styles.rule} />
        {footer}
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingBottom: 28,
  },
  header: {
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  logo: { alignSelf: 'flex-start', marginBottom: 18 },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  role: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryInk,
    letterSpacing: 0.2,
  },
  email: {
    marginTop: 4,
    fontSize: 13,
    color: colors.muted,
  },
  body: {
    flexGrow: 1,
    paddingTop: 8,
  },
  section: {
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.mutedSoft,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
    marginTop: 4,
  },
  link: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  linkPressed: { opacity: 0.55 },
  linkLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.2,
  },
  linkMuted: {
    fontWeight: '500',
    color: colors.muted,
  },
  linkDanger: {
    color: colors.danger,
    fontWeight: '600',
  },
  footer: {
    marginTop: 12,
    paddingTop: 4,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
});
