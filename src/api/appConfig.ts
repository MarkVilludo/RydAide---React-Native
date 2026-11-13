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
    pro_yearly_price_php?: number;
    simulate_purchase_enabled?: boolean;
    store_product_ids?: {
      ios?: string;
      ios_yearly?: string;
      android?: string;
      android_yearly?: string;
    };
  };
  service_pin?: {
    max_offset_meters: number;
    max_offset_km: number;
  };
  map_markers?: {
    customer: MapMarkerRoleConfig;
    mechanic: MapMarkerRoleConfig;
  };
  legal?: {
    privacy_url?: string;
    account_deletion_url?: string;
  };
  auth?: {
    require_email_verification?: boolean;
  };
  /** Contact Support options (newer servers). Null = not configured, hide it. */
  support?: {
    email?: string | null;
    phone?: string | null;
    messenger_url?: string | null;
    faq_url?: string | null;
    hours?: string | null;
  };
}

export type MapMarkerRoleConfig = {
  label: string;
  icon_url: string | null;
  pin_color: string;
};

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

/** Last loaded config (preloaded during launch), so screens render with the right features on first paint. */
export function getCachedAppConfig(): AppConfig | null {
  return cached;
}

export async function fetchAppConfig(force = false): Promise<AppConfig> {
  if (cached && !force) {
    return cached;
  }
  const { data } = await api.get('/app-config');
  cached = data.data as AppConfig;
  return cached;
}
