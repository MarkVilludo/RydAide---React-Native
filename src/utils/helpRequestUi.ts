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

export function formatPhpAmount(amount: number | null | undefined): string | null {
  if (amount == null || !Number.isFinite(amount)) {
    return null;
  }
  return `₱${Math.round(amount).toLocaleString('en-PH')}`;
}

/** Keep digits only from user input. */
export function digitsFromPhpInput(text: string): string {
  return text.replace(/\D/g, '');
}

export function parsePhpDigits(digits: string): number | null {
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Display while typing (digits string → ₱1,234). */
export function formatPhpInputDisplay(digits: string): string {
  if (!digits) return '';
  const n = Number(digits);
  if (!Number.isFinite(n)) return '';
  return `₱${n.toLocaleString('en-PH')}`;
}
