import * as SecureStore from 'expo-secure-store';
import type { HelpRequest } from '../api/helpRequests';

export type HelpVehicleType = 'MOTORCYCLE' | 'CAR' | 'SUV' | 'VAN' | 'TRUCK' | 'TRICYCLE';
export type HelpTransmission = 'MANUAL' | 'AUTOMATIC';
export type HelpFuel = 'GASOLINE' | 'DIESEL' | 'ELECTRIC' | 'HYBRID';

export const VEHICLE_TYPES: { value: HelpVehicleType; label: string; icon: string; example: string }[] = [
  { value: 'MOTORCYCLE', label: 'Motorcycle', icon: '🏍️', example: 'Honda Click 125' },
  { value: 'CAR', label: 'Car', icon: '🚗', example: 'Toyota Vios' },
  { value: 'SUV', label: 'SUV', icon: '🚙', example: 'Mitsubishi Montero Sport' },
  { value: 'VAN', label: 'Van', icon: '🚐', example: 'Toyota Hiace' },
  { value: 'TRUCK', label: 'Truck', icon: '🛻', example: 'Isuzu Elf' },
  { value: 'TRICYCLE', label: 'Tricycle', icon: '🛺', example: 'Honda TMX 155' },
];

export const TRANSMISSIONS: { value: HelpTransmission; label: string }[] = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'AUTOMATIC', label: 'Automatic' },
];

export const FUELS: { value: HelpFuel; label: string }[] = [
  { value: 'GASOLINE', label: 'Gasoline' },
  { value: 'DIESEL', label: 'Diesel' },
  { value: 'ELECTRIC', label: 'Electric' },
  { value: 'HYBRID', label: 'Hybrid' },
];

/** Everything the owner can tell us about the vehicle on a HELP request. */
export type HelpVehicleForm = {
  type: HelpVehicleType | null;
  makeModel: string;
  plate: string;
  color: string;
  year: string;
  transmission: HelpTransmission | null;
  fuel: HelpFuel | null;
};

export const EMPTY_VEHICLE: HelpVehicleForm = {
  type: null,
  makeModel: '',
  plate: '',
  color: '',
  year: '',
  transmission: null,
  fuel: null,
};

export function vehicleTypeMeta(type: HelpVehicleType | null) {
  return VEHICLE_TYPES.find((t) => t.value === type) ?? null;
}

/** Best-effort map from the catalog type name of a saved garage vehicle. */
export function typeFromCatalogName(name?: string | null): HelpVehicleType | null {
  const n = (name ?? '').toLowerCase();
  if (!n) return null;
  if (n.includes('tricycle')) return 'TRICYCLE';
  if (n.includes('motor') || n.includes('scooter')) return 'MOTORCYCLE';
  if (n.includes('suv')) return 'SUV';
  if (n.includes('van')) return 'VAN';
  if (n.includes('truck') || n.includes('pickup')) return 'TRUCK';
  if (n.includes('car') || n.includes('sedan') || n.includes('hatch')) return 'CAR';
  return null;
}

export function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/\s+/g, ' ').trim();
}

// Common PH formats: cars ABC 1234 / ABC 123, older motorcycles 123 ABC, newer motorcycles AB 12345 / 1234 AB.
const PH_PLATE_PATTERNS = [
  /^[A-Z]{3} ?-?\d{3,4}$/,
  /^\d{3} ?-?[A-Z]{3}$/,
  /^[A-Z]{2} ?-?\d{4,5}$/,
  /^\d{4} ?-?[A-Z]{2}$/,
];

export type FieldErrors = Partial<Record<'type' | 'makeModel' | 'plate' | 'year', string>>;

export function vehicleErrors(v: HelpVehicleForm): FieldErrors {
  const e: FieldErrors = {};
  if (!v.type) e.type = 'Choose the type of vehicle.';
  const example = vehicleTypeMeta(v.type)?.example ?? 'Honda Click 125';
  if (v.makeModel.trim().length < 2) e.makeModel = `Enter the make and model, e.g. ${example}.`;
  const plate = normalizePlate(v.plate);
  if (plate && !/^[A-Z0-9][A-Z0-9 -]{1,14}[A-Z0-9]$/.test(plate)) {
    e.plate = 'Use letters and numbers only, e.g. ABC 1234.';
  }
  const y = v.year.trim();
  if (y) {
    const n = Number(y);
    const max = new Date().getFullYear() + 1;
    if (!/^\d{4}$/.test(y) || n < 1950 || n > max) e.year = `Enter a 4-digit year between 1950 and ${max}.`;
  }
  return e;
}

