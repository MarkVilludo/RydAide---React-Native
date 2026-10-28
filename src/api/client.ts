import axios, { AxiosError } from 'axios';
import { API_URL } from '../config';
import type { ApiError } from './types';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 20000,
});

let authToken: string | null = null;

export function setApiAuthToken(token: string | null): void {
  authToken = token;
}

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  const base = config.baseURL ?? API_URL;
  if (base.includes('ngrok')) {
    config.headers['ngrok-skip-browser-warning'] = 'true';
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    // Let the runtime set multipart boundary (default application/json breaks file uploads).
    if (config.headers) {
      delete config.headers['Content-Type'];
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (__DEV__ && axios.isAxiosError(error) && !error.response) {
      // eslint-disable-next-line no-console
      console.warn(
        '[RydAid] Network error —',
        error.config?.url ?? 'request',
        '→',
        API_URL,
        '(phone must be on same Wi‑Fi; Laravel: serve --host=0.0.0.0 --port=8000)',
      );
    }
    return Promise.reject(error);
  },
);

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return `Cannot reach the API at ${API_URL}. Check that Laravel is running, ngrok/LAN URL is correct, and restart Expo after changing .env.`;
    }
    const data = error.response?.data as ApiError | undefined;
    if (data?.message) {
      return data.message;
    }
    if (data?.errors) {
      const first = Object.values(data.errors)[0]?.[0];
      if (first) {
        return first;
      }
    }
  }
  return 'Something went wrong. Please try again.';
}

export type { AxiosError };
