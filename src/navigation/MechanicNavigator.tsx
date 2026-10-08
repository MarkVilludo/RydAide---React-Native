import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { MechanicHomeScreen } from '../screens/mechanic/MechanicHomeScreen';
import { MechanicIncomingScreen } from '../screens/mechanic/MechanicIncomingScreen';
import type { MechanicStackParamList } from './types';

const Stack = createNativeStackNavigator<MechanicStackParamList>();

export function MechanicNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="MechanicHome" component={MechanicHomeScreen} options={{ title: 'Dashboard' }} />
      <Stack.Screen name="IncomingRequests" component={MechanicIncomingScreen} options={{ title: 'Incoming requests' }} />
    </Stack.Navigator>
  );
}
