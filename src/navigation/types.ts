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
  FindShop: undefined;
};

export type MechanicStackParamList = {
  MechanicHome: undefined;
  IncomingRequests: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  OwnerApp: undefined;
  MechanicApp: undefined;
};
