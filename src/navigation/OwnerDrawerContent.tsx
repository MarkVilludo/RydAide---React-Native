import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppConfig } from '../hooks/useAppConfig';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import { AppDrawerShell, DrawerItem, DrawerSection } from './AppDrawerShell';
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
      avatarUrl={user?.avatar_url ? resolveMediaUrl(user.avatar_url) : null}
      onProfilePress={() => goTo('Profile')}
      roleLabel="Vehicle owner"
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
        <DrawerItem icon="home" label="Home" onPress={() => goTo('OwnerHome')} />
        {emergencyOn ? (
          <DrawerItem icon="history" label="Help requests" hint="Your active and past requests" onPress={() => goTo('HelpRequestHistory')} />
        ) : null}
        <DrawerItem icon="wrench" label="Nearby mechanics" onPress={() => goTo('FindMechanic')} />
        <DrawerItem icon="store" label="Find a shop" onPress={() => goTo('FindShop')} />
      </DrawerSection>
      <DrawerSection title="Account">
        <DrawerItem icon="car" label="My vehicles" hint="Add, edit or set a default" onPress={() => goTo('MyVehicles')} />
        <DrawerItem
          icon="wallet"
          label="Payment methods"
          hint="Cash and your saved wallets"
          badge={{ text: 'NEW', tone: 'new' }}
          onPress={() => goTo('PaymentMethods')}
        />
      </DrawerSection>
      <DrawerSection title="Help">
        <DrawerItem icon="headset" label="Contact Support" hint="Report a problem" onPress={() => goTo('ContactSupport')} />
      </DrawerSection>
    </AppDrawerShell>
  );
}
