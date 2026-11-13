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
import { OwnerActiveJobRecovery } from '../components/OwnerActiveJobRecovery';
import { DeleteAccountScreen } from '../screens/account/DeleteAccountScreen';
import { ProfileScreen } from '../screens/account/ProfileScreen';
import { ContactSupportScreen } from '../screens/account/ContactSupportScreen';
import { PaymentMethodFormScreen } from '../screens/account/PaymentMethodFormScreen';
import { PaymentMethodsScreen } from '../screens/account/PaymentMethodsScreen';
import { OwnerHomeScreen } from '../screens/owner/OwnerHomeScreen';
import { MyVehiclesScreen } from '../screens/owner/MyVehiclesScreen';
import { VehicleFormScreen } from '../screens/owner/VehicleFormScreen';
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
    <>
      <OwnerActiveJobRecovery />
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
        getId={({ params }) => String(params.helpRequestId)}
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
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ title: 'Delete account' }} />
      <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} options={{ title: 'Payment methods' }} />
      <Stack.Screen name="ContactSupport" component={ContactSupportScreen} options={{ title: 'Contact Support' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="MyVehicles" component={MyVehiclesScreen} options={{ title: 'My vehicles' }} />
      <Stack.Screen
        name="VehicleForm"
        component={VehicleFormScreen}
        options={({ route }) => ({ title: route.params?.vehicle ? 'Edit vehicle' : 'Add a vehicle' })}
      />
      <Stack.Screen
        name="PaymentMethodForm"
        component={PaymentMethodFormScreen}
        options={({ route }) => ({ title: route.params?.wallet ? 'Edit wallet' : 'Add a wallet' })}
      />
    </Stack.Navigator>
    </>
  );
}

export function OwnerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <OwnerDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: { width: 312, backgroundColor: '#ffffff' },
        overlayColor: 'rgba(15, 23, 42, 0.45)',
      }}
    >
      <Drawer.Screen name="OwnerMain" component={OwnerStackNavigator} options={{ drawerItemStyle: { display: 'none' } }} />
    </Drawer.Navigator>
  );
}
