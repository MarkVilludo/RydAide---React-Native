import { api } from './client';
import type { HelpRequest } from './helpRequests';

export async function fetchMechanicHelpQueues(): Promise<{ incoming: HelpRequest[]; jobs: HelpRequest[] }> {
  const { data } = await api.get('/mechanic/help-requests');
  return data.data;
}

export async function acceptHelpRequest(id: number): Promise<HelpRequest> {
  const { data } = await api.post(`/mechanic/help-requests/${id}/accept`);
  return data.data.help_request;
}

export async function declineHelpRequest(id: number): Promise<void> {
  await api.post(`/mechanic/help-requests/${id}/decline`);
}

export async function updateJobStatus(id: number, status: string): Promise<HelpRequest> {
  const { data } = await api.post(`/mechanic/help-requests/${id}/status`, { status });
  return data.data.help_request;
}
