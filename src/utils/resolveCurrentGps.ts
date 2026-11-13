import * as Location from 'expo-location';

export type GpsPoint = { latitude: number; longitude: number };

/**
 * Android's FusedLocation getCurrentLocation (used by expo-location getCurrentPositionAsync) has no
 * timeout. On emulators and indoors it can wait forever, so every caller must race it.
 */
export const GPS_FIX_TIMEOUT_MS = 8000;
const LAST_KNOWN_MAX_AGE_MS = 5 * 60_000;

export class TimeoutError extends Error {}

/** Resolve `promise`, or reject after `ms`. The native work keeps running; we just stop waiting. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(`${label} timed out after ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function toPoint(pos: Location.LocationObject | null | undefined): GpsPoint | null {
  if (!pos) {
    return null;
  }
  const { latitude, longitude } = pos.coords;
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

/** OS-cached fix: returns almost instantly, may be a few minutes old. Never prompts. */
export async function readLastKnownGps(maxAgeMs = LAST_KNOWN_MAX_AGE_MS): Promise<GpsPoint | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }
    const last = await withTimeout(
      Location.getLastKnownPositionAsync({ maxAge: maxAgeMs }),
      2000,
      'getLastKnownPosition',
    );
    return toPoint(last);
  } catch {
    return null;
  }
}

/** Fresh fix (Balanced accuracy) with a hard timeout. Throws on timeout or failure. */
export async function readFreshGps(timeoutMs = GPS_FIX_TIMEOUT_MS): Promise<GpsPoint | null> {
  const pos = await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    timeoutMs,
    'getCurrentPosition',
  );
  return toPoint(pos);
}

export type ResolveGpsOptions = {
  /** Max wait for a fresh fix before falling back (default 8 s). */
  timeoutMs?: number;
  /** Set false to never show the permission prompt (background reads). */
  requestPermission?: boolean;
};

/** Prefer a fresh GPS fix; fall back to last-known or the app’s cached coords. Always settles. */
export async function resolveCurrentGps(
  fallback?: GpsPoint | null,
  options?: ResolveGpsOptions,
): Promise<GpsPoint | null> {
  const timeoutMs = options?.timeoutMs ?? GPS_FIX_TIMEOUT_MS;
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      if (options?.requestPermission === false) {
        return fallback ?? null;
      }
      const ask = await Location.requestForegroundPermissionsAsync();
      if (ask.status !== 'granted') {
        return fallback ?? null;
      }
    }

    try {
      const enabled = await withTimeout(Location.hasServicesEnabledAsync(), 2000, 'hasServicesEnabled');
      if (!enabled) {
        return fallback ?? null;
      }
    } catch {
      /* ignore */
    }

    try {
      return (await readFreshGps(timeoutMs)) ?? (await readLastKnownGps()) ?? fallback ?? null;
    } catch (error) {
      if (__DEV__) {
        console.warn('[RydAid:GPS]', error instanceof Error ? error.message : error);
      }
      return (await readLastKnownGps()) ?? fallback ?? null;
    }
  } catch {
    return fallback ?? null;
  }
}
