import { GOOGLE_MAPS_API_KEY } from '../config';

export type MapCoord = { latitude: number; longitude: number };

function decodePolyline(encoded: string): MapCoord[] {
  const points: MapCoord[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return points;
}

/** Driving path for in-app navigation (Google Directions). Falls back to null when unavailable. */
export async function fetchDrivingRoute(
  origin: MapCoord,
  destination: MapCoord,
): Promise<MapCoord[] | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    return null;
  }

  const url =
    `https://maps.googleapis.com/maps/api/directions/json?` +
    `origin=${origin.latitude},${origin.longitude}` +
    `&destination=${destination.latitude},${destination.longitude}` +
    `&mode=driving&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as {
      status?: string;
      routes?: { overview_polyline?: { points?: string } }[];
    };
    if (data.status !== 'OK' || !data.routes?.[0]?.overview_polyline?.points) {
      return null;
    }
    const decoded = decodePolyline(data.routes[0].overview_polyline.points);
    return decoded.length > 1 ? decoded : null;
  } catch {
    return null;
  }
}