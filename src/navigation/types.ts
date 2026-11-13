import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  /** Optional role preselected from the login screen's role chips. */
  Register: { role?: 'owner' | 'mechanic' } | undefined;
  ForgotPassword: undefined;
  ResetPassword: { email?: string; token?: string } | undefined;
};

/** Shared by owner and mechanic stacks. */
export type PaymentMethodsParamList = {
  PaymentMethods: undefined;
  PaymentMethodForm:
    | {
        wallet?: import('../api/paymentMethods').PaymentWallet;
        maxQrMb?: number;
        /** First wallet defaults to preferred. */
        firstWallet?: boolean;
      }
    | undefined;
  ContactSupport: undefined;
  Profile: undefined;
  DeleteAccount: undefined;
};

/** Screens the shared Profile screen can open (present in both stacks). */
export type ProfileParamList = PaymentMethodsParamList;

export type OwnerStackParamList = PaymentMethodsParamList & {
  OwnerHome: undefined;
  FindMechanic: undefined;
  NeedHelp: {
    emergency?: boolean;
    latitude?: number;
    longitude?: number;
    vehicleDescription?: string;
    problemCategoryId?: number;
    problemCategoryIds?: number[];
    /** Structured vehicle details from a previous request (failed match retry). */
    vehicleForm?: import('../utils/helpVehicle').HelpVehicleForm;
    remarks?: string;
    landmark?: string;
    addressText?: string;
    answers?: Array<{ question_id: number; answer: string }>;
    photoUris?: string[];
    /** Opened from a failed dispatch — prefill fields and jump to review when possible. */
    fromFailedMatch?: boolean;
  };
  ActiveHelpRequest: {
    helpRequestId: number;
    /** Fresh create payload so the wait countdown starts correctly before the first poll. */
    initialRequest?: import('../api/helpRequests').HelpRequest;
  };
  HelpRequestHistory: undefined;
  HelpRequestDetail: { helpRequestId: number };
  FindShop: undefined;
  DeleteAccount: undefined;
  /** Owner garage: saved vehicles (add, edit, remove, default). */
  MyVehicles: undefined;
  /** Add (no params / prefill) or edit (vehicle) a saved vehicle. */
  VehicleForm:
    | {
        vehicle?: import('../api/vehicles').OwnerVehicle;
        /** e.g. the last vehicle remembered on this device. */
        prefill?: import('../utils/helpVehicle').HelpVehicleForm;
      }
    | undefined;
};

export type OwnerDrawerParamList = {
  OwnerMain: NavigatorScreenParams<OwnerStackParamList>;
};

export type MechanicStackParamList = PaymentMethodsParamList & {
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
