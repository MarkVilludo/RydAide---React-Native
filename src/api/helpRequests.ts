import { api } from './client';
import type { Vehicle } from './vehicles';

export interface ProblemCategory {
  id: number;
  name: string;
  slug: string;
}

export interface HelpRequest {
  id: number;
  request_type: string;
  status: string;
  remarks: string;
  latitude: number;
  longitude: number;
  address_text: string | null;
  current_wave: number;
  problem_category?: ProblemCategory;
  vehicle?: Vehicle;
  mechanic?: {
    id: number;
    business_name: string;
    phone: string | null;
    rating_average: number;
    mechanic_name?: string;
  };
}

export async function fetchProblemCategories(): Promise<ProblemCategory[]> {
  const { data } = await api.get('/problem-categories');
  return data.data.categories;
}

export async function fetchCategoryQuestions(categoryId: number) {
  const { data } = await api.get(`/problem-categories/${categoryId}`);
  return data.data.category.questions as Array<{
    id: number;
    question_text: string;
    answer_type: string;
  }>;
}

export async function createHelpRequest(payload: {
  vehicle_id: number;
  problem_category_id: number;
  request_type: 'SERVICE' | 'EMERGENCY';
  remarks: string;
  latitude: number;
  longitude: number;
  address_text?: string;
  answers?: Array<{ question_id: number; answer: string }>;
}): Promise<HelpRequest> {
  const { data } = await api.post('/help-requests', payload);
  return data.data.help_request;
}

export async function fetchHelpRequests(): Promise<HelpRequest[]> {
  const { data } = await api.get('/help-requests');
  return data.data.help_requests;
}

export async function fetchHelpRequest(id: number): Promise<HelpRequest> {
  const { data } = await api.get(`/help-requests/${id}`);
  return data.data.help_request;
}

export async function cancelHelpRequest(id: number): Promise<void> {
  await api.post(`/help-requests/${id}/cancel`);
}
