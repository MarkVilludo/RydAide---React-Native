import type { HelpRequest } from '../api/helpRequests';

export function vehicleTitle(request: HelpRequest): string {
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
