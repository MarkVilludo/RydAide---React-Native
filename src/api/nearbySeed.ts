import { api } from './client';

export type NearbySeedResult = {
  status: 'seeded' | 'skipped_recent' | 'disabled' | 'catalog_missing';
  anchor: { latitude: number; longitude: number };
  moved_km: number | null;
  verified_mechanics: number;
};

export async function ensureNearbyProviders(params: {
  latitude: number;
  longitude: number;
  force?: boolean;
}): Promise<NearbySeedResult> {
  const { data } = await api.post('/dev/ensure-nearby-providers', params);
  return data.data.nearby_seed as NearbySeedResult;
}
