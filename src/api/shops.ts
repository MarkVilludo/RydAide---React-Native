import { api } from './client';

export interface Shop {
  id: number;
  name: string;
  description: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  distance_km: number | null;
  rating_average: number;
  verification_status: string;
  services?: string[];
}

export async function searchShops(params: {
  latitude: number;
  longitude: number;
  q?: string;
}): Promise<Shop[]> {
  const { data } = await api.get('/shops', { params: { ...params, radius_km: 50 } });
  return data.data.shops;
}

export async function fetchShop(id: number): Promise<Shop> {
  const { data } = await api.get(`/shops/${id}`);
  return data.data.shop;
}
