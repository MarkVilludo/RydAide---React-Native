import { api } from './client';
import type { MechanicResult } from './mechanics';

export type GovIdType =
  | 'drivers_license'
  | 'national_id'
  | 'umid'
  | 'passport'
  | 'other';

export interface MechanicProfilePayload {
  business_name: string;
  first_name?: string;
  last_name?: string;
  bio?: string;
  address?: string;
  latitude: number;
  longitude: number;
  phone?: string;
  service_radius_km?: number;
  mobile_service_available?: boolean;
  emergency_available?: boolean;
  vehicle_type_ids?: number[];
  service_ids?: number[];
}

export interface MechanicIdentityPayload {
  gov_id_type: GovIdType;
  gov_id_number: string;
  idDocumentUri: string;
  idSelfieUri: string;
}

export type CreateMechanicProfilePayload = MechanicProfilePayload & MechanicIdentityPayload;

export async function fetchMyMechanicProfile(): Promise<MechanicResult | null> {
  const { data } = await api.get('/mechanic/profile');
  return data.data.mechanic ?? null;
}

function appendListingFields(form: FormData, payload: MechanicProfilePayload): void {
  form.append('business_name', payload.business_name);
  if (payload.first_name) form.append('first_name', payload.first_name);
  if (payload.last_name) form.append('last_name', payload.last_name);
  if (payload.bio) form.append('bio', payload.bio);
  if (payload.address) form.append('address', payload.address);
  form.append('latitude', String(payload.latitude));
  form.append('longitude', String(payload.longitude));
  if (payload.phone) form.append('phone', payload.phone);
  if (payload.service_radius_km != null) {
    form.append('service_radius_km', String(payload.service_radius_km));
  }
  if (payload.mobile_service_available != null) {
    form.append('mobile_service_available', payload.mobile_service_available ? '1' : '0');
  }
  if (payload.emergency_available != null) {
    form.append('emergency_available', payload.emergency_available ? '1' : '0');
  }
  payload.vehicle_type_ids?.forEach((id) => form.append('vehicle_type_ids[]', String(id)));
  payload.service_ids?.forEach((id) => form.append('service_ids[]', String(id)));
}

export async function createMechanicProfile(payload: CreateMechanicProfilePayload) {
  const form = new FormData();
  appendListingFields(form, payload);
  form.append('gov_id_type', payload.gov_id_type);
  form.append('gov_id_number', payload.gov_id_number);
  form.append('id_document', {
    uri: payload.idDocumentUri,
    name: 'id-document.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);
  form.append('id_selfie', {
    uri: payload.idSelfieUri,
    name: 'id-selfie.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  const { data } = await api.post('/mechanic/profile', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data.mechanic as MechanicResult;
}

export async function updateMechanicProfile(payload: MechanicProfilePayload) {
  const { data } = await api.put('/mechanic/profile', payload);
  return data.data.mechanic as MechanicResult;
}

export async function updateMechanicAvailability(
  availability_status: 'available' | 'offline',
): Promise<MechanicResult> {
  const { data } = await api.patch('/mechanic/availability', { availability_status });
  return data.data.mechanic as MechanicResult;
}

export async function updateMechanicProfileLocation(latitude: number, longitude: number): Promise<void> {
  await api.patch('/mechanic/profile/location', { latitude, longitude });
}
