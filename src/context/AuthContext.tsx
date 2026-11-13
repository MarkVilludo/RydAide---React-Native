import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { fetchAppConfig } from '../api/appConfig';
import { fetchCurrentUser, login as apiLogin, logout as apiLogout, register as apiRegister } from '../api/auth';
import { unregisterPushToken } from '../api/pushTokens';
import { getCurrentPushToken, setCurrentPushToken } from '../services/pushNotifications';
import { setApiAuthToken } from '../api/client';
import type { User } from '../api/types';
import { logger } from '../utils/logger';

const TOKEN_KEY = 'rydaid_auth_token';
/** Give up waiting for the session restore after this long and offer Retry. */
const BOOT_TIMEOUT_MS = 10_000;

export type BootError = 'timeout' | 'network' | 'server';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('boot-timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Only a rejected token signs the user out; network trouble keeps the session for Retry. */
function isAuthRejection(error: unknown): boolean {
  return axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403);
}

function bootErrorOf(error: unknown): BootError {
  if (error instanceof Error && error.message === 'boot-timeout') return 'timeout';
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') return 'timeout';
    if (!error.response) return 'network';
  }
  return 'server';
}

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  /** Set when restoring the saved session failed for a reason other than a rejected token. */
  bootError: BootError | null;
  /** Try the session restore again (from the loading screen). */
  retryBootstrap: () => void;
  /** Forget the saved session locally and go to sign-in (loading screen error state). */
  abandonSession: () => Promise<void>;
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
  /** Replace the signed-in user after a profile update (no refetch). */
  setCurrentUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bootError, setBootError] = useState<BootError | null>(null);

  const bootstrap = useCallback(async () => {
    setIsLoading(true);
    setBootError(null);
    let failed = false;
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) {
        logger.debug('Auth', 'No stored session');
        void fetchAppConfig().catch(() => null);
        return;
      }
      setApiAuthToken(token);
      // Preload app config with the user so the dashboard's first paint has the right features.
      const [current] = await withTimeout(
        Promise.all([fetchCurrentUser(), fetchAppConfig().catch(() => null)]),
        BOOT_TIMEOUT_MS,
      );
      setUser(current);
      logger.info('Auth', 'Session restored', { userId: current.id, role: current.role });
    } catch (error) {
      if (isAuthRejection(error)) {
        logger.warn('Auth', 'Saved session rejected — clearing token');
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setApiAuthToken(null);
        setUser(null);
      } else {
        failed = true;
        logger.error('Auth', 'Session restore failed — keeping token for retry', error);
        setBootError(bootErrorOf(error));
      }
    } finally {
      // Stay "loading" on a retryable failure so nothing behind the loading screen renders.
      if (!failed) setIsLoading(false);
    }
  }, []);

  const retryBootstrap = useCallback(() => {
    void bootstrap();
  }, [bootstrap]);

  const abandonSession = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    setApiAuthToken(null);
    setUser(null);
    setBootError(null);
    setIsLoading(false);
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
    () => ({
      user,
      isLoading,
      bootError,
      retryBootstrap,
      abandonSession,
      signIn,
      signUp,
      signOut,
      refreshUser,
      setCurrentUser: setUser,
    }),
    [user, isLoading, bootError, retryBootstrap, abandonSession, signIn, signUp, signOut, refreshUser],
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
