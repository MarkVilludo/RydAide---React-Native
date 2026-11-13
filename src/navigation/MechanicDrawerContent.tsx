import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import React from 'react';
import { View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAppConfig } from '../hooks/useAppConfig';
import { confirmBeforeDeleteAccountFlow } from '../utils/deleteAccountConfirm';
import { AppDrawerShell, DrawerLink } from './AppDrawerShell';
import type { MechanicStackParamList } from './types';

type StackRoute = keyof MechanicStackParamList;

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
    <AppDrawerShell
      name={user?.name?.trim() || 'Mechanic'}
      email={user?.email ?? ''}
      roleLabel="Mechanic"
      footer={
        <>
          <DrawerLink
            label="Delete account"
            muted
            danger
            onPress={() => {
              confirmBeforeDeleteAccountFlow(() => {
                navigation.closeDrawer();
                navigation.navigate('MechanicMain', { screen: 'DeleteAccount' });
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
        <DrawerLink label="Dashboard" onPress={() => goTo('MechanicHome')} />
        {emergencyOn ? (
          <DrawerLink label="Requests" onPress={() => goTo('MechanicRequests', { tab: 'incoming' })} />
        ) : null}
        <DrawerLink label="Your listing" onPress={() => goTo('MechanicOnboarding')} />
        {subscriptionsOn ? (
          <DrawerLink label="Mechanic Pro" onPress={() => goTo('MechanicSubscription')} />
        ) : null}
      </View>
    </AppDrawerShell>
  );
}
