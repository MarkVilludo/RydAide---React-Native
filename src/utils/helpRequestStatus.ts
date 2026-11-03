/**
 * Status helpers with no imports from api/helpRequests — avoids Metro circular init crashes.
 */
export type HelpRequestStatusSource = {
  status: string;
  status_label?: string;
  job_status?: string;
  job_status_label?: string;
  job?: { status?: string; status_label?: string } | null;
};

export function jobStatusOf(request: HelpRequestStatusSource): string {
  return request.job_status ?? request.job?.status ?? request.status;
}

export function jobStatusLabelOf(request: HelpRequestStatusSource): string {
  return (
    request.job_status_label ??
    request.job?.status_label ??
    request.status_label ??
    request.status
  );
}

export function isActiveJobStatus(status: string): boolean {
  return ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'].includes(status);
}

const OWNER_LIVE_STATUSES = new Set([
  'SEARCHING',
  'ACCEPTED',
  'ON_THE_WAY',
  'ARRIVED',
  'IN_PROGRESS',
]);

export function isOwnerLiveHelpRequest(request: HelpRequestStatusSource): boolean {
  if (OWNER_LIVE_STATUSES.has(request.status)) {
    return true;
  }
  return isActiveJobStatus(jobStatusOf(request));
}

export function pickPrimaryOwnerLiveHelpRequest<T extends HelpRequestStatusSource>(
  requests: T[],
): T | null {
  return requests.find((r) => isOwnerLiveHelpRequest(r)) ?? null;
}

export function isOwnerTerminalHelpRequest(request: HelpRequestStatusSource): boolean {
  return ['COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_MECHANIC_FOUND'].includes(request.status);
}

export function isOwnerCompletedHelpRequest(request: HelpRequestStatusSource): boolean {
  return request.status === 'COMPLETED' || jobStatusOf(request) === 'COMPLETED';
}

export function canOwnerCancelHelpRequest(request: HelpRequestStatusSource): boolean {
  return request.status === 'SEARCHING';
}

export function canOpenActiveJobMap(request: HelpRequestStatusSource): boolean {
  return isActiveJobStatus(jobStatusOf(request)) && !!request.job;
}
