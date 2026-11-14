import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';
import { postMechanicLiveLocation } from '../api/mechanicHelp';
import type { HelpRequestTracking } from '../api/helpRequests';

type Options = {
  helpRequestId: number;
  enabled: boolean;
  tracking?: HelpRequestTracking | null;
};

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Live job tracking — prefer frequent GPS watch pushes over slow polling. */
export function useMechanicLocationTracking({ helpRequestId, enabled, tracking }: Options) {
  const lastSent = useRef<{ lat: number; lng: number; at: number } | null>(null);
  // Cap server hints so live maps stay snappy even if config is conservative.
  const intervalSeconds = Math.min(tracking?.location_update?.interval_seconds ?? 5, 5);
  const minDistanceMeters = Math.min(tracking?.location_update?.min_distance_meters ?? 8, 8);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;

    const publish = async (latitude: number, longitude: number) => {
      if (cancelled) return;
      const now = Date.now();
      const prev = lastSent.current;
      if (prev) {
        const moved = distanceMeters(prev.lat, prev.lng, latitude, longitude);
        const elapsed = (now - prev.at) / 1000;
        if (moved < minDistanceMeters && elapsed < intervalSeconds) {
          return;
        }
      }
      try {
        await postMechanicLiveLocation(helpRequestId, latitude, longitude);
        lastSent.current = { lat: latitude, lng: longitude, at: now };
      } catch {
        /* ignore transient GPS/network errors */
      }
    };

    const start = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) {
          return;
        }

        try {
          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          await publish(current.coords.latitude, current.coords.longitude);
        } catch {
          /* continue to watch */
        }

        try {
          subscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              distanceInterval: Math.max(3, Math.floor(minDistanceMeters / 2)),
              timeInterval: Math.max(2000, intervalSeconds * 1000),
            },
            (pos) => {
              void publish(pos.coords.latitude, pos.coords.longitude);
            },
          );
        } catch {
          fallbackTimer = setInterval(() => {
            void (async () => {
              try {
                const pos = await Location.getCurrentPositionAsync({
                  accuracy: Location.Accuracy.Balanced,
                });
                await publish(pos.coords.latitude, pos.coords.longitude);
              } catch {
                /* ignore */
              }
            })();
          }, intervalSeconds * 1000);
        }
      } catch {
        /* permission / module errors */
      }
    };

    void start();

    return () => {
      cancelled = true;
      subscription?.remove();
      if (fallbackTimer) clearInterval(fallbackTimer);
    };
  }, [helpRequestId, enabled, intervalSeconds, minDistanceMeters]);
}
