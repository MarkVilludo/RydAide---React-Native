import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type OwnerStackParamList = {
  OwnerHome: undefined;
  FindMechanic: undefined;
  NeedHelp: {
    emergency?: boolean;
    latitude?: number;
    longitude?: number;
  };
  ActiveHelpRequest: { helpRequestId: number };
  HelpRequestHistory: undefined;
  HelpRequestDetail: { helpRequestId: number };
  FindShop: undefined;
};

export type OwnerDrawerParamList = {
  OwnerMain: NavigatorScreenParams<OwnerStackParamList>;
};

export type MechanicStackParamList = {
  MechanicHome: undefined;
  MechanicOnboarding: undefined;
  MechanicRequests: { tab?: 'incoming' | 'accepted_active' | 'in_progress' | 'completed' | 'declined' | 'cancelled_expired' };
  IncomingRequests: undefined;
  IncomingRequestDetail: { helpRequestId: number };
  MechanicRequestDetail: { helpRequestId: number };
  ActiveJob: { helpRequestId: number; justAccepted?: boolean; initialRequest?: import('../api/helpRequests').HelpRequest };
  MechanicSubscription: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  OwnerApp: undefined;
  MechanicApp: undefined;
};
