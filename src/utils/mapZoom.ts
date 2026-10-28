/** Rough Google Maps zoom level to fit a search radius (1–10 km). */
export function zoomForRadiusKm(radiusKm: number): number {
  if (radiusKm <= 1) return 13.5;
  if (radiusKm <= 3) return 12.5;
  if (radiusKm <= 5) return 11.8;
  if (radiusKm <= 8) return 11;

  return 10.5;
}
