import type { HelpRequest } from '../api/helpRequests';

export {
  canOpenActiveJobMap,
  canOwnerCancelHelpRequest,
  isActiveJobStatus,
  isOwnerCompletedHelpRequest,
  isOwnerLiveHelpRequest,
  isOwnerTerminalHelpRequest,
  jobStatusLabelOf,
  jobStatusOf,
  pickPrimaryOwnerLiveHelpRequest,
} from './helpRequestStatus';

export type { HelpRequestStatusSource } from './helpRequestStatus';

export function vehicleTitle(request: HelpRequest): string {
  if (request.vehicle_description?.trim()) {
    return request.vehicle_description.trim();
  }
  const v = request.vehicle;
  if (!v) return 'Vehicle';
  const label = [v.make?.name, v.model?.name, v.variant?.name].filter(Boolean).join(' ');
  return label || v.nickname || 'Vehicle';
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
