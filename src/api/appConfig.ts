import { api } from './client';

export interface AppConfig {
  product_phase: number;
  features: {
    directory: boolean;
    emergency_assistance: boolean;
    mechanic_subscriptions: boolean;
    payments: boolean;
    dynamic_nearby_seed?: boolean;
  };
  seed_anchor?: {
    latitude: number | null;
    longitude: number | null;
    source: 'device' | 'env_fallback' | null;
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
    default_mechanic_service_radius_km?: number;
    min_results_target?: number;
  };
  mechanic_monetization: {
    directory_listing_free: boolean;
    free_emergency_accept_limit: number;
    pro_plan_code: string;
    pro_monthly_price_php: number;
  };
  service_pin?: {
    max_offset_meters: number;
    max_offset_km: number;
  };
}

export interface DirectorySearchMeta {
  requested_radius_km: number;
  applied_radius_km: number;
  recommended_radius_km: number;
  radius_expanded: boolean;
  result_count: number;
  min_results_target: number;
  respects_mechanic_service_radius?: boolean;
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
