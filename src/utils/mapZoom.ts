import type { Region } from 'react-native-maps';

export type MapZoomPreset = 'default' | 'detail';

const PRESETS: Record<
  MapZoomPreset,
  {
    singleDelta: number;
    minDualDelta: number;
    coordPad: number;
    fitPadding: { top: number; right: number; bottom: number; left: number };
  }
> = {
  default: {
    singleDelta: 0.045,
    minDualDelta: 0.028,
    coordPad: 0.02,
    fitPadding: { top: 64, right: 48, bottom: 64, left: 48 },
  },
  detail: {
    singleDelta: 0.02,
    minDualDelta: 0.018,
    coordPad: 0.012,
    fitPadding: { top: 48, right: 36, bottom: 48, left: 36 },
  },
};

/** Reference zoom used to scale marker icons (≈ neighborhood block). */
export const MAP_MARKER_REF_LATITUDE_DELTA = 0.022;

const MARKER_BASE_PX = 44;
const MARKER_MIN_PX = 34;
const MARKER_MAX_PX = 58;

/**
 * Larger icons when zoomed out, slightly smaller when zoomed in — stays readable on screen.
 */
export function mapMarkerIconSizePx(latitudeDelta: number): number {
  const delta = Math.max(latitudeDelta, 0.003);
  const scale = Math.sqrt(delta / MAP_MARKER_REF_LATITUDE_DELTA);
  const size = Math.round(MARKER_BASE_PX * scale);
  return Math.min(MARKER_MAX_PX, Math.max(MARKER_MIN_PX, size));
}

export function buildMapRegion(
  preset: MapZoomPreset,
  request: { latitude: number; longitude: number },
  requestCoord: { latitude: number; longitude: number },
  mechanicCoord: { latitude: number; longitude: number } | null,
): Region {
  const cfg = PRESETS[preset];
  const points = mechanicCoord ? [requestCoord, mechanicCoord] : [requestCoord];

  if (points.length === 1) {
    return {
      latitude: request.latitude,
      longitude: request.longitude,
      latitudeDelta: cfg.singleDelta,
      longitudeDelta: cfg.singleDelta,
    };
  }

  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const spanLat = maxLat - minLat + cfg.coordPad;
  const spanLng = maxLng - minLng + cfg.coordPad;
  const dualZoomOut = 1.12;

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(cfg.minDualDelta, spanLat * dualZoomOut),
    longitudeDelta: Math.max(cfg.minDualDelta, spanLng * dualZoomOut),
  };
}

export function mapFitEdgePadding(preset: MapZoomPreset) {
  return PRESETS[preset].fitPadding;
}
