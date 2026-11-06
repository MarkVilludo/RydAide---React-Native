import { createDrawerNavigator } from '@react-navigation/drawer';
import { DrawerActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, Text } from 'react-native';
import { DeleteAccountScreen } from '../screens/account/DeleteAccountScreen';
import { MechanicActiveJobRecovery } from '../components/MechanicActiveJobRecovery';
import { MechanicActiveJobScreen } from '../screens/mechanic/MechanicActiveJobScreen';
import { MechanicHomeScreen } from '../screens/mechanic/MechanicHomeScreen';
import { MechanicOnboardingScreen } from '../screens/mechanic/MechanicOnboardingScreen';
import { MechanicIncomingRequestDetailScreen } from '../screens/mechanic/MechanicIncomingRequestDetailScreen';
import { MechanicIncomingScreen } from '../screens/mechanic/MechanicIncomingScreen';
import { MechanicRequestDetailScreen } from '../screens/mechanic/MechanicRequestDetailScreen';
import { MechanicRequestsScreen } from '../screens/mechanic/MechanicRequestsScreen';
import { MechanicSubscriptionScreen } from '../screens/mechanic/MechanicSubscriptionScreen';
import { MechanicWorkLocationScreen } from '../screens/mechanic/MechanicWorkLocationScreen';
import { MechanicLocationProvider } from '../context/MechanicLocationContext';
import { MechanicDrawerContent } from './MechanicDrawerContent';
import type { MechanicDrawerParamList, MechanicStackParamList } from './types';

const Drawer = createDrawerNavigator<MechanicDrawerParamList>();
const Stack = createNativeStackNavigator<MechanicStackParamList>();

type StackNav = {
  dispatch: (action: ReturnType<typeof DrawerActions.openDrawer>) => void;
  canGoBack: () => boolean;
  goBack: () => void;
};

function DrawerMenuButton({ navigation }: { navigation: StackNav }) {
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

function StackHeaderLeft({ navigation }: { navigation: StackNav }) {
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

function MechanicStackNavigator() {
  return (
    <>
      <MechanicActiveJobRecovery />
      <Stack.Navigator
        screenOptions={({ navigation }) => ({
          headerTintColor: '#0284c7',
          headerLeft: () => <StackHeaderLeft navigation={navigation} />,
        })}
      >
        <Stack.Screen name="MechanicHome" component={MechanicHomeScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="MechanicOnboarding"
          component={MechanicOnboardingScreen}
          options={{ title: 'Your listing' }}
        />
        <Stack.Screen name="MechanicRequests" component={MechanicRequestsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="IncomingRequests" component={MechanicIncomingScreen} options={{ title: 'Incoming requests' }} />
        <Stack.Screen
          name="IncomingRequestDetail"
          component={MechanicIncomingRequestDetailScreen}
          options={{ title: 'Request details' }}
        />
        <Stack.Screen
          name="MechanicRequestDetail"
          component={MechanicRequestDetailScreen}
          options={{ title: 'Request details' }}
        />
        <Stack.Screen name="ActiveJob" component={MechanicActiveJobScreen} options={{ title: 'Active job' }} />
        <Stack.Screen
          name="MechanicSubscription"
          component={MechanicSubscriptionScreen}
          options={{ title: 'Mechanic Pro' }}
        />
        <Stack.Screen
          name="MechanicWorkLocation"
          component={MechanicWorkLocationScreen}
          options={{ title: 'Service location' }}
        />
        <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ title: 'Delete account' }} />
      </Stack.Navigator>
    </>
  );
}

export function MechanicNavigator() {
  return (
    <MechanicLocationProvider>
      <Drawer.Navigator
        drawerContent={(props) => <MechanicDrawerContent {...props} />}
        screenOptions={{
          headerShown: false,
          drawerType: 'front',
          drawerStyle: { width: 300 },
          overlayColor: 'rgba(15, 23, 42, 0.45)',
        }}
      >
        <Drawer.Screen
          name="MechanicMain"
          component={MechanicStackNavigator}
          options={{ drawerItemStyle: { display: 'none' } }}
        />
      </Drawer.Navigator>
    </MechanicLocationProvider>
  );
}
