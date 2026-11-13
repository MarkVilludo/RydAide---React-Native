import Constants from 'expo-constants';
import React, { type ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DrawerIcon, type DrawerIconName } from '../components/DrawerIcons';
import { colors } from '../theme/colors';
import { statusBarTopInset } from '../utils/screenInsets';

const BAND = {
  sky: '#e0f2fe',
  far: '#bae6fd',
  near: '#7dd3fc',
  window: '#f0f9ff',
  sun: '#fbbf24',
  sunGlow: '#fde68a',
};

export type DrawerBadge = { text: string; tone?: 'count' | 'new' | 'beta' };

/** One drawer row: 24px outline icon, 17pt label, 56px tall (Angkas-style list, RydAid colors). */
export function DrawerItem({
  icon,
  label,
  onPress,
  badge,
  danger,
  muted,
  hint,
}: {
  icon: DrawerIconName;
  label: string;
  onPress: () => void;
  badge?: DrawerBadge | null;
  danger?: boolean;
  muted?: boolean;
  /** Extra screen-reader context, e.g. "Opens your saved wallets". */
  hint?: string;
}) {
  const tint = danger ? colors.danger : muted ? colors.muted : colors.text;
  const a11yLabel = badge ? `${label}, ${badge.tone === 'count' ? `${badge.text} new` : badge.text}` : label;
  return (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={hint}
      android_ripple={{ color: colors.surfaceMuted }}
    >
      <View style={styles.itemIcon}>
        <DrawerIcon name={icon} color={tint} />
      </View>
      <Text style={[styles.itemLabel, muted && styles.itemLabelMuted, danger && { color: colors.danger }]} numberOfLines={1}>
        {label}
      </Text>
      {badge ? (
        <View
          style={[
            styles.badge,
            badge.tone === 'count' && styles.badgeCount,
            badge.tone === 'beta' && styles.badgeBeta,
            (badge.tone ?? 'new') === 'new' && styles.badgeNew,
          ]}
        >
          <Text style={[styles.badgeText, badge.tone === 'count' && styles.badgeTextCount]}>{badge.text}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** @deprecated Use DrawerItem. Kept so older imports keep compiling. */
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
  return <DrawerItem icon={danger ? 'trash' : 'logout'} label={label} onPress={onPress} danger={danger} muted={muted} />;
}

export function DrawerSection({ title, children, first }: { title?: string; children: ReactNode; first?: boolean }) {
  return (
    <View style={[styles.section, !first && styles.sectionDivider]} accessibilityRole={title ? 'menu' : undefined}>
      {title ? (
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/** Light-blue band with a simple skyline and sun, drawn with Views (no SVG package in the app). */
function HeaderBand() {
  const far = [
    { w: 22, h: 34 }, { w: 16, h: 52 }, { w: 26, h: 40 }, { w: 14, h: 60 }, { w: 24, h: 30 },
    { w: 18, h: 46 }, { w: 28, h: 36 }, { w: 16, h: 56 }, { w: 22, h: 28 }, { w: 30, h: 44 },
  ];
  const near = [
    { w: 30, h: 26 }, { w: 20, h: 38 }, { w: 34, h: 22 }, { w: 18, h: 44 }, { w: 28, h: 30 },
    { w: 24, h: 20 }, { w: 22, h: 34 }, { w: 36, h: 24 }, { w: 20, h: 40 },
  ];
  return (
    <View style={styles.bandArt} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.sunGlow} />
      <View style={styles.sun} />
      <View style={[styles.skyline, { bottom: 14 }]}>
        {far.map((b, i) => (
          <View key={`f${i}`} style={{ width: b.w, height: b.h, backgroundColor: BAND.far, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
        ))}
      </View>
      <View style={[styles.skyline, { bottom: 0 }]}>
        {near.map((b, i) => (
          <View key={`n${i}`} style={{ width: b.w, height: b.h + 14, backgroundColor: BAND.near, borderTopLeftRadius: 2, borderTopRightRadius: 2 }}>
            {b.h > 30 ? (
              <View style={styles.windows}>
                <View style={styles.window} />
                <View style={styles.window} />
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]![0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]![0] ?? '' : '';
  return (first + last).toUpperCase();
}

type ShellProps = {
  name: string;
  email: string;
  roleLabel?: string;
  /** Profile photo URL (falls back to initials). */
  avatarUrl?: string | null;
  /** When set, the name row shows a chevron and opens the profile. */
  onProfilePress?: () => void;
  children: ReactNode;
  footer: ReactNode;
};

export function AppDrawerShell({ name, email, roleLabel, avatarUrl, onProfilePress, children, footer }: ShellProps) {
  const version = Constants.expoConfig?.version;
  const top = statusBarTopInset();

  const identity = (
    <>
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {onProfilePress ? <Text style={styles.chevron}>›</Text> : null}
      </View>
      <View style={styles.metaRow}>
        {roleLabel ? (
          <View style={styles.rolePill}>
            <Text style={styles.roleText} numberOfLines={1}>
              {roleLabel}
            </Text>
          </View>
        ) : null}
        {email ? (
          <Text style={styles.email} numberOfLines={1}>
            {email}
          </Text>
        ) : null}
      </View>
    </>
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll} bounces={false}>
      <View style={[styles.band, { paddingTop: top, height: 150 + top }]}>
        <HeaderBand />
      </View>

      <View style={styles.header}>
        <Pressable
          onPress={onProfilePress}
          disabled={!onProfilePress}
          style={styles.avatar}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{initialsOf(name)}</Text>
          )}
        </Pressable>
        {onProfilePress ? (
          <Pressable
            onPress={onProfilePress}
            style={({ pressed }) => [styles.identity, pressed && styles.itemPressed]}
            accessibilityRole="button"
            accessibilityLabel={`${name}, ${roleLabel ?? ''}. Open profile`}
          >
            {identity}
          </Pressable>
        ) : (
          <View style={styles.identity} accessible accessibilityLabel={`${name}${roleLabel ? `, ${roleLabel}` : ''}${email ? `, ${email}` : ''}`}>
            {identity}
          </View>
        )}
      </View>

      <View style={styles.body}>{children}</View>

      <View style={styles.footer}>
        {footer}
        {version ? <Text style={styles.version}>RydAid v{version}</Text> : null}
      </View>
    </ScrollView>
  );
}

const AVATAR = 72;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1, paddingBottom: 24 },
  band: { backgroundColor: BAND.sky, overflow: 'hidden' },
  bandArt: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sunGlow: {
    position: 'absolute',
    right: 30,
    bottom: 58,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: BAND.sunGlow,
    opacity: 0.6,
  },
  sun: {
    position: 'absolute',
    right: 40,
    bottom: 68,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BAND.sun,
  },
  skyline: {
    position: 'absolute',
    left: -6,
    right: -6,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  windows: { flexDirection: 'row', gap: 4, padding: 5, flexWrap: 'wrap' },
  window: { width: 4, height: 5, borderRadius: 1, backgroundColor: BAND.window, opacity: 0.85 },
  header: { paddingHorizontal: 20, marginTop: -AVATAR / 2 },
  avatarImage: { width: '100%', height: '100%', borderRadius: 999 },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.onPrimary, fontSize: 26, fontWeight: '800', letterSpacing: 0.5 },
  identity: { marginTop: 10, minHeight: 44, justifyContent: 'center', borderRadius: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  chevron: { fontSize: 26, fontWeight: '600', color: colors.muted, marginTop: -2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  roleText: { fontSize: 12, fontWeight: '700', color: colors.primaryInk },
  email: { flexShrink: 1, fontSize: 13, color: colors.muted },
  body: { flexGrow: 1, paddingTop: 12 },
  section: { paddingVertical: 6 },
  sectionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginHorizontal: 0 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedSoft,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 2,
  },
  item: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 18,
  },
  itemPressed: { backgroundColor: colors.surfaceMuted },
  itemIcon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  itemLabel: { flex: 1, fontSize: 17, fontWeight: '600', color: colors.text, letterSpacing: -0.2 },
  itemLabelMuted: { fontSize: 15, fontWeight: '500', color: colors.muted },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, minWidth: 22, alignItems: 'center' },
  badgeCount: { backgroundColor: colors.danger },
  badgeNew: { backgroundColor: colors.primary },
  badgeBeta: { backgroundColor: colors.primary },
  badgeText: { fontSize: 11, fontWeight: '800', color: colors.onPrimary, letterSpacing: 0.4 },
  badgeTextCount: { fontSize: 12 },
  footer: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  version: { fontSize: 12, color: colors.mutedSoft, paddingHorizontal: 20, paddingTop: 10 },
});
