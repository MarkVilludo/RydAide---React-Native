import { api } from './client';

export interface Vehicle {
  id: number;
  nickname: string | null;
  plate_number: string | null;
  year: number | null;
  current_mileage: number;
  vehicle_type?: { id: number; name: string };
  make?: { id: number; name: string };
  model?: { id: number; name: string };
  variant?: { id: number; name: string } | null;
}

export async function fetchVehicles(): Promise<Vehicle[]> {
  const { data } = await api.get('/vehicles');
  return data.data.vehicles;
}

export async function createVehicle(payload: {
  vehicle_type_id: number;
  vehicle_make_id: number;
  vehicle_model_id: number;
  vehicle_variant_id?: number;
  year?: number;
  current_mileage?: number;
  plate_number?: string;
  nickname?: string;
}): Promise<Vehicle> {
  const { data } = await api.post('/vehicles', payload);
  return data.data.vehicle;
}