/** Soft hint only (never blocks): plate is valid characters but not a usual PH format. */
export function plateFormatHint(plate: string): string | null {
  const p = normalizePlate(plate);
  if (p.length < 3 || !/^[A-Z0-9 -]+$/.test(p)) return null;
  if (PH_PLATE_PATTERNS.some((re) => re.test(p))) return null;
  return 'This doesn’t look like a usual PH plate (e.g. ABC 1234, 123 ABC or NB 12345). You can still continue — a conduction sticker or temporary plate is fine.';
}

/** "Car · 2018 · White · ABC 1234 · Automatic · Gasoline" */
export function vehicleDetailsLine(v: HelpVehicleForm): string {
  return [
    vehicleTypeMeta(v.type)?.label,
    v.year.trim(),
    v.color.trim(),
    normalizePlate(v.plate),
    TRANSMISSIONS.find((t) => t.value === v.transmission)?.label,
    FUELS.find((f) => f.value === v.fuel)?.label,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Same line from a request the server returned (empty when the server didn't send details). */
export function requestVehicleDetailsLine(request: Pick<HelpRequest, 'vehicle_details'>): string {
  const d = request.vehicle_details;
  if (!d) return '';
  return [d.type_label, d.year, d.color, d.plate, d.transmission_label, d.fuel_label].filter(Boolean).join(' · ');
}

export function vehicleFormFromRequest(request: Pick<HelpRequest, 'vehicle_details'>, makeModel: string): HelpVehicleForm {
  const d = request.vehicle_details;
  return {
    type: (d?.type as HelpVehicleType | undefined) ?? null,
    makeModel,
    plate: d?.plate ?? '',
    color: d?.color ?? '',
    year: d?.year != null ? String(d.year) : '',
    transmission: (d?.transmission as HelpTransmission | undefined) ?? null,
    fuel: (d?.fuel as HelpFuel | undefined) ?? null,
  };
}

/** Fields for POST /help-requests (only filled ones). */
export function vehicleApiFields(v: HelpVehicleForm) {
  const plate = normalizePlate(v.plate);
  return {
    ...(v.type ? { vehicle_type: v.type } : {}),
    ...(v.year.trim() ? { vehicle_year: Number(v.year.trim()) } : {}),
    ...(v.color.trim() ? { vehicle_color: v.color.trim().slice(0, 40) } : {}),
    ...(plate ? { vehicle_plate: plate.slice(0, 16) } : {}),
    ...(v.transmission ? { vehicle_transmission: v.transmission } : {}),
    ...(v.fuel ? { vehicle_fuel: v.fuel } : {}),
  };
}

// ---- Remember the last vehicle typed on this device (per account) ----

function storeKey(userId: number | string) {
  return `rydaid_last_help_vehicle_v1_${userId}`;
}

export async function loadLastHelpVehicle(userId: number | string | undefined): Promise<HelpVehicleForm | null> {
  if (userId == null) return null;
  try {
    const raw = await SecureStore.getItemAsync(storeKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HelpVehicleForm>;
    if (typeof parsed.makeModel !== 'string' || parsed.makeModel.trim().length < 2) return null;
    return { ...EMPTY_VEHICLE, ...parsed };
  } catch {
    return null;
  }
}

export async function saveLastHelpVehicle(userId: number | string | undefined, v: HelpVehicleForm): Promise<void> {
  if (userId == null) return;
  try {
    await SecureStore.setItemAsync(storeKey(userId), JSON.stringify(v));
  } catch {
    /* not critical */
  }
}

export async function forgetLastHelpVehicle(userId: number | string | undefined): Promise<void> {
  if (userId == null) return;
  try {
    await SecureStore.deleteItemAsync(storeKey(userId));
  } catch {
    /* ignore */
  }
}
