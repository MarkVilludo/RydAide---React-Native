import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppConfig } from '../hooks/useAppConfig';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import { AppDrawerShell, DrawerItem, DrawerSection } from './AppDrawerShell';
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
      avatarUrl={user?.avatar_url ? resolveMediaUrl(user.avatar_url) : null}
      onProfilePress={() => goTo('Profile')}
      roleLabel="Mechanic"
      footer={
        // Account deletion lives only on Profile → Account settings (too easy to tap by accident here).
        <DrawerItem
          icon="logout"
          label="Sign out"
          onPress={() => {
            navigation.closeDrawer();
            signOut();
          }}
        />
      }
    >
      <DrawerSection first>
        <DrawerItem icon="map" label="Dashboard" onPress={() => goTo('MechanicHome')} />
        {emergencyOn ? (
          <DrawerItem
            icon="toolbox"
            label="Requests"
            hint="Incoming offers and your jobs"
            onPress={() => goTo('MechanicRequests', { tab: 'incoming' })}
          />
        ) : null}
        <DrawerItem icon="pin" label="Work location" onPress={() => goTo('MechanicWorkLocation')} />
      </DrawerSection>
      <DrawerSection title="Account">
        <DrawerItem icon="listing" label="Your listing" hint="Your public mechanic profile" onPress={() => goTo('MechanicOnboarding')} />
        <DrawerItem
          icon="wallet"
          label="Payment methods"
          hint="Cash and the wallets customers pay you with"
          badge={{ text: 'NEW', tone: 'new' }}
          onPress={() => goTo('PaymentMethods')}
        />
        {subscriptionsOn ? <DrawerItem icon="crown" label="Mechanic Pro" onPress={() => goTo('MechanicSubscription')} /> : null}
      </DrawerSection>
      <DrawerSection title="Help">
        <DrawerItem icon="headset" label="Contact Support" hint="Report a problem" onPress={() => goTo('ContactSupport')} />
      </DrawerSection>
    </AppDrawerShell>
  );
}
