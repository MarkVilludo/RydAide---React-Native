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

/** "Flat tire, Battery" — all problems when the server sends them, else the single category. */
export function problemNamesOf(
  request: Pick<HelpRequest, 'problem_category' | 'problem_categories'>,
  fallback = '',
): string {
  const many = request.problem_categories?.map((c) => c.name).filter(Boolean) ?? [];
  if (many.length > 0) return many.join(', ');
  return request.problem_category?.name ?? fallback;
}

/** Cancel-confirm copy that includes today's count when the server reports it. */
export function cancelConfirmMessage(
  summary: { limit: number | null; used_today: number; remaining_today: number | null } | null,
): string {
  const base = 'Stop searching for a mechanic? A cancelled request can’t be resent — you’d start a new one.';
  if (!summary || summary.limit == null || summary.remaining_today == null) return base;
  const after = summary.used_today + 1;
  const left = Math.max(0, summary.limit - after);
  if (left === 0) {
    return `${base}\n\nThis will be cancellation ${after} of ${summary.limit} today. After this you can’t send a new help request until midnight.`;
  }
  return `${base}\n\nThis will be cancellation ${after} of ${summary.limit} today (${left} left).`;
}

/** "Toyota Vios · Car · 2018 · White · ABC 1234 · Automatic · Gasoline" when the server sends details. */
export function vehicleWithDetails(request: HelpRequest): string {
  const d = request.vehicle_details;
  const extra = d
    ? [d.type_label, d.year, d.color, d.plate, d.transmission_label, d.fuel_label].filter(Boolean).join(' · ')
    : '';
  const title = vehicleTitle(request);
  return extra ? `${title} · ${extra}` : title;
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
