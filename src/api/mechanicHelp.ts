import { api } from './client';
import type { HelpRequest } from './helpRequests';

export type MechanicRequestSummary = {
  incoming: number;
  accepted_active: number;
  in_progress: number;
  completed: number;
  declined: number;
  cancelled_expired: number;
};

export type MechanicHelpQueues = {
  summary: MechanicRequestSummary;
  incoming: HelpRequest[];
  accepted_active: HelpRequest[];
  in_progress: HelpRequest[];
  completed: HelpRequest[];
  declined: HelpRequest[];
  cancelled_expired: HelpRequest[];
  jobs: HelpRequest[];
};

export async function fetchActiveJob(): Promise<HelpRequest | null> {
  const { data } = await api.get('/mechanic/active-job');
  return data.data.help_request ?? null;
}

export async function fetchMechanicHelpQueues(coords?: {
  latitude: number;
  longitude: number;
}): Promise<MechanicHelpQueues> {
  const params =
    coords != null
      ? { latitude: coords.latitude, longitude: coords.longitude }
      : undefined;
  const { data } = await api.get('/mechanic/help-requests', { params });
  return data.data;
}

export async function fetchMechanicHelpRequest(id: number): Promise<HelpRequest> {
  const { data } = await api.get(`/mechanic/help-requests/${id}`);
  return data.data.help_request;
}

export async function acceptHelpRequest(id: number): Promise<HelpRequest> {
  const { data } = await api.post(`/mechanic/help-requests/${id}/accept`);
  return data.data.help_request;
}

export async function declineHelpRequest(id: number): Promise<void> {
  await api.post(`/mechanic/help-requests/${id}/decline`);
}

export async function submitServiceQuote(
  id: number,
  amount_php: number,
  description?: string,
): Promise<HelpRequest> {
  const { data } = await api.post(`/mechanic/help-requests/${id}/quote`, {
    amount_php,
    description,
  });
  return data.data.help_request;
}

export async function updateJobStatus(
  id: number,
  status: string,
  extra?: {
    service_performed?: string;
    completion_notes?: string;
    mechanic_notes?: string;
    parts_used?: unknown;
    final_service_amount_php?: number;
  },
): Promise<HelpRequest> {
  const { data } = await api.post(`/mechanic/help-requests/${id}/status`, {
    status,
    ...extra,
  });
  return data.data.help_request;
}

export async function postMechanicLiveLocation(
  id: number,
  latitude: number,
  longitude: number,
): Promise<void> {
  await api.post(`/mechanic/help-requests/${id}/location`, { latitude, longitude });
}
