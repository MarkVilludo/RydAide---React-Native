import { haversineDistanceKm } from './distanceKm';

type LatLng = { latitude: number; longitude: number };

/** Closer than this, pins stack on the map — apply a display-only offset. */
export const MAP_PIN_OVERLAP_THRESHOLD_KM = 0.03;

/** Display-only gap between stacked pins (~22 m — enough to read both icons). */
export const MAP_PIN_VISUAL_SEPARATION_KM = 0.022;

function bearingDegrees(from: LatLng, to: LatLng): number {
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const dLng = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/** Point `distanceKm` from `origin` at compass `bearingDeg`. */
export function destinationPointKm(
  origin: LatLng,
  distanceKm: number,
  bearingDeg: number,
): LatLng {
  const R = 6371;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (origin.latitude * Math.PI) / 180;
  const lng1 = (origin.longitude * Math.PI) / 180;
  const d = distanceKm / R;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
  );
  const lng2 =
    lng1 +
    Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { latitude: (lat2 * 180) / Math.PI, longitude: (lng2 * 180) / Math.PI };
}

export type MarkerOverlapLayout = {
  /** Mechanic pin position on the map (may differ from GPS when overlapping). */
  mechanicDisplay: LatLng;
  /** True GPS positions are within overlap threshold. */
  pinsOverlapped: boolean;
  /** Short dashed link from help location to offset mechanic icon. */
  showOverlapConnector: boolean;
};

/**
 * When customer and mechanic GPS are nearly identical, offset the mechanic icon only
 * so both markers stay readable. Distance badges and APIs still use true coordinates.
 */
export function layoutMechanicMarkerForMap(
  customer: LatLng,
  mechanic: LatLng,
): MarkerOverlapLayout {
  const separationKm = haversineDistanceKm(
    customer.latitude,
    customer.longitude,
    mechanic.latitude,
    mechanic.longitude,
  );

  if (separationKm >= MAP_PIN_OVERLAP_THRESHOLD_KM) {
    return {
      mechanicDisplay: mechanic,
      pinsOverlapped: false,
      showOverlapConnector: false,
    };
  }

  const towardMechanic =
    separationKm > 0.00005
      ? bearingDegrees(customer, mechanic)
      : 35;

  const mechanicDisplay = destinationPointKm(
    customer,
    MAP_PIN_VISUAL_SEPARATION_KM,
    towardMechanic,
  );

  return {
    mechanicDisplay,
    pinsOverlapped: true,
    showOverlapConnector: true,
  };
}
