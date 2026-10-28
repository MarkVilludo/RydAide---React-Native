import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { AddVehicleScreen } from '../screens/owner/AddVehicleScreen';
import { ActiveHelpRequestScreen } from '../screens/owner/ActiveHelpRequestScreen';
import { FindMechanicScreen } from '../screens/owner/FindMechanicScreen';
import { FindShopScreen } from '../screens/owner/FindShopScreen';
import { NeedHelpScreen } from '../screens/owner/NeedHelpScreen';
import { MyVehiclesScreen } from '../screens/owner/MyVehiclesScreen';
import { HelpCreditsScreen } from '../screens/owner/HelpCreditsScreen';
import { HelpRequestDetailScreen } from '../screens/owner/HelpRequestDetailScreen';
import { HelpRequestHistoryScreen } from '../screens/owner/HelpRequestHistoryScreen';
import { OwnerHomeScreen } from '../screens/owner/OwnerHomeScreen';
import type { OwnerStackParamList } from './types';

const Stack = createNativeStackNavigator<OwnerStackParamList>();

export function OwnerNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="OwnerHome" component={OwnerHomeScreen} options={{ title: 'RydAid' }} />
      <Stack.Screen name="MyVehicles" component={MyVehiclesScreen} options={{ title: 'My vehicles' }} />
      <Stack.Screen name="AddVehicle" component={AddVehicleScreen} options={{ title: 'Add vehicle' }} />
      <Stack.Screen name="NeedHelp" component={NeedHelpScreen} options={{ title: 'Need help' }} />
      <Stack.Screen name="ActiveHelpRequest" component={ActiveHelpRequestScreen} options={{ title: 'Your request' }} />
      <Stack.Screen name="FindMechanic" component={FindMechanicScreen} options={{ title: 'Find mechanic' }} />
      <Stack.Screen name="FindShop" component={FindShopScreen} options={{ title: 'Find shop' }} />
      <Stack.Screen name="HelpRequestHistory" component={HelpRequestHistoryScreen} options={{ title: 'My help history' }} />
      <Stack.Screen name="HelpRequestDetail" component={HelpRequestDetailScreen} options={{ title: 'Request details' }} />
      <Stack.Screen name="HelpCredits" component={HelpCreditsScreen} options={{ title: 'Help credits' }} />
    </Stack.Navigator>
  );
}
