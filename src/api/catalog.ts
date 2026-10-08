import { api } from './client';

export interface CatalogItem {
  id: number;
  name: string;
  slug: string;
}

export async function fetchVehicleTypes(): Promise<CatalogItem[]> {
  const { data } = await api.get('/catalog/vehicle-types');
  return data.data.vehicle_types;
}

export async function fetchMakes(vehicleTypeId: number): Promise<CatalogItem[]> {
  const { data } = await api.get('/catalog/makes', { params: { vehicle_type_id: vehicleTypeId } });
  return data.data.makes;
}

export async function fetchModels(vehicleMakeId: number): Promise<CatalogItem[]> {
  const { data } = await api.get('/catalog/models', { params: { vehicle_make_id: vehicleMakeId } });
  return data.data.models;
}

export async function fetchVariants(vehicleModelId: number): Promise<CatalogItem[]> {
  const { data } = await api.get('/catalog/variants', { params: { vehicle_model_id: vehicleModelId } });
  return data.data.variants;
}

export async function fetchYears(vehicleVariantId: number): Promise<number[]> {
  const { data } = await api.get('/catalog/years', { params: { vehicle_variant_id: vehicleVariantId } });
  return data.data.years;
}
