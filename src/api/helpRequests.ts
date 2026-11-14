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
  quote_submission_window_seconds?: number;
  quote_submission_deadline_at?: string | null;
  can_submit_quote?: boolean;
  quote_rejected_at?: string | null;
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
  /** Recorded payment (newer servers). */
  payment?: import('./paymentMethods').JobPaymentRecord | null;
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
  search_started_at?: string | null;
  accepted_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  expires_at?: string | null;
  expired_at?: string | null;
  owner_wait?: {
    expires_at?: string | null;
    extension_prompted_at?: string | null;
    extended_at?: string | null;
    extension_count: number;
    max_extensions: number;
    initial_wait_seconds: number;
    extension_seconds: number;
    initial_wait_ends_at?: string | null;
    can_extend: boolean;
    needs_extension_decision: boolean;
    is_extended: boolean;
  } | null;
  vehicle_description?: string | null;
  /** How the owner plans to pay (newer servers; no account numbers). */
  payment_preference?: { type: string; label: string } | null;
  /** Structured details (newer servers only; null when the request only has the description line). */
  vehicle_details?: {
    type?: string | null;
    type_label?: string | null;
    year?: number | null;
    color?: string | null;
    plate?: string | null;
    transmission?: string | null;
    transmission_label?: string | null;
    fuel?: string | null;
    fuel_label?: string | null;
  } | null;
  problem_category?: ProblemCategory;
  /** All problems in order (first = problem_category). Missing on servers without multi-problem support. */
  problem_category_ids?: number[];
  problem_categories?: ProblemCategory[];
  owner?: HelpRequestOwner;
  vehicle?: HelpRequestVehicle;
  mechanic?: {
    id: number;
    display_name?: string;
    business_name?: string | null;
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
    /** Seconds each notified wave has to accept before search widens. */
    accept_timeout_seconds?: number;
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

/** Owner self-cancellations today vs the daily limit (server: GET /help-requests/cancellations). */
export type HelpCancellationSummary = {
  limit: number | null;
  used_today: number;
  remaining_today: number | null;
  limit_reached: boolean;
  resets_at: string;
  timezone: string;
};

function parseCancellationSummary(raw: unknown): HelpCancellationSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.used_today !== 'number') return null;
  return {
    limit: typeof r.limit === 'number' ? r.limit : null,
    used_today: r.used_today,
    remaining_today: typeof r.remaining_today === 'number' ? r.remaining_today : null,
    limit_reached: r.limit_reached === true,
    resets_at: typeof r.resets_at === 'string' ? r.resets_at : '',
    timezone: typeof r.timezone === 'string' ? r.timezone : 'Asia/Manila',
  };
}

/**
 * Returns null when the server doesn't support the cancellation limit yet (older deploy → 404),
 * so screens simply hide the warning instead of failing.
 */
export async function fetchHelpCancellationSummary(): Promise<HelpCancellationSummary | null> {
  try {
    const { data } = await api.get('/help-requests/cancellations');
    return parseCancellationSummary(data?.data?.cancellations);
  } catch {
    return null;
  }
}

export type CreateHelpRequestPayload = {
  vehicle_id?: number;
  vehicle_description?: string;
  /** Primary problem (first of problem_category_ids). Still sent for servers that only know one. */
  problem_category_id: number;
  problem_category_ids?: number[];
  vehicle_type?: string;
  vehicle_year?: number;
  vehicle_color?: string;
  vehicle_plate?: string;
  vehicle_transmission?: string;
  vehicle_fuel?: string;
  request_type: 'SERVICE' | 'EMERGENCY';
  remarks: string;
  latitude: number;
  longitude: number;
  address_text?: string;
  answers?: Array<{ question_id: number; answer: string }>;
  photoUris?: string[];
  /** Planned payment: a saved wallet id, or 'cash'. Omit both to use the preferred method. */
  payment_method_id?: number | null;
  payment_preference?: 'cash';
};

export async function createHelpRequest(payload: CreateHelpRequestPayload): Promise<HelpRequest> {
  const form = new FormData();
  if (payload.vehicle_id != null) {
    form.append('vehicle_id', String(payload.vehicle_id));
  }
  if (payload.vehicle_description) {
    form.append('vehicle_description', payload.vehicle_description);
  }
  (
    ['vehicle_type', 'vehicle_year', 'vehicle_color', 'vehicle_plate', 'vehicle_transmission', 'vehicle_fuel'] as const
  ).forEach((key) => {
    const value = payload[key];
    if (value != null && String(value).trim() !== '') form.append(key, String(value));
  });
  form.append('problem_category_id', String(payload.problem_category_id));
  payload.problem_category_ids?.forEach((id, index) => {
    form.append(`problem_category_ids[${index}]`, String(id));
  });
  if (payload.payment_method_id != null) {
    form.append('payment_method_id', String(payload.payment_method_id));
  } else if (payload.payment_preference === 'cash') {
    form.append('payment_preference', 'cash');
  }
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
  if (payload.photoUris?.length) {
    for (let index = 0; index < payload.photoUris.length; index++) {
      const uri = payload.photoUris[index]!;
      if (/^https?:\/\//i.test(uri)) {
        const res = await fetch(uri);
        if (!res.ok) {
          throw new Error('Could not load a photo from your last request. Remove it or add a new one.');
        }
        const blob = await res.blob();
        form.append(`photos[${index}]`, blob, `help-photo-${index}.jpg`);
      } else {
        form.append(`photos[${index}]`, {
          uri,
          name: `help-photo-${index}.jpg`,
          type: 'image/jpeg',
        } as unknown as Blob);
      }
    }
  }

  const { data } = await api.post('/help-requests', form);
  const helpRequest = data?.data?.help_request as HelpRequest | undefined;
  if (!helpRequest?.id) {
    throw new Error('Help request was created but the server returned an incomplete response.');
  }
  return helpRequest;
}

export async function fetchHelpRequests(): Promise<HelpRequest[]> {
  const { data } = await api.get('/help-requests');
  return data.data.help_requests;
}

export async function fetchActiveHelpRequest(): Promise<HelpRequest | null> {
  const { data } = await api.get('/help-requests/active');
  return data.data.help_request ?? null;
}

export async function fetchHelpRequest(id: number): Promise<HelpRequest> {
  const { data } = await api.get(`/help-requests/${id}`);
  return data.data.help_request;
}

/** Resolves to today's cancellation summary when the server returns one (null on older servers). */
export async function cancelHelpRequest(id: number): Promise<HelpCancellationSummary | null> {
  const { data } = await api.post(`/help-requests/${id}/cancel`);
  return parseCancellationSummary(data?.data?.cancellations);
}

export async function extendHelpRequest(id: number): Promise<HelpRequest> {
  const { data } = await api.post(`/help-requests/${id}/extend`);
  return data.data.help_request;
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
