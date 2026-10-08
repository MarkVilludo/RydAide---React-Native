import { api } from './client';

export interface MechanicResult {
  id: number;
  business_name: string;
  address: string | null;
  distance_km: number | null;
  rating_average: number;
  rating_count: number;
  emergency_available: boolean;
  is_verified: boolean;
  phone: string | null;
  mechanic_name?: string;
}

export async function searchMechanics(params: {
  latitude: number;
  longitude: number;
  vehicle_type_id?: number;
  emergency?: boolean;
}): Promise<MechanicResult[]> {
  const { data } = await api.get('/mechanics', {
    params: {
      latitude: params.latitude,
      longitude: params.longitude,
      vehicle_type_id: params.vehicle_type_id,
      emergency: params.emergency ? 1 : 0,
      radius_km: 50,
    },
  });
  return data.data.mechanics;
}
