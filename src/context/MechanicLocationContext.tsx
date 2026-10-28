import React, { createContext, useContext, useEffect, useRef } from 'react';
import { updateMechanicProfileLocation } from '../api/mechanicProfile';
import { useDeviceLocation, type DeviceCoords } from '../hooks/useDeviceLocation';

type MechanicLocationContextValue = {
  coords: DeviceCoords | null;
  permissionDenied: boolean;
};

const MechanicLocationContext = createContext<MechanicLocationContextValue>({
  coords: null,
  permissionDenied: false,
});

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

export function MechanicLocationProvider({ children }: { children: React.ReactNode }) {
  const { coords, permissionDenied } = useDeviceLocation(true);
  const lastSynced = useRef<DeviceCoords | null>(null);
  const lastSyncAt = useRef(0);

  useEffect(() => {
    if (!coords) {
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
    updateMechanicProfileLocation(coords.latitude, coords.longitude).catch(() => {});
  }, [coords]);

  return (
    <MechanicLocationContext.Provider value={{ coords, permissionDenied }}>
      {children}
    </MechanicLocationContext.Provider>
  );
}

export function useMechanicLiveLocation(): MechanicLocationContextValue {
  return useContext(MechanicLocationContext);
}
