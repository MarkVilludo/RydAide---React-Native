import { api } from './client';

export async function submitAccountDeletionRequest(input: {
  email: string;
  notes?: string;
}): Promise<{ request_id: number }> {
  const { data } = await api.post<{
    success: true;
    data: { request_id: number };
  }>('/account/deletion-request', {
    email: input.email.trim(),
    notes: input.notes?.trim() || undefined,
    confirm: true,
  });
  return data.data;
}
