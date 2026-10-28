import { pickPrimaryOwnerLiveHelpRequest } from '../utils/helpRequestUi';
import { api } from './client';

/** Legacy linked garage record — optional on help requests. */
export interface HelpRequestVehicle {
  id?: number;
  nickname?: string | null;
  year?: number | null;
  current_mileage?: number;
  make?: { id: number; name: string } | null;
  model?: { id: number; name: string } | null;
  variant?: { id: number; name: string } | null;
  vehicle_type?: { id: number; name: string };
}

export interface ProblemCategory {
  id: number;
  name: string;
  slug: string;
}

export interface HelpRequestOwner {
  id: number;
  name: string;
  phone?: string | null;
}

export interface HelpRequestTracking {
  request_location: {
    latitude: number;
    longitude: number;
    address_text: string | null;
  };
  mechanic_location: {
    latitude: number;
    longitude: number;
    updated_at: string | null;
    is_live: boolean;
  } | null;
  distance_km: number | null;
  eta: {
    minutes_min: number;
    minutes_max: number;
    label: string;
  } | null;
  live_tracking_enabled: boolean;
  mechanic_location_status?: {
    availability: string;
    label: string;
    is_stale: boolean;
    updated_seconds_ago: number | null;
  };
  eta_disclaimer?: string;
  location_update?: {
    interval_seconds: number;
    min_distance_meters: number;
  };
}

export interface ServiceJobPricing {
  quoted_service_amount_php?: number | null;
  quote_status?: string;
  quote_description?: string | null;
  quote_submitted_at?: string | null;
  quote_accepted_at?: string | null;
  final_service_amount_php?: number | null;
  payment_status?: string;
  payment_method?: string | null;
  platform_assistance_fee_php?: number;
  mechanic_commission_php?: number;
  mechanic_net_earnings_php?: number;
  preview?: {
    fee_model?: string;
    breakdown?: {
      service_amount_php?: number;
      assistance_fee_php?: number;
      rider_total_php?: number;
      platform_revenue_php?: number;
      mechanic_net_earnings_php?: number;
    };
  } | null;
  require_quote_before_work?: boolean;
}

export interface ServiceJob {
  id: number;
  status: string;
  status_label?: string;
  service_performed?: string | null;
  mechanic_notes?: string | null;
  completion_notes?: string | null;
  parts_used?: unknown;
  accepted_at?: string | null;
  on_the_way_at?: string | null;
  arrived_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  /** Final duration when completed (started_at → completed_at). */
  work_duration_seconds?: number | null;
  /** Live elapsed seconds while status is IN_PROGRESS (server clock; syncs owner + mechanic). */
  work_elapsed_seconds?: number | null;
  shop?: { id: number; name: string } | null;
  pricing?: ServiceJobPricing | null;
}

export interface HelpRequest {
  id: number;
  request_type: string;
  request_type_label?: string;
  status: string;
  status_label?: string;
  job_status?: string;
  job_status_label?: string;
  job?: ServiceJob | null;
  remarks: string;
  latitude: number;
  longitude: number;
  address_text: string | null;
  current_wave: number;
  created_at?: string;
  accepted_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  vehicle_description?: string | null;
  problem_category?: ProblemCategory;
  owner?: HelpRequestOwner;
  vehicle?: HelpRequestVehicle;
  mechanic?: {
    id: number;
    display_name?: string;
    business_name: string;
    phone: string | null;
    rating_average: number;
    rating_count?: number;
    mechanic_name?: string;
    is_verified?: boolean;
    verification_status?: string;
    avatar_url?: string | null;
    vehicle_types?: Array<{ id: number; name: string }>;
  };
  tracking?: HelpRequestTracking | null;
  shop?: { id: number; name: string } | null;
  distance_km?: number;
  answers?: Array<{ question_id: number; answer: string; question: string | null }>;
  media?: Array<{ id: number; media_type: string; url: string }>;
  mechanic_dispatch?: { response: string; responded_at?: string | null };
  search_progress?: {
    current_wave: number;
    total_waves: number;
    search_radius_km_max: number;
    mechanics_notified_total: number;
    mechanics_notified_this_wave: number;
    mechanics_awaiting_response: number;
    mechanics_declined: number;
    progress_percent: number;
    message: string;
  } | null;
  review?: { rating: number; comment?: string | null; created_at?: string };
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

export type CreateHelpRequestPayload = {
  vehicle_id?: number;
  vehicle_description?: string;
  problem_category_id: number;
  request_type: 'SERVICE' | 'EMERGENCY';
  remarks: string;
  latitude: number;
  longitude: number;
  address_text?: string;
  answers?: Array<{ question_id: number; answer: string }>;
  photoUris?: string[];
};

export async function createHelpRequest(payload: CreateHelpRequestPayload): Promise<HelpRequest> {
  const form = new FormData();
  if (payload.vehicle_id != null) {
    form.append('vehicle_id', String(payload.vehicle_id));
  }
  if (payload.vehicle_description) {
    form.append('vehicle_description', payload.vehicle_description);
  }
  form.append('problem_category_id', String(payload.problem_category_id));
  form.append('request_type', payload.request_type);
  form.append('remarks', payload.remarks);
  form.append('latitude', String(payload.latitude));
  form.append('longitude', String(payload.longitude));
  if (payload.address_text) {
    form.append('address_text', payload.address_text);
  }
  payload.answers?.forEach((a, index) => {
    form.append(`answers[${index}][question_id]`, String(a.question_id));
    form.append(`answers[${index}][answer]`, a.answer);
  });
  payload.photoUris?.forEach((uri, index) => {
    form.append(`photos[${index}]`, {
      uri,
      name: `help-photo-${index}.jpg`,
      type: 'image/jpeg',
    } as unknown as Blob);
  });

  const { data } = await api.post('/help-requests', form);
  return data.data.help_request;
}

export async function fetchHelpRequests(): Promise<HelpRequest[]> {
  const { data } = await api.get('/help-requests');
  return data.data.help_requests;
}

export async function fetchOwnerActiveHelpRequest(): Promise<HelpRequest | null> {
  const requests = await fetchHelpRequests();
  return pickPrimaryOwnerLiveHelpRequest(requests);
}

export async function fetchHelpRequest(id: number): Promise<HelpRequest> {
  const { data } = await api.get(`/help-requests/${id}`);
  return data.data.help_request;
}

export async function cancelHelpRequest(id: number): Promise<void> {
  await api.post(`/help-requests/${id}/cancel`);
}

export async function respondToHelpRequestQuote(
  id: number,
  response: 'accept' | 'reject',
): Promise<HelpRequest> {
  const { data } = await api.post(`/help-requests/${id}/quote/respond`, { response });
  return data.data.help_request;
}

export async function submitHelpRequestReview(
  id: number,
  rating: number,
  comment?: string,
): Promise<void> {
  await api.post(`/help-requests/${id}/review`, { rating, comment: comment?.trim() || undefined });
}
