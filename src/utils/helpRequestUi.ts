import type { HelpRequest } from '../api/helpRequests';

export function vehicleTitle(request: HelpRequest): string {
  if (request.vehicle_description?.trim()) {
    return request.vehicle_description.trim();
  }
  const v = request.vehicle;
  if (!v) return 'Vehicle';
  const label = [v.make?.name, v.model?.name, v.variant?.name].filter(Boolean).join(' ');
  return label || v.nickname || 'Vehicle';
}

export function jobStatusOf(request: HelpRequest): string {
  return request.job_status ?? request.job?.status ?? request.status;
}

export function jobStatusLabelOf(request: HelpRequest): string {
  return request.job_status_label ?? request.job?.status_label ?? request.status_label ?? request.status;
}

export function formatStarRating(rating: number): string {
  const r = Math.max(1, Math.min(5, Math.round(rating)));
  return `${'★'.repeat(r)}${'☆'.repeat(5 - r)}`;
}

export function formatRequestDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function isActiveJobStatus(status: string): boolean {
  return ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'].includes(status);
}

export function canOpenActiveJobMap(request: HelpRequest): boolean {
  return isActiveJobStatus(jobStatusOf(request)) && !!request.job;
}

const OWNER_LIVE_STATUSES = new Set([
  'SEARCHING',
  'ACCEPTED',
  'ON_THE_WAY',
  'ARRIVED',
  'IN_PROGRESS',
]);

export function isOwnerLiveHelpRequest(request: HelpRequest): boolean {
  if (OWNER_LIVE_STATUSES.has(request.status)) {
    return true;
  }
  const job = jobStatusOf(request);
  return isActiveJobStatus(job);
}

/** Newest open help request (list assumed sorted newest-first). */
export function pickPrimaryOwnerLiveHelpRequest(requests: HelpRequest[]): HelpRequest | null {
  return requests.find((r) => isOwnerLiveHelpRequest(r)) ?? null;
}

export function isOwnerTerminalHelpRequest(request: HelpRequest): boolean {
  return ['COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_MECHANIC_FOUND'].includes(request.status);
}

export function isOwnerCompletedHelpRequest(request: HelpRequest): boolean {
  return request.status === 'COMPLETED' || jobStatusOf(request) === 'COMPLETED';
}

/** Owner may cancel only while still searching for a mechanic (not after accept). */
export function canOwnerCancelHelpRequest(request: HelpRequest): boolean {
  return request.status === 'SEARCHING';
}
