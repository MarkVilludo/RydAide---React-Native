import { api } from './client';
import type { DirectorySearchMeta } from './appConfig';

export interface Shop {
  id: number;
  name: string;
  description: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_km: number | null;
  rating_average: number;
  rating_count?: number;
  verification_status: string;
  emergency_available?: boolean;
  mobile_service?: boolean;
  services?: string[];
}

export async function searchShops(params: {
  latitude: number;
  longitude: number;
  radius_km?: number;
  q?: string;
}): Promise<{ shops: Shop[]; search: DirectorySearchMeta }> {
  const { data } = await api.get('/shops', { params });
  return {
    shops: data.data.shops,
    search: data.data.search,
  };
}

export async function fetchShop(id: number): Promise<Shop> {
  const { data } = await api.get(`/shops/${id}`);
  return data.data.shop;
}
