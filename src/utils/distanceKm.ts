export function haversineDistanceKm(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const lat1 = toRad(fromLat);
  const lat2 = toRad(toLat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const km = 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  return km < 1 ? Math.round(km * 100) / 100 : Math.round(km * 10) / 10;
}

export function resolveMechanicToCustomerDistanceKm(
  request: { latitude: number; longitude: number; distance_km?: number | null },
  mechanic: { latitude: number; longitude: number } | null,
): number | null {
  const toLat = Number(request.latitude);
  const toLng = Number(request.longitude);
  if (!Number.isFinite(toLat) || !Number.isFinite(toLng)) {
    const api = request.distance_km;
    return api != null && Number.isFinite(Number(api)) ? Number(api) : null;
  }

  if (mechanic) {
    const fromLat = Number(mechanic.latitude);
    const fromLng = Number(mechanic.longitude);
    if (Number.isFinite(fromLat) && Number.isFinite(fromLng)) {
      return haversineDistanceKm(fromLat, fromLng, toLat, toLng);
    }
  }

  const api = request.distance_km;
  return api != null && Number.isFinite(Number(api)) ? Number(api) : null;
}

export function resolveTrackingDistanceKm(
  tracking: {
    distance_km?: number | null;
    request_location?: { latitude: number; longitude: number };
    mechanic_location?: { latitude: number; longitude: number } | null;
  } | null
  | undefined,
): number | null {
  if (!tracking) {
    return null;
  }

  const req = tracking.request_location;
  const mech = tracking.mechanic_location;
  if (req && mech) {
    const toLat = Number(req.latitude);
    const toLng = Number(req.longitude);
    const fromLat = Number(mech.latitude);
    const fromLng = Number(mech.longitude);
    if (
      Number.isFinite(toLat) &&
      Number.isFinite(toLng) &&
      Number.isFinite(fromLat) &&
      Number.isFinite(fromLng)
    ) {
      return haversineDistanceKm(fromLat, fromLng, toLat, toLng);
    }
  }

  const api = tracking.distance_km;
  return api != null && Number.isFinite(Number(api)) ? Number(api) : null;
}

/** @deprecated use resolveMechanicToCustomerDistanceKm */
export function distanceToHelpRequestKm(
  request: { latitude: number; longitude: number; distance_km?: number | null },
  mechanic: { latitude: number; longitude: number } | null,
): number | null {
  return resolveMechanicToCustomerDistanceKm(request, mechanic);
}

export function formatDistanceKm(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km)) {
    return null;
  }
  if (km < 1) {
    const meters = Math.max(1, Math.round(km * 1000));
    if (km < 0.05) {
      return `Very nearby · ${meters} m away`;
    }
    return `${meters} m away`;
  }
  return `${km.toFixed(km < 10 ? 1 : 0)} km away`;
}

/** Compact distance for map overlays (meters / km only, no prose). */
export function formatMapDistanceKm(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km)) {
    return null;
  }
  if (km < 1) {
    return `${Math.max(1, Math.round(km * 1000))} m`;
  }
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}
