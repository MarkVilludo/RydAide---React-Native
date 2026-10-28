export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type OwnerStackParamList = {
  OwnerHome: undefined;
  MyVehicles: undefined;
  AddVehicle: undefined;
  FindMechanic: undefined;
  NeedHelp: { emergency?: boolean };
  ActiveHelpRequest: { helpRequestId: number };
  HelpRequestHistory: undefined;
  HelpRequestDetail: { helpRequestId: number };
  HelpCredits: undefined;
  FindShop: undefined;
};

export type MechanicStackParamList = {
  MechanicHome: undefined;
  MechanicOnboarding: undefined;
  MechanicRequests: { tab?: 'incoming' | 'accepted_active' | 'in_progress' | 'completed' | 'declined' | 'cancelled_expired' };
  IncomingRequests: undefined;
  IncomingRequestDetail: { helpRequestId: number };
  MechanicRequestDetail: { helpRequestId: number };
  ActiveJob: { helpRequestId: number; justAccepted?: boolean; initialRequest?: import('../api/helpRequests').HelpRequest };
};

export type RootStackParamList = {
  Auth: undefined;
  OwnerApp: undefined;
  MechanicApp: undefined;
};
