import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export type DeviceCoords = { latitude: number; longitude: number };

export function useDeviceLocation(enabled: boolean) {
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
        setPermissionDenied(false);
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) {
          setCoords({ latitude: current.coords.latitude, longitude: current.coords.longitude });
        }
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 25, timeInterval: 10000 },
          (pos) => {
            if (!cancelled) {
              setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            }
          },
        );
      } catch {
        if (!cancelled) {
          setPermissionDenied(true);
        }
      }
    };

    start().catch(() => {});

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);

  return { coords, permissionDenied };
}
