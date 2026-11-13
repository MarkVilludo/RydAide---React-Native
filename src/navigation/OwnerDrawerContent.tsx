import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import React from 'react';
import { View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAppConfig } from '../hooks/useAppConfig';
import { confirmBeforeDeleteAccountFlow } from '../utils/deleteAccountConfirm';
import { AppDrawerShell, DrawerLink } from './AppDrawerShell';
import type { OwnerStackParamList } from './types';

type StackRoute = keyof OwnerStackParamList;

export function OwnerDrawerContent({ navigation }: DrawerContentComponentProps) {
  const { user, signOut } = useAuth();
  const { config } = useAppConfig();
  const emergencyOn = config?.features?.emergency_assistance ?? false;

  const goTo = (screen: StackRoute) => {
    navigation.navigate('OwnerMain', { screen });
    navigation.closeDrawer();
  };

  return (
    <AppDrawerShell
      name={user?.name?.trim() || 'Owner'}
      email={user?.email ?? ''}
      roleLabel="Vehicle owner"
      footer={
        <>
          <DrawerLink
            label="Delete account"
            muted
            danger
            onPress={() => {
              confirmBeforeDeleteAccountFlow(() => {
                navigation.closeDrawer();
                navigation.navigate('OwnerMain', { screen: 'DeleteAccount' });
              });
            }}
          />
          <DrawerLink
            label="Sign out"
            muted
            onPress={() => {
              navigation.closeDrawer();
              signOut();
            }}
          />
        </>
      }
    >
      <View>
        <DrawerLink label="Home" onPress={() => goTo('OwnerHome')} />
        {emergencyOn ? (
          <DrawerLink label="Help requests" onPress={() => goTo('HelpRequestHistory')} />
        ) : null}
      </View>
    </AppDrawerShell>
  );
}
