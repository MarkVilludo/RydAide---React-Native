import { Platform } from 'react-native';
import { PROVIDER_GOOGLE } from 'react-native-maps';
import { GOOGLE_MAPS_API_KEY } from '../config';

/**
 * Android Google Maps needs a key baked into the native build (app.config.js).
 * Without it, forcing PROVIDER_GOOGLE can hard-crash release APKs after login
 * when job maps / location previews mount. Prefer the default provider then.
 */
export function androidMapsProvider(): typeof PROVIDER_GOOGLE | undefined {
  if (Platform.OS !== 'android') {
    return undefined;
  }
  return GOOGLE_MAPS_API_KEY ? PROVIDER_GOOGLE : undefined;
}

export function hasGoogleMapsApiKey(): boolean {
  return GOOGLE_MAPS_API_KEY.length > 0;
}
