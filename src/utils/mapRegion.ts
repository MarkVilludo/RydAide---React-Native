/** Latitude/longitude span so a search radius (km) fits comfortably in view. */
function radiusKmToLatitudeDelta(radiusKm: number): number {
  return Math.max(0.015, (radiusKm / 111) * 2.4);
}

/** Approximate map deltas so a radius (km) fits comfortably in view. */
export function regionForRadiusKm(latitude: number, longitude: number, radiusKm: number) {
  const delta = radiusKmToLatitudeDelta(radiusKm);

  return {
    latitude,
    longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

/** Google Maps camera zoom — same framing as {@link regionForRadiusKm}. */
export function zoomForRadiusKm(radiusKm: number): number {
  const delta = radiusKmToLatitudeDelta(radiusKm);
  const zoom = Math.log2(360 / delta);
  return Math.min(18, Math.max(4, zoom));
}
