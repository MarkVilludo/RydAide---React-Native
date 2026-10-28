import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { MechanicActiveJobScreen } from '../screens/mechanic/MechanicActiveJobScreen';
import { MechanicHomeScreen } from '../screens/mechanic/MechanicHomeScreen';
import { MechanicOnboardingScreen } from '../screens/mechanic/MechanicOnboardingScreen';
import { MechanicIncomingRequestDetailScreen } from '../screens/mechanic/MechanicIncomingRequestDetailScreen';
import { MechanicIncomingScreen } from '../screens/mechanic/MechanicIncomingScreen';
import { MechanicRequestDetailScreen } from '../screens/mechanic/MechanicRequestDetailScreen';
import { MechanicRequestsScreen } from '../screens/mechanic/MechanicRequestsScreen';
import { MechanicSubscriptionScreen } from '../screens/mechanic/MechanicSubscriptionScreen';
import { MechanicLocationProvider } from '../context/MechanicLocationContext';
import type { MechanicStackParamList } from './types';

const Stack = createNativeStackNavigator<MechanicStackParamList>();

export function MechanicNavigator() {
  return (
    <MechanicLocationProvider>
    <Stack.Navigator>
      <Stack.Screen name="MechanicHome" component={MechanicHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="MechanicOnboarding"
        component={MechanicOnboardingScreen}
        options={{ title: 'Your listing' }}
      />
      <Stack.Screen name="MechanicRequests" component={MechanicRequestsScreen} options={{ title: 'My requests' }} />
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
    </Stack.Navigator>
    </MechanicLocationProvider>
  );
}
