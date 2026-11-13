import type { ImageURISource } from 'react-native';
import { getApiAuthToken } from '../api/client';
import { API_ORIGIN } from '../config';
import { resolveMediaUrl } from './resolveMediaUrl';

/**
 * Image source for files served by an authenticated API endpoint (wallet QR codes).
 * Points the URL at the app's API host and sends the bearer token; never cached on disk.
 * Older servers return a public /storage URL — that still works (headers are harmless).
 */
export function protectedImageSource(url: string | null | undefined): ImageURISource | null {
  if (!url?.trim()) return null;
  let uri = resolveMediaUrl(url);
  try {
    const parsed = new URL(uri);
    if (parsed.pathname.startsWith('/api/')) {
      const api = new URL(API_ORIGIN);
      parsed.protocol = api.protocol;
      parsed.host = api.host;
      uri = parsed.toString();
    }
  } catch {
    // relative or unparsable — use as-is
  }
  const token = getApiAuthToken();
  const headers: Record<string, string> = { Accept: 'image/*' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (uri.includes('ngrok')) headers['ngrok-skip-browser-warning'] = 'true';
  return { uri, headers, cache: 'reload' };
}
