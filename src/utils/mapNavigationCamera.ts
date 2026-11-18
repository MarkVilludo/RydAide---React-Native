import type { Region } from 'react-native-maps';
import { haversineDistanceKm } from './distanceKm';

/** Beyond this, fitting both pins zooms out to a useless world view. */
export const NAV_MAX_DUAL_FIT_KM = 40;

/** Absurd separation — usually emulator GPS vs seeded job (e.g. Manila job, US simulator). */
export const NAV_IMPLAUSIBLE_DISTANCE_KM = 250;

const DESTINATION_DELTA = 0.011;
const DRIVER_DELTA = 0.011;
const MAX_DUAL_DELTA = 0.072;

export type MapCoord = { latitude: number; longitude: number };

export function navigationDistanceKm(origin: MapCoord, destination: MapCoord): number {
  return haversineDistanceKm(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude,
  );
}

export function customerNavigationRegion(
  latitude: number,
  longitude: number,
  delta = DESTINATION_DELTA,
): Region {
  return { latitude, longitude, latitudeDelta: delta, longitudeDelta: delta };
}

export function mechanicNavigationRegion(latitude: number, longitude: number, delta = DRIVER_DELTA): Region {
  return { latitude, longitude, latitudeDelta: delta, longitudeDelta: delta };
}

export function cappedDualNavigationRegion(destination: MapCoord, origin: MapCoord): Region {
  const midLat = (destination.latitude + origin.latitude) / 2;
  const midLng = (destination.longitude + origin.longitude) / 2;
  const spanLat = Math.abs(destination.latitude - origin.latitude) * 1.22 + 0.004;
  const spanLng = Math.abs(destination.longitude - origin.longitude) * 1.22 + 0.004;
  const latitudeDelta = Math.min(MAX_DUAL_DELTA, Math.max(0.007, spanLat));
  const longitudeDelta = Math.min(MAX_DUAL_DELTA, Math.max(0.007, spanLng));
  return { latitude: midLat, longitude: midLng, latitudeDelta, longitudeDelta };
}

export type NavigationCameraPlan =
  | { kind: 'destination'; region: Region; distanceKm: number | null }
  | { kind: 'dual'; region: Region; distanceKm: number }
  | { kind: 'fit'; coords: MapCoord[]; distanceKm: number };

export function planNavigationCamera(
  destination: MapCoord,
  origin: MapCoord | null,
  routeCoords: MapCoord[] | null | undefined,
): NavigationCameraPlan {
  if (!origin) {
    return {
      kind: 'destination',
      region: customerNavigationRegion(destination.latitude, destination.longitude),
      distanceKm: null,
    };
  }

  const distanceKm = navigationDistanceKm(origin, destination);

  if (distanceKm > NAV_MAX_DUAL_FIT_KM) {
    return {
      kind: 'destination',
      region: customerNavigationRegion(destination.latitude, destination.longitude),
      distanceKm,
    };
  }

  if (routeCoords && routeCoords.length > 1) {
    return { kind: 'fit', coords: routeCoords, distanceKm };
  }

  return {
    kind: 'dual',
    region: cappedDualNavigationRegion(destination, origin),
    distanceKm,
  };
}

export function isImplausibleNavigationDistance(distanceKm: number | null | undefined): boolean {
  return distanceKm != null && Number.isFinite(distanceKm) && distanceKm > NAV_IMPLAUSIBLE_DISTANCE_KM;
}