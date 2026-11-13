import type { User } from './types';
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

/** Update your own name / mobile number (newer servers). E-mail can't be changed here. */
export async function updateMyProfile(input: { name?: string; phone?: string | null }): Promise<User> {
  const { data } = await api.patch('/user', input);
  return data.data.user;
}

export async function uploadMyAvatar(file: { uri: string; mimeType?: string | null; fileName?: string | null }): Promise<User> {
  const mime = file.mimeType || (file.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
  const form = new FormData();
  form.append('avatar', { uri: file.uri, name: file.fileName || `avatar.${mime === 'image/png' ? 'png' : 'jpg'}`, type: mime } as unknown as Blob);
  const { data } = await api.post('/user/avatar', form, { timeout: 60000 });
  return data.data.user;
}

export async function removeMyAvatar(): Promise<User> {
  const { data } = await api.delete('/user/avatar');
  return data.data.user;
}
