import { createDrawerNavigator } from '@react-navigation/drawer';
import { DrawerActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, Text } from 'react-native';
import { ActiveHelpRequestScreen } from '../screens/owner/ActiveHelpRequestScreen';
import { FindMechanicScreen } from '../screens/owner/FindMechanicScreen';
import { FindShopScreen } from '../screens/owner/FindShopScreen';
import { NeedHelpScreen } from '../screens/owner/NeedHelpScreen';
import { HelpRequestDetailScreen } from '../screens/owner/HelpRequestDetailScreen';
import { HelpRequestHistoryScreen } from '../screens/owner/HelpRequestHistoryScreen';
import { OwnerHomeScreen } from '../screens/owner/OwnerHomeScreen';
import { OwnerDrawerContent } from './OwnerDrawerContent';
import type { OwnerDrawerParamList, OwnerStackParamList } from './types';

const Drawer = createDrawerNavigator<OwnerDrawerParamList>();
const Stack = createNativeStackNavigator<OwnerStackParamList>();

type OwnerStackNav = {
  dispatch: (action: ReturnType<typeof DrawerActions.openDrawer>) => void;
  canGoBack: () => boolean;
  goBack: () => void;
};

function DrawerMenuButton({ navigation }: { navigation: OwnerStackNav }) {
  return (
    <Pressable
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      style={{ paddingHorizontal: 16, paddingVertical: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
    >
      <Text style={{ fontSize: 22, color: '#0f172a' }}>☰</Text>
    </Pressable>
  );
}

function StackHeaderLeft({ navigation }: { navigation: OwnerStackNav }) {
  if (navigation.canGoBack()) {
    return (
      <Pressable
        onPress={() => navigation.goBack()}
        style={{ paddingHorizontal: 12, paddingVertical: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text style={{ fontSize: 17, color: '#0284c7', fontWeight: '500' }}>‹ Back</Text>
      </Pressable>
    );
  }
  return <DrawerMenuButton navigation={navigation} />;
}

function OwnerStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        headerTintColor: '#0284c7',
        headerLeft: () => <StackHeaderLeft navigation={navigation} />,
      })}
    >
      <Stack.Screen name="OwnerHome" component={OwnerHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="NeedHelp" component={NeedHelpScreen} options={{ title: 'Request help' }} />
      <Stack.Screen
        name="ActiveHelpRequest"
        component={ActiveHelpRequestScreen}
        options={{ title: '', headerShadowVisible: false, headerTransparent: true }}
      />
      <Stack.Screen name="FindMechanic" component={FindMechanicScreen} options={{ title: 'Nearby mechanics' }} />
      <Stack.Screen name="FindShop" component={FindShopScreen} options={{ title: 'Find shop' }} />
      <Stack.Screen
        name="HelpRequestHistory"
        component={HelpRequestHistoryScreen}
        options={{ title: 'Help requests' }}
      />
      <Stack.Screen name="HelpRequestDetail" component={HelpRequestDetailScreen} options={{ title: 'Request details' }} />
    </Stack.Navigator>
  );
}

export function OwnerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <OwnerDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: { width: 300 },
        overlayColor: 'rgba(15, 23, 42, 0.45)',
      }}
    >
      <Drawer.Screen name="OwnerMain" component={OwnerStackNavigator} options={{ drawerItemStyle: { display: 'none' } }} />
    </Drawer.Navigator>
  );
}
