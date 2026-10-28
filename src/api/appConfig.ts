import { api } from './client';

export interface AppConfig {
  product_phase: number;
  features: {
    directory: boolean;
    emergency_assistance: boolean;
    mechanic_subscriptions: boolean;
    payments: boolean;
  };
  rollout: {
    area_label: string | null;
    note: string;
  };
  directory: {
    min_radius_km: number;
    default_radius_km: number;
    max_radius_km: number;
    radius_step_km: number;
    radius_options_km: number[];
  };
}

let cached: AppConfig | null = null;

export async function fetchAppConfig(force = false): Promise<AppConfig> {
  if (cached && !force) {
    return cached;
  }
  const { data } = await api.get('/app-config');
  cached = data.data as AppConfig;
  return cached;
}
