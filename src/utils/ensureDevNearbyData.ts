import axios from 'axios';
import { ensureNearbyProviders } from '../api/nearbySeed';

/**
 * Repositions local test mechanics/shops before directory search (requires login).
 */
export async function ensureDevNearbyDataBeforeSearch(
  enabled: boolean,
  latitude: number,
  longitude: number,
): Promise<void> {
  if (!enabled) {
    return;
  }
  try {
    await ensureNearbyProviders({ latitude, longitude });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // Dev seed requires auth; skip quietly so directory search still works.
      return;
    }
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return;
    }
    throw error;
  }
}
