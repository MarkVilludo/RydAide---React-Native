import * as Location from 'expo-location';

export type GpsPoint = { latitude: number; longitude: number };

/** Prefer a fresh GPS fix; fall back to last-known or the app’s cached coords. */
export async function resolveCurrentGps(fallback?: GpsPoint | null): Promise<GpsPoint | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      const ask = await Location.requestForegroundPermissionsAsync();
      if (ask.status !== 'granted') {
        return fallback ?? null;
      }
    }

    try {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        return fallback ?? null;
      }
    } catch {
      /* ignore */
    }

    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          return { latitude: last.coords.latitude, longitude: last.coords.longitude };
        }
      } catch {
        /* ignore */
      }
      return fallback ?? null;
    }
  } catch {
    return fallback ?? null;
  }
}
