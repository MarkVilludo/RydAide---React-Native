import { API_ORIGIN } from '../config';

/**
 * Map marker PNGs are served from the Laravel app root (/images/map/...).
 * Rewrite host to match EXPO_PUBLIC_API_URL so physical devices don't hit 127.0.0.1.
 */
export function resolveMapMarkerIconUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) {
    return null;
  }
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    const api = new URL(API_ORIGIN);
    const isAppAsset =
      parsed.pathname.startsWith('/images/') ||
      parsed.pathname.startsWith('/storage/') ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === 'localhost';

    if (isAppAsset) {
      parsed.protocol = api.protocol;
      parsed.host = api.host;
      return parsed.toString();
    }

    return trimmed;
  } catch {
    if (trimmed.startsWith('/')) {
      return `${API_ORIGIN}${trimmed}`;
    }
    return trimmed;
  }
}
