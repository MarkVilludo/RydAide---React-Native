import { createContext } from 'react';
import type { DeviceCoords } from '../hooks/useDeviceLocation';

export type ServicePin = DeviceCoords;

export type MechanicLocationContextValue = {
  coords: DeviceCoords | null;
  permissionDenied: boolean;
  servicePin: ServicePin | null;
  servicePinManual: boolean;
  reloadServicePin: () => Promise<void>;
  applySavedMechanicLocation: (latitude: number, longitude: number, servicePinManual?: boolean) => void;
};

export const MechanicLocationContext = createContext<MechanicLocationContextValue>({
  coords: null,
  permissionDenied: false,
  servicePin: null,
  servicePinManual: false,
  reloadServicePin: async () => {},
  applySavedMechanicLocation: () => {},
});
