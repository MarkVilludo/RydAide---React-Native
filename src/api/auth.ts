import { Platform } from 'react-native';
import { api } from './client';
import type { ApiSuccess, AuthPayload, Entitlements, User } from './types';

function deviceName(): string {
  return `expo-${Platform.OS}`;
}

export async function login(email: string, password: string): Promise<AuthPayload> {
  const { data } = await api.post<ApiSuccess<AuthPayload>>('/auth/login', {
    email,
    password,
    device_name: deviceName(),
  });
  return data.data;
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
  return data.data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export async function fetchCurrentUser(): Promise<User> {
  const { data } = await api.get<ApiSuccess<{ user: User }>>('/user');
  return data.data.user;
}

export async function fetchEntitlements(): Promise<Entitlements> {
  const { data } = await api.get<ApiSuccess<{ entitlements: Entitlements }>>('/entitlements');
  return data.data.entitlements;
}
