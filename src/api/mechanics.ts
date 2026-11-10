import { api } from './client';
import type { DirectorySearchMeta } from './appConfig';

export interface MechanicIdentityVerification {
  gov_id_type?: string;
  gov_id_last4?: string;
  submitted?: boolean;
  submitted_at?: string | null;
  rejection_reason?: string | null;
}

export interface MechanicResult {
  id: number;
  business_name: string;
  address: string | null;
  latitude?: number;
  longitude?: number;
  service_pin_manual?: boolean;
  distance_km: number | null;
  service_radius_km?: number;
  rating_average: number;
  rating_count: number;
  emergency_available: boolean;
  is_verified: boolean;
  verification_status?: string;
  identity_verification?: MechanicIdentityVerification;
  availability_status?: 'available' | 'busy' | 'offline';
  phone: string | null;
  mechanic_name?: string;
}

export async function searchMechanics(params: {
  latitude: number;
  longitude: number;
  vehicle_type_id?: number;
  emergency?: boolean;
  radius_km?: number;
}): Promise<{ mechanics: MechanicResult[]; search: DirectorySearchMeta }> {
  const { data } = await api.get('/mechanics', {
    params: {
      latitude: params.latitude,
      longitude: params.longitude,
      vehicle_type_id: params.vehicle_type_id,
      emergency: params.emergency ? 1 : 0,
      radius_km: params.radius_km,
    },
  });
  return {
    mechanics: data.data.mechanics,
    search: data.data.search,
  };
}
