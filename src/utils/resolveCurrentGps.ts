import * as Location from 'expo-location';

export type GpsPoint = { latitude: number; longitude: number };

/** Prefer a fresh GPS fix; fall back to the last known device coords from the app. */
export async function resolveCurrentGps(fallback?: GpsPoint | null): Promise<GpsPoint | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      const ask = await Location.requestForegroundPermissionsAsync();
      if (ask.status !== 'granted') {
        return fallback ?? null;
      }
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return fallback ?? null;
  }
}
