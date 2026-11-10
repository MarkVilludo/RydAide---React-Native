export type MechanicAvailabilityStatus = 'available' | 'busy' | 'offline';

export function availabilityLabel(status: MechanicAvailabilityStatus | undefined): string {
  switch (status) {
    case 'available':
      return 'Available';
    case 'busy':
      return 'On a job';
    case 'offline':
      return 'Offline';
    default:
      return 'Status unknown';
  }
}

export function availabilityDotColor(status: MechanicAvailabilityStatus | undefined): string {
  switch (status) {
    case 'available':
      return '#16a34a';
    case 'busy':
      return '#ea580c';
    case 'offline':
      return '#94a3b8';
    default:
      return '#64748b';
  }
}

/** Show star rating only when there is at least one review. */
export function formatDirectoryRating(average: number, count: number | undefined): string | null {
  const n = count ?? 0;
  if (n < 1) return null;
  return `★ ${average.toFixed(1)} (${n})`;
}

export function formatDistanceKm(distanceKm: number | null | undefined): string | null {
  if (distanceKm == null) return null;
  return `${distanceKm} km away`;
}

export function joinMetaParts(parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => Boolean(p)).join(' · ');
}

export function mechanicListingMetaLine(item: {
  distance_km: number | null;
  availability_status?: MechanicAvailabilityStatus;
  rating_average: number;
  rating_count: number;
  emergency_available?: boolean;
  service_radius_km?: number;
}): string {
  return joinMetaParts([
    formatDistanceKm(item.distance_km) ?? 'In your search area',
    availabilityLabel(item.availability_status),
    formatDirectoryRating(item.rating_average, item.rating_count),
    item.service_radius_km != null ? `Serves ~${item.service_radius_km} km` : null,
    item.emergency_available ? 'Emergency help' : null,
  ]);
}

export function mapPinSnippetForMechanic(item: {
  distance_km: number | null;
  rating_average: number;
  rating_count: number;
}): string | undefined {
  const parts = [
    item.distance_km != null ? `${item.distance_km} km` : null,
    formatDirectoryRating(item.rating_average, item.rating_count),
  ].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export function mapPinSnippetForShop(item: {
  distance_km: number | null;
  rating_average: number;
  rating_count?: number;
}): string | undefined {
  const parts = [
    item.distance_km != null ? `${item.distance_km} km` : null,
    formatDirectoryRating(item.rating_average, item.rating_count),
  ].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(' · ') : undefined;
}
