import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchCurrentUser, login as apiLogin, logout as apiLogout, register as apiRegister } from '../api/auth';
import { setApiAuthToken } from '../api/client';
import type { User } from '../api/types';

const TOKEN_KEY = 'rydaid_auth_token';

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    role: 'owner' | 'mechanic';
  }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) {
        return;
      }
      setApiAuthToken(token);
      const current = await fetchCurrentUser();
      setUser(current);
    } catch {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setApiAuthToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap().catch(() => {
      setIsLoading(false);
    });
  }, [bootstrap]);

  const signIn = useCallback(async (email: string, password: string) => {
    const payload = await apiLogin(email, password);
    await SecureStore.setItemAsync(TOKEN_KEY, payload.token);
    setApiAuthToken(payload.token);
    setUser(payload.user);
  }, []);

  const signUp = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      password_confirmation: string;
      role: 'owner' | 'mechanic';
    }) => {
      const payload = await apiRegister(input);
      await SecureStore.setItemAsync(TOKEN_KEY, payload.token);
      setApiAuthToken(payload.token);
      setUser(payload.user);
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Token may already be invalid.
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setApiAuthToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, signIn, signUp, signOut }),
    [user, isLoading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
