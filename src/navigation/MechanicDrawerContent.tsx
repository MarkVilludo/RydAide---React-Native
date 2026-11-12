import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';
import { useAppConfig } from '../hooks/useAppConfig';
import type { MechanicStackParamList } from './types';
import { confirmBeforeDeleteAccountFlow } from '../utils/deleteAccountConfirm';
import { statusBarTopInset } from '../utils/screenInsets';

type StackRoute = keyof MechanicStackParamList;

function DrawerRow({
  label,
  subtitle,
  icon,
  onPress,
  danger,
}: {
  label: string;
  subtitle?: string;
  icon: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

export function MechanicDrawerContent({ navigation }: DrawerContentComponentProps) {
  const { user, signOut } = useAuth();
  const { config } = useAppConfig();
  const emergencyOn = config?.features?.emergency_assistance ?? false;
  const subscriptionsOn = config?.features?.mechanic_subscriptions ?? false;

  const goTo = (screen: StackRoute, params?: MechanicStackParamList[StackRoute]) => {
    navigation.navigate('MechanicMain', params !== undefined ? { screen, params } : { screen });
    navigation.closeDrawer();
  };

  return (
    <DrawerContentScrollView
      contentContainerStyle={[styles.scroll, { paddingTop: statusBarTopInset() + 8 }]}
      scrollEnabled={false}
    >
      <BrandLogo width={140} style={styles.brandLogo} />
      <Text style={styles.roleBadge}>Mechanic</Text>
      <Text style={styles.userName}>{user?.name ?? 'Mechanic'}</Text>
      <Text style={styles.userEmail}>{user?.email ?? ''}</Text>

      <View style={styles.section}>
        <DrawerRow icon="📊" label="Dashboard" subtitle="Status, queue & location" onPress={() => goTo('MechanicHome')} />
        {emergencyOn ? (
          <>
            <DrawerRow
              icon="📥"
              label="Incoming"
              subtitle="New offers near you"
              onPress={() => goTo('MechanicRequests', { tab: 'incoming' })}
            />
            <DrawerRow
              icon="📋"
              label="All requests"
              subtitle="Accepted, in progress, completed"
              onPress={() => goTo('MechanicRequests', { tab: 'accepted_active' })}
            />
          </>
        ) : null}
        <DrawerRow icon="✏️" label="Your listing" subtitle="Profile & verification" onPress={() => goTo('MechanicOnboarding')} />
        <DrawerRow
          icon="📍"
          label="Service location"
          subtitle="Pin & service area"
          onPress={() => goTo('MechanicWorkLocation')}
        />
        {subscriptionsOn ? (
          <DrawerRow icon="⭐" label="Mechanic Pro" subtitle="Subscription & credits" onPress={() => goTo('MechanicSubscription')} />
        ) : null}
      </View>

      <View style={styles.divider} />

      <DrawerRow
        icon="🗑"
        label="Delete account"
        subtitle="Request data deletion"
        onPress={() => {
          confirmBeforeDeleteAccountFlow(() => {
            navigation.closeDrawer();
            navigation.navigate('MechanicMain', { screen: 'DeleteAccount' });
          });
        }}
        danger
      />

      <DrawerRow
        icon="⎋"
        label="Sign out"
        onPress={() => {
          navigation.closeDrawer();
          signOut();
        }}
        danger
      />
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
  brandLogo: { alignSelf: 'flex-start', marginBottom: 4 },
  roleBadge: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    fontSize: 11,
    fontWeight: '800',
    color: '#0369a1',
    backgroundColor: '#e0f2fe',
    letterSpacing: 0.5,
  },
  userName: { fontSize: 16, fontWeight: '600', color: '#334155', marginTop: 8 },
  userEmail: { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 8 },
  section: { marginTop: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 12,
    gap: 14,
  },
  rowPressed: { backgroundColor: '#f1f5f9' },
  rowIcon: { fontSize: 22, width: 32, textAlign: 'center' },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  rowLabelDanger: { color: '#dc2626' },
  rowSub: { fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 16 },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 8 },
});
