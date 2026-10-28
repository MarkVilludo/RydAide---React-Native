import { haversineDistanceKm } from './distanceKm';

/** Manual pin may only differ from current GPS by this much (meters). */
export const DEFAULT_SERVICE_PIN_MAX_OFFSET_METERS = 100;

export const DEFAULT_SERVICE_PIN_MAX_OFFSET_KM = DEFAULT_SERVICE_PIN_MAX_OFFSET_METERS / 1000;

export function servicePinOffsetKm(
  pin: { latitude: number; longitude: number },
  gps: { latitude: number; longitude: number },
): number {
  return haversineDistanceKm(gps.latitude, gps.longitude, pin.latitude, pin.longitude);
}

export function servicePinOffsetMeters(
  pin: { latitude: number; longitude: number },
  gps: { latitude: number; longitude: number },
): number {
  return servicePinOffsetKm(pin, gps) * 1000;
}

export function maxOffsetKmFromMeters(maxOffsetMeters: number): number {
  return maxOffsetMeters / 1000;
}

export function isServicePinNearGps(
  pin: { latitude: number; longitude: number },
  gps: { latitude: number; longitude: number },
  maxOffsetKm: number = DEFAULT_SERVICE_PIN_MAX_OFFSET_KM,
): boolean {
  return servicePinOffsetKm(pin, gps) <= maxOffsetKm;
}

export function isServicePinNearGpsMeters(
  pin: { latitude: number; longitude: number },
  gps: { latitude: number; longitude: number },
  maxOffsetMeters: number = DEFAULT_SERVICE_PIN_MAX_OFFSET_METERS,
): boolean {
  return servicePinOffsetMeters(pin, gps) <= maxOffsetMeters;
}
