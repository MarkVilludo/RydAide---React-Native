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

export function useMechanicLocationTracking({ helpRequestId, enabled, tracking }: Options) {
  const lastSent = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const intervalSeconds = Math.min(tracking?.location_update?.interval_seconds ?? 12, 12);
  const minDistanceMeters = Math.min(tracking?.location_update?.min_distance_meters ?? 50, 25);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const sendLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) {
          return;
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = pos.coords;
        const now = Date.now();
        const prev = lastSent.current;

        if (prev) {
          const moved = distanceMeters(prev.lat, prev.lng, latitude, longitude);
          const elapsed = (now - prev.at) / 1000;
          if (moved < minDistanceMeters && elapsed < intervalSeconds) {
            return;
          }
        }

        await postMechanicLiveLocation(helpRequestId, latitude, longitude);
        lastSent.current = { lat: latitude, lng: longitude, at: now };
      } catch {
        // ignore transient GPS/network errors
      }
    };

    sendLocation().catch(() => {});
    timer = setInterval(() => {
      sendLocation().catch(() => {});
    }, intervalSeconds * 1000);

    return () => {
      cancelled = true;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [helpRequestId, enabled, intervalSeconds, minDistanceMeters]);
}
