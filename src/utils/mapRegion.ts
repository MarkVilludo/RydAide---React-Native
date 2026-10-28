/** Approximate map deltas so a radius (km) fits comfortably in view. */
export function regionForRadiusKm(latitude: number, longitude: number, radiusKm: number) {
  const delta = Math.max(0.015, (radiusKm / 111) * 2.4);

  return {
    latitude,
    longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}
