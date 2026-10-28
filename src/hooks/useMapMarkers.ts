import { useMemo } from 'react';
import type { MapMarkerRoleConfig } from '../api/appConfig';
import { resolveMapMarkerIconUrl } from '../utils/resolveMapMarkerIconUrl';
import { useAppConfig } from './useAppConfig';

const fallbackCustomer: MapMarkerRoleConfig = {
  label: 'Need help',
  icon_url: null,
  pin_color: '#dc2626',
};

const fallbackMechanic: MapMarkerRoleConfig = {
  label: 'Mechanic',
  icon_url: null,
  pin_color: '#0284c7',
};

function withResolvedIcon(role: MapMarkerRoleConfig): MapMarkerRoleConfig {
  return {
    ...role,
    icon_url: resolveMapMarkerIconUrl(role.icon_url),
  };
}

export function useMapMarkers() {
  const { config } = useAppConfig();

  return useMemo(
    () => ({
      customer: withResolvedIcon(config?.map_markers?.customer ?? fallbackCustomer),
      mechanic: withResolvedIcon(config?.map_markers?.mechanic ?? fallbackMechanic),
    }),
    [config?.map_markers],
  );
}
