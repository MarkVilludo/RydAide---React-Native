export type UserRole = 'owner' | 'mechanic' | 'supplier' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: string;
  email_verified_at: string | null;
  created_at: string | null;
}

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

export interface AuthPayload {
  user: User;
  token: string;
  token_type: string;
}

export interface HelpRequestsEntitlement {
  limit: number | null;
  used: number;
  remaining: number | null;
  unlimited: boolean;
}

export interface AcceptedRequestsEntitlement {
  limit: number | null;
  used: number;
  remaining: number | null;
  unlimited: boolean;
}

export interface Entitlements {
  plan_code: string;
  max_vehicles?: number | null;
  unlimited_vehicles?: boolean;
  max_help_requests?: number | null;
  help_requests_used?: number;
  help_requests_remaining?: number | null;
  unlimited_help_requests?: boolean;
  help_requests?: HelpRequestsEntitlement;
  directory_listing_free?: boolean;
  max_accepted_requests?: number | null;
  accepted_requests_used?: number;
  accepted_requests_remaining?: number | null;
  unlimited_accepted_requests?: boolean;
  accepted_requests?: AcceptedRequestsEntitlement;
  can_accept_help_requests?: boolean;
  mechanic_pro_monthly_price_php?: number;
}
