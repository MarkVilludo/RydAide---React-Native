import type { Region } from 'react-native-maps';

export type MapZoomPreset = 'default' | 'detail' | 'live';

const PRESETS: Record<
  MapZoomPreset,
  {
    singleDelta: number;
    minDualDelta: number;
    coordPad: number;
    dualZoomOut: number;
    fitPadding: { top: number; right: number; bottom: number; left: number };
  }
> = {
  default: {
    singleDelta: 0.045,
    minDualDelta: 0.028,
    coordPad: 0.02,
    dualZoomOut: 1.12,
    fitPadding: { top: 64, right: 48, bottom: 64, left: 48 },
  },
  detail: {
    // Slightly wider than before so owner/customer pins don't fill the map at open.
    singleDelta: 0.028,
    minDualDelta: 0.022,
    coordPad: 0.014,
    dualZoomOut: 1.12,
    fitPadding: { top: 48, right: 36, bottom: 48, left: 36 },
  },
  /** Active job tracking — keep both pins close with less empty map between them. */
  live: {
    singleDelta: 0.018,
    minDualDelta: 0.008,
    coordPad: 0.004,
    dualZoomOut: 1.04,
    fitPadding: { top: 72, right: 24, bottom: 220, left: 24 },
  },
};

/** Reference zoom used to scale marker icons (≈ neighborhood / detail map). */
export const MAP_MARKER_REF_LATITUDE_DELTA = 0.022;

/** Tuned so default/detail request maps show readable pins without covering the map. */
const MARKER_BASE_PX = 30;
const MARKER_MIN_PX = 24;
const MARKER_MAX_PX = 36;

/**
 * Slightly larger icons when zoomed out, smaller when zoomed in.
 * Kept compact so Request Details does not force users to zoom out.
 */
export function mapMarkerIconSizePx(latitudeDelta: number, sizeScale = 1): number {
  const delta = Math.max(latitudeDelta, 0.003);
  const scale = Math.sqrt(delta / MAP_MARKER_REF_LATITUDE_DELTA) * sizeScale;
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

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(cfg.minDualDelta, spanLat * cfg.dualZoomOut),
    longitudeDelta: Math.max(cfg.minDualDelta, spanLng * cfg.dualZoomOut),
  };
}

export function mapFitEdgePadding(preset: MapZoomPreset) {
  return PRESETS[preset].fitPadding;
}
