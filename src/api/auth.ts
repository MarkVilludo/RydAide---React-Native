import { Platform } from 'react-native';
import { api } from './client';
import type { ApiSuccess, AuthPayload, Entitlements, User } from './types';

function deviceName(): string {
  return `expo-${Platform.OS}`;
}

function parseAuthPayload(data: ApiSuccess<AuthPayload>): AuthPayload {
  if (!data?.success || !data.data?.token || !data.data?.user) {
    throw new Error(data?.message || 'Unexpected login response from server.');
  }
  return data.data;
}

export async function login(email: string, password: string): Promise<AuthPayload> {
  const { data } = await api.post<ApiSuccess<AuthPayload>>('/auth/login', {
    email,
    password,
    device_name: deviceName(),
  });
  return parseAuthPayload(data);
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  role: 'owner' | 'mechanic';
  phone?: string;
}): Promise<AuthPayload> {
  const { data } = await api.post<ApiSuccess<AuthPayload>>('/auth/register', {
    ...input,
    device_name: deviceName(),
  });
  return parseAuthPayload(data);
}

export async function logout(pushToken?: string | null): Promise<void> {
  await api.post('/auth/logout', pushToken ? { push_token: pushToken } : undefined);
}

export async function fetchCurrentUser(): Promise<User> {
  const { data } = await api.get<ApiSuccess<{ user: User }>>('/user');
  return data.data.user;
}

export async function fetchEntitlements(): Promise<Entitlements> {
  const { data } = await api.get<ApiSuccess<{ entitlements: Entitlements }>>('/entitlements');
  return data.data.entitlements;
}

export async function resendVerificationEmail(): Promise<void> {
  await api.post('/auth/email/verification-notification');
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email: email.trim() });
}

export async function resetPassword(input: {
  email: string;
  token: string;
  password: string;
  password_confirmation: string;
}): Promise<void> {
  await api.post('/auth/reset-password', {
    email: input.email.trim(),
    token: input.token.trim(),
    password: input.password,
    password_confirmation: input.password_confirmation,
  });
}
