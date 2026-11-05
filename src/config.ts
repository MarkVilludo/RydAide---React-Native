const LOCAL_FALLBACK = 'http://127.0.0.1:8000/api/v1';

/** Live API (same app as https://…/admin/login). Override via EXPO_PUBLIC_PRODUCTION_API_URL. */
const PRODUCTION_DEFAULT = 'https://rydaid.quantumrealm.tech/api/v1';

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

function productionApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_PRODUCTION_API_URL?.trim();
  return normalizeBaseUrl(fromEnv || PRODUCTION_DEFAULT);
}

function localApiUrl(): string {
  return LOCAL_FALLBACK;
}

/**
 * API base URL resolution (first match wins):
 * 1. EXPO_PUBLIC_API_URL — explicit (typical in .env for LAN dev)
 * 2. EXPO_PUBLIC_API_ENV=production|local
 * 3. Release builds (!__DEV__) → production
 * 4. Dev → local fallback (simulator); use .env LAN IP for a physical device
 */
function resolveApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (explicit) {
    return normalizeBaseUrl(explicit);
  }

  const mode = process.env.EXPO_PUBLIC_API_ENV?.trim().toLowerCase();
  if (mode === 'production') {
    return productionApiUrl();
  }
  if (mode === 'local') {
    return localApiUrl();
  }

  if (!__DEV__) {
    return productionApiUrl();
  }

  return localApiUrl();
}

/** API base for axios (`/auth/login`, etc.). */
export const API_URL = resolveApiUrl();

/** Laravel app root (no /api/v1) — privacy, email verify links, `/storage/...` media. */
export const API_ORIGIN = API_URL.replace(/\/api\/v\d+\/?$/i, '');

export type ApiEnvironment = 'local' | 'production';

export function apiEnvironment(): ApiEnvironment {
  return API_URL.startsWith('https://') ? 'production' : 'local';
}

/** Android expo-maps / Google Maps SDK — see docs/MAPS.md */
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? '';

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log('[RydAid] API_URL =', API_URL, `(${apiEnvironment()})`);
}
