const fallback = 'http://127.0.0.1:8000/api/v1';

/** API base for physical devices: set EXPO_PUBLIC_API_URL to your Mac's LAN IP. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL?.trim() || fallback).replace(/\/$/, '');

/** Laravel app root (no /api/v1) — use for `/storage/...` media URLs. */
export const API_ORIGIN = API_URL.replace(/\/api\/v\d+\/?$/i, '');

/** Android expo-maps / Google Maps SDK — see docs/MAPS.md */
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? '';

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log('[RydAid] API_URL =', API_URL);
}
