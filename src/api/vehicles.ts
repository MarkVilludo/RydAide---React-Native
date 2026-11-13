import axios from 'axios';
import {
  normalizePlate,
  typeFromCatalogName,
  type HelpFuel,
  type HelpTransmission,
  type HelpVehicleForm,
  type HelpVehicleType,
} from '../utils/helpVehicle';
import { api } from './client';

export interface OwnerVehicle {
  id: number;
  nickname?: string | null;
  plate_number?: string | null;
  year?: number | null;
  current_mileage?: number;
  is_active?: boolean;
  /** Newer servers: same free-text details as the HELP request vehicle step. */
  type?: string | null;
  type_label?: string | null;
  make_model?: string | null;
  display_name?: string | null;
  color?: string | null;
  transmission?: string | null;
  transmission_label?: string | null;
  fuel?: string | null;
  fuel_label?: string | null;
  is_default?: boolean;
  vehicle_type?: { id: number; name: string } | null;
  make?: { id: number; name: string } | null;
  model?: { id: number; name: string } | null;
  variant?: { id: number; name: string } | null;
}

export function vehicleDisplayLabel(v: OwnerVehicle): string {
  if (v.display_name?.trim()) return v.display_name.trim();
  if (v.make_model?.trim()) return v.make_model.trim();
  const main = [v.make?.name, v.model?.name, v.variant?.name].filter(Boolean).join(' ');
  if (v.nickname?.trim()) {
    return main ? `${main} (${v.nickname.trim()})` : v.nickname.trim();
  }
  return main || 'Vehicle';
}

/** HELP-step type key for a saved vehicle (free-text type, else the catalog type name). */
export function savedVehicleType(v: OwnerVehicle): HelpVehicleType | null {
  return (v.type as HelpVehicleType | null | undefined) ?? typeFromCatalogName(v.vehicle_type?.name);
}

/** Saved vehicle → the HELP step / vehicle form shape. */
export function vehicleFormFromSaved(v: OwnerVehicle): HelpVehicleForm {
  return {
    type: savedVehicleType(v),
    makeModel: vehicleDisplayLabel(v) === 'Vehicle' ? '' : vehicleDisplayLabel(v),
    plate: v.plate_number?.trim() ?? '',
    color: v.color?.trim() ?? '',
    year: v.year ? String(v.year) : '',
    transmission: (v.transmission as HelpTransmission | null | undefined) ?? null,
    fuel: (v.fuel as HelpFuel | null | undefined) ?? null,
  };
}

/** Body for POST/PUT /vehicles. Empty optional fields are sent as null so edits can clear them. */
export function vehiclePayloadFromForm(f: HelpVehicleForm, extra?: { is_default?: boolean }) {
  const plate = normalizePlate(f.plate);
  return {
    type: f.type,
    make_model: f.makeModel.trim().slice(0, 120),
    plate_number: plate ? plate.slice(0, 16) : null,
    color: f.color.trim() ? f.color.trim().slice(0, 40) : null,
    year: f.year.trim() ? Number(f.year.trim()) : null,
    transmission: f.transmission,
    fuel: f.fuel,
    ...(extra?.is_default != null ? { is_default: extra.is_default } : {}),
  };
}

/** "Car · 2018 · White · ABC 1234 · Automatic · Gasoline" for a saved vehicle. */
export function savedVehicleDetailsLine(v: OwnerVehicle): string {
  return [
    v.type_label ?? v.vehicle_type?.name,
    v.year,
    v.color,
    v.plate_number?.trim(),
    v.transmission_label,
    v.fuel_label,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** True when the server is older and has no vehicle management endpoints yet. */
export function isVehicleApiMissing(e: unknown): boolean {
  if (!axios.isAxiosError(e)) return false;
  const status = e.response?.status;
  if (status === 405) return true;
  // Unknown route on an older server ("The route … could not be found."), not a removed vehicle.
  if (status === 404) {
    const msg = (e.response?.data as { message?: string } | undefined)?.message ?? '';
    return msg === '' || /route .* could not be found/i.test(msg);
  }
  // Older servers only accept catalog ids, so they reject the free-text form on those fields.
  if (status === 422) {
    const errors = (e.response?.data as { errors?: Record<string, unknown> } | undefined)?.errors ?? {};
    return 'vehicle_type_id' in errors || 'vehicle_make_id' in errors || 'vehicle_model_id' in errors;
  }
  return false;
}

export async function fetchOwnerVehicles(): Promise<OwnerVehicle[]> {
  const { data } = await api.get('/vehicles');
  const list = (data.data.vehicles as OwnerVehicle[]).filter((v) => v.is_active !== false);
  // Older servers don't sort by default; keep the default first anyway.
  return [...list].sort((a, b) => Number(Boolean(b.is_default)) - Number(Boolean(a.is_default)));
}

/** The vehicle to pre-select on a new HELP request: the default, or the only one. */
export function defaultVehicleOf(list: OwnerVehicle[]): OwnerVehicle | null {
  return list.find((v) => v.is_default) ?? (list.length === 1 ? list[0]! : null);
}

export async function createVehicle(f: HelpVehicleForm, opts?: { is_default?: boolean }): Promise<OwnerVehicle> {
  const { data } = await api.post('/vehicles', vehiclePayloadFromForm(f, opts));
  return data.data.vehicle as OwnerVehicle;
}

export async function updateVehicle(id: number, f: HelpVehicleForm, opts?: { is_default?: boolean }): Promise<OwnerVehicle> {
  // POST is accepted for updates (multipart/PUT can be unreliable on some devices).
  const { data } = await api.post(`/vehicles/${id}`, vehiclePayloadFromForm(f, opts));
  return data.data.vehicle as OwnerVehicle;
}

export async function setDefaultVehicle(id: number): Promise<OwnerVehicle> {
  const { data } = await api.post(`/vehicles/${id}/default`);
  return data.data.vehicle as OwnerVehicle;
}

export async function deleteVehicle(id: number): Promise<void> {
  await api.delete(`/vehicles/${id}`);
}

/** First server validation message for a field, if any. */
export function vehicleFieldError(e: unknown, field: string): string | null {
  if (!axios.isAxiosError(e)) return null;
  const errors = (e.response?.data as { errors?: Record<string, string[]> } | undefined)?.errors;
  return errors?.[field]?.[0] ?? null;
}
