import type { HelpRequest } from '../api/helpRequests';
import { jobStatusOf } from './helpRequestStatus';

export type MechanicMapPoint = {
  latitude: number;
  longitude: number;
  title: string;
};

const TRAVEL_JOB_STATUSES = new Set(['ACCEPTED', 'ON_THE_WAY', 'ARRIVED']);

/** Owner map should show live mechanic tracking for active travel phases. */
export function ownerShowsLiveMechanicMap(request: HelpRequest): boolean {
  if (!request.mechanic) {
    return false;
  }
  const job = jobStatusOf(request);
  if (TRAVEL_JOB_STATUSES.has(job)) {
    return true;
  }
  if (job === 'IN_PROGRESS') {
    return !!request.tracking?.mechanic_location;
  }
  return false;
}

export function ownerExpectsMechanicGps(request: HelpRequest): boolean {
  const job = jobStatusOf(request);
  return (
    !!request.tracking?.live_tracking_enabled &&
    TRAVEL_JOB_STATUSES.has(job) &&
    !request.tracking?.mechanic_location
  );
}

export function mechanicMapPointForOwner(
  request: HelpRequest,
  mechanicTitle: string,
): MechanicMapPoint | null {
  const loc = request.tracking?.mechanic_location;
  if (!loc) {
    return null;
  }
  return {
    latitude: loc.latitude,
    longitude: loc.longitude,
    title: mechanicTitle,
  };
}