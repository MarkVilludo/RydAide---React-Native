import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchCurrentUser, login as apiLogin, logout as apiLogout, register as apiRegister } from '../api/auth';
import { unregisterPushToken } from '../api/pushTokens';
import { getCurrentPushToken, setCurrentPushToken } from '../services/pushNotifications';
import { setApiAuthToken } from '../api/client';
import type { User } from '../api/types';
import { logger } from '../utils/logger';

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
  refreshUser: () => Promise<User>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) {
        logger.debug('Auth', 'No stored session');
        return;
      }
      setApiAuthToken(token);
      const current = await fetchCurrentUser();
      setUser(current);
      logger.info('Auth', 'Session restored', { userId: current.id, role: current.role });
    } catch (error) {
      logger.error('Auth', 'Session restore failed — clearing token', error);
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setApiAuthToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap().catch((error) => {
      logger.error('Auth', 'bootstrap promise rejected', error);
      setIsLoading(false);
    });
  }, [bootstrap]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const payload = await apiLogin(email, password);
      await SecureStore.setItemAsync(TOKEN_KEY, payload.token);
      setApiAuthToken(payload.token);
      setUser(payload.user);
      logger.info('Auth', 'Signed in', { userId: payload.user.id, role: payload.user.role });
    } catch (error) {
      logger.error('Auth', 'Sign-in failed', error, { email });
      throw error;
    }
  }, []);

  const signUp = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      password_confirmation: string;
      role: 'owner' | 'mechanic';
    }) => {
      try {
        const payload = await apiRegister(input);
        await SecureStore.setItemAsync(TOKEN_KEY, payload.token);
        setApiAuthToken(payload.token);
        setUser(payload.user);
        logger.info('Auth', 'Registered', { userId: payload.user.id, role: payload.user.role });
      } catch (error) {
        logger.error('Auth', 'Registration failed', error, { email: input.email, role: input.role });
        throw error;
      }
    },
    [],
  );

  const refreshUser = useCallback(async () => {
    try {
      const current = await fetchCurrentUser();
      setUser(current);
      return current;
    } catch (error) {
      logger.error('Auth', 'refreshUser failed', error);
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    const pushToken = getCurrentPushToken();
    try {
      await apiLogout(pushToken);
    } catch (error) {
      logger.debug('Auth', 'logout API failed (token may already be invalid)', { error: String(error) });
    }
    if (pushToken) {
      try {
        await unregisterPushToken(pushToken);
      } catch (error) {
        logger.debug('Auth', 'unregister push failed', { error: String(error) });
      }
    }
    setCurrentPushToken(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setApiAuthToken(null);
    setUser(null);
    logger.info('Auth', 'Signed out');
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, signIn, signUp, signOut, refreshUser }),
    [user, isLoading, signIn, signUp, signOut, refreshUser],
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
