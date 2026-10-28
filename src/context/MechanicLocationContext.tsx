import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMyMechanicProfile, updateMechanicProfileLocation } from '../api/mechanicProfile';
import { useDeviceLocation, type DeviceCoords } from '../hooks/useDeviceLocation';
import {
  MechanicLocationContext,
  type MechanicLocationContextValue,
  type ServicePin,
} from './mechanicLocationState';

export type { ServicePin, MechanicLocationContextValue };
export { useMechanicLiveLocation } from './useMechanicLiveLocation';

function distanceMeters(a: DeviceCoords, b: DeviceCoords): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function coordsFromProfile(profile: Awaited<ReturnType<typeof fetchMyMechanicProfile>>): ServicePin | null {
  if (profile?.latitude == null || profile?.longitude == null) {
    return null;
  }
  const latitude = Number(profile.latitude);
  const longitude = Number(profile.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return { latitude, longitude };
}

export function MechanicLocationProvider({ children }: { children: React.ReactNode }) {
  const { coords, permissionDenied } = useDeviceLocation(true);
  const [servicePin, setServicePin] = useState<ServicePin | null>(null);
  const [servicePinManual, setServicePinManual] = useState(false);
  const lastSynced = useRef<DeviceCoords | null>(null);
  const lastSyncAt = useRef(0);

  const reloadServicePin = useCallback(async () => {
    try {
      const profile = await fetchMyMechanicProfile();
      setServicePin(coordsFromProfile(profile));
      setServicePinManual(Boolean(profile?.service_pin_manual));
    } catch {
      setServicePin(null);
      setServicePinManual(false);
    }
  }, []);

  const applySavedMechanicLocation = useCallback(
    (latitude: number, longitude: number, manual = true) => {
      setServicePin({ latitude, longitude });
      setServicePinManual(manual);
    },
    [],
  );

  useEffect(() => {
    void reloadServicePin();
  }, [reloadServicePin]);

  useEffect(() => {
    if (!coords || servicePinManual) {
      return;
    }

    const now = Date.now();
    const prev = lastSynced.current;
    const movedEnough = prev ? distanceMeters(prev, coords) >= 40 : true;
    const stale = now - lastSyncAt.current >= 45_000;

    if (!movedEnough && !stale) {
      return;
    }

    lastSynced.current = coords;
    lastSyncAt.current = now;
    updateMechanicProfileLocation(coords.latitude, coords.longitude, undefined, { source: 'device' })
      .then((mechanic) => {
        applySavedMechanicLocation(mechanic.latitude!, mechanic.longitude!, false);
      })
      .catch(() => {});
  }, [coords, servicePinManual, applySavedMechanicLocation]);

  return (
    <MechanicLocationContext.Provider
      value={{
        coords,
        permissionDenied,
        servicePin,
        servicePinManual,
        reloadServicePin,
        applySavedMechanicLocation,
      }}
    >
      {children}
    </MechanicLocationContext.Provider>
  );
}
