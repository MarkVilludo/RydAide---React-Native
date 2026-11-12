import axios, { AxiosError } from 'axios';
import { API_URL } from '../config';
import { logger } from '../utils/logger';
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
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const url = error.config?.url ?? 'request';
      if (!error.response) {
        logger.warn('API', `Network error → ${url}`, {
          baseURL: API_URL,
          hint: 'Check EXPO_PUBLIC_API_URL / device network',
        });
      } else if (status != null && status >= 500) {
        logger.error('API', `Server ${status} on ${url}`, error);
      } else if (status === 401 || status === 403) {
        logger.warn('API', `Auth ${status} on ${url}`);
      } else if (__DEV__ && status != null && status >= 400) {
        logger.debug('API', `Client ${status} on ${url}`, {
          data: error.response.data,
        });
      }
    } else {
      logger.error('API', 'Non-HTTP request failure', error);
    }
    return Promise.reject(error);
  },
);

function messageFromResponseBody(data: unknown, status: number): string | null {
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as ApiError & { message?: string }).message;
    if (typeof message === 'string' && message.trim() !== '') {
      if (message.includes('could not be found') && message.includes('route')) {
        return 'This app version needs a server update (missing API route). Deploy latest RydAid code on the server, then run: php artisan route:clear && php artisan config:cache';
      }
      return message;
    }
  }
  if (data && typeof data === 'object' && 'errors' in data) {
    const errors = (data as ApiError).errors;
    if (errors) {
      const first = Object.values(errors)[0]?.[0];
      if (first) {
        return first;
      }
    }
  }
  if (typeof data === 'string' && data.trim() !== '') {
    const snippet = data.replace(/\s+/g, ' ').trim().slice(0, 120);
    return `Server returned HTML (HTTP ${status}). Check API URL: ${API_URL}. ${snippet}`;
  }
  return null;
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message && !axios.isAxiosError(error)) {
    return error.message;
  }

  if (axios.isAxiosError(error)) {
    if (!error.response) {
      const isLocal = API_URL.startsWith('http://192.168.') || API_URL.includes('127.0.0.1');
      if (isLocal) {
        return `Cannot reach the API at ${API_URL}. Start Laravel: php artisan serve --host=0.0.0.0 --port=8000 — or set EXPO_PUBLIC_API_URL=https://rydaid.quantumrealm.tech/api/v1 in .env and run npx expo start -c.`;
      }
      return `Cannot reach the API at ${API_URL}. Check your connection or EXPO_PUBLIC_API_URL in .env, then npx expo start -c.`;
    }

    const { status, data } = error.response;
    const parsed = messageFromResponseBody(data, status);
    if (parsed) {
      return parsed;
    }

    if (status === 404) {
      return `API not found (404). Is EXPO_PUBLIC_API_URL correct? Current: ${API_URL}`;
    }
    if (status === 429) {
      return 'Too many attempts. Wait a minute and try again.';
    }
    if (status >= 500) {
      return `Server error (${status}). Try again later or check the live site admin.`;
    }

    return `Request failed (HTTP ${status}). API: ${API_URL}`;
  }

  return 'Something went wrong. Please try again.';
}

export type { AxiosError };
