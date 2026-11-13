import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export type DeviceCoords = { latitude: number; longitude: number };

type Options = {
  /** Tighter GPS updates for live job maps (mechanic en route). */
  live?: boolean;
};

async function readBestEffortPosition(): Promise<DeviceCoords | null> {
  try {
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      return null;
    }
  } catch {
    /* continue — some platforms omit this API */
  }

  try {
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: current.coords.latitude, longitude: current.coords.longitude };
  } catch {
    try {
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        return { latitude: last.coords.latitude, longitude: last.coords.longitude };
      }
    } catch {
      /* no fix available */
    }
    return null;
  }
}

export function useDeviceLocation(enabled: boolean, options?: Options) {
  const live = options?.live ?? false;
  const [coords, setCoords] = useState<DeviceCoords | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    const start = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) {
            setPermissionDenied(true);
          }
          return;
        }
        if (!cancelled) {
          setPermissionDenied(false);
        }

        const initial = await readBestEffortPosition();
        if (!cancelled && initial) {
          setCoords(initial);
        }

        try {
          subscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              distanceInterval: live ? 8 : 25,
              timeInterval: live ? 3000 : 10000,
            },
            (pos) => {
              if (!cancelled) {
                setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
              }
            },
          );
        } catch {
          /* watch can fail when services are off — keep last known coords */
        }
      } catch {
        /* permission prompt / module errors — do not crash the app */
      }
    };

    void start();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled, live]);

  return { coords, permissionDenied };
}
