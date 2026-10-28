import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useAppConfig } from '../hooks/useAppConfig';
import type { OwnerStackParamList } from './types';

type StackRoute = keyof OwnerStackParamList;

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

export function OwnerDrawerContent({ navigation }: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { config } = useAppConfig();
  const emergencyOn = config?.features.emergency_assistance ?? false;

  const goTo = (screen: StackRoute) => {
    navigation.navigate('OwnerMain', { screen });
    navigation.closeDrawer();
  };

  return (
    <DrawerContentScrollView
      contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 16) + 8 }]}
      scrollEnabled={false}
    >
      <Text style={styles.brand}>RydAid</Text>
      <Text style={styles.userName}>{user?.name ?? 'Owner'}</Text>
      <Text style={styles.userEmail}>{user?.email ?? ''}</Text>

      <View style={styles.section}>
        <DrawerRow icon="🏠" label="Home" subtitle="Emergency & nearby search" onPress={() => goTo('OwnerHome')} />
        {emergencyOn ? (
          <>
            <DrawerRow
              icon="📋"
              label="Help requests"
              subtitle="History and request details"
              onPress={() => goTo('HelpRequestHistory')}
            />
          </>
        ) : null}
      </View>

      <View style={styles.divider} />

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
  brand: { fontSize: 22, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 },
  userName: { fontSize: 16, fontWeight: '600', color: '#334155', marginTop: 20 },
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
