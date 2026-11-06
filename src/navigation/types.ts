import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email?: string; token?: string } | undefined;
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
  DeleteAccount: undefined;
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
  MechanicWorkLocation: undefined;
  DeleteAccount: undefined;
};

export type MechanicDrawerParamList = {
  MechanicMain: NavigatorScreenParams<MechanicStackParamList>;
};

export type RootStackParamList = {
  Auth: undefined;
  VerifyEmail: undefined;
  OwnerApp: NavigatorScreenParams<OwnerDrawerParamList> | undefined;
  MechanicApp: NavigatorScreenParams<MechanicDrawerParamList> | undefined;
};
