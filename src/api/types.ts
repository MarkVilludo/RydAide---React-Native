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

export interface Entitlements {
  plan_code: string;
  max_vehicles?: number | null;
  unlimited_vehicles?: boolean;
  max_help_requests?: number | null;
  max_emergency_requests?: number | null;
  unlimited_help_requests?: boolean;
  max_accepted_requests?: number | null;
  unlimited_accepted_requests?: boolean;
}
