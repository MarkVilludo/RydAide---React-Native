import { api } from './client';

export interface OwnerVehicle {
  id: number;
  nickname?: string | null;
  plate_number?: string | null;
  year?: number | null;
  current_mileage?: number;
  is_active?: boolean;
  vehicle_type?: { id: number; name: string };
  make?: { id: number; name: string } | null;
  model?: { id: number; name: string } | null;
  variant?: { id: number; name: string } | null;
}

export function vehicleDisplayLabel(v: OwnerVehicle): string {
  const main = [v.make?.name, v.model?.name, v.variant?.name].filter(Boolean).join(' ');
  if (v.nickname?.trim()) {
    return main ? `${main} (${v.nickname.trim()})` : v.nickname.trim();
  }
  return main || 'Vehicle';
}

export async function fetchOwnerVehicles(): Promise<OwnerVehicle[]> {
  const { data } = await api.get('/vehicles');
  return data.data.vehicles as OwnerVehicle[];
}
