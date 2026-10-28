import { API_ORIGIN } from '../config';

/**
 * Rewrites media URLs to the same host as EXPO_PUBLIC_API_URL (fixes APP_URL/ngrok vs LAN mismatch).
 */
export function resolveMediaUrl(url: string | undefined | null): string {
  if (!url?.trim()) {
    return '';
  }
  const trimmed = url.trim();
  if (trimmed.startsWith('file://')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    const api = new URL(API_ORIGIN);
    if (parsed.pathname.startsWith('/storage/')) {
      parsed.protocol = api.protocol;
      parsed.host = api.host;
      return parsed.toString();
    }
    return trimmed;
  } catch {
    if (trimmed.startsWith('/storage/')) {
      return `${API_ORIGIN}${trimmed}`;
    }
    return trimmed;
  }
}
