import * as Location from 'expo-location';

const cache = new Map<string, string>();

function cacheKey(latitude: number, longitude: number): string {
  // ~110 m buckets: enough to name the area, few repeat lookups.
  return `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

/** Cached area line for coordinates, e.g. "Street, District, City, Region". Null if unavailable. */
export async function reverseGeocodeLine(latitude: number, longitude: number): Promise<string | null> {
  const key = cacheKey(latitude, longitude);
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
    const r = rev[0];
    if (!r) return null;
    const parts: string[] = [];
    for (const p of [r.street, r.district, r.city, r.subregion, r.region]) {
      const v = p?.trim();
      if (v && !parts.includes(v)) parts.push(v);
    }
    const line = parts.join(', ');
    if (!line) return null;
    cache.set(key, line);
    return line;
  } catch {
    return null;
  }
}

export function cachedGeocodeLine(latitude: number, longitude: number): string | null {
  return cache.get(cacheKey(latitude, longitude)) ?? null;
}
