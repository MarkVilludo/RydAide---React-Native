import { useEffect, useRef } from 'react';
import { ensureNearbyProviders } from '../api/nearbySeed';

/** Coarse grid (~110 m) so GPS jitter does not re-seed constantly. */
function gridKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

const ensuredKeys = new Set<string>();

/**
 * Repositions local/staging test mechanics around the device GPS (backend dev API).
 */
export function useEnsureNearbyProviders(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  enabled: boolean,
): void {
  const inflight = useRef(false);

  useEffect(() => {
    if (!enabled || latitude == null || longitude == null) {
      return;
    }

    const key = gridKey(latitude, longitude);
    if (ensuredKeys.has(key) || inflight.current) {
      return;
    }

    inflight.current = true;
    ensureNearbyProviders({ latitude, longitude })
      .then((result) => {
        if (result.status === 'seeded' || result.status === 'skipped_recent') {
          ensuredKeys.add(key);
        }
      })
      .catch(() => {
        /* Dev-only; ignore when logged out or production API */
      })
      .finally(() => {
        inflight.current = false;
      });
  }, [enabled, latitude, longitude]);
}
