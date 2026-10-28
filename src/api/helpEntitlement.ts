import { api } from './client';

export interface HelpRequestEntitlement {
  limit: number | null;
  used: number;
  remaining: number | null;
  unlimited: boolean;
}

export interface HelpUsageEntry {
  counted_at: string;
  request_type: string;
  request_type_label: string;
  help_request_id: number;
  vehicle_label: string | null;
  credits_used: number;
}

export interface OwnerHelpEntitlement {
  plan: string;
  plan_code: string;
  help_requests: HelpRequestEntitlement;
  usage: HelpUsageEntry[];
}

export async function fetchOwnerHelpEntitlement(): Promise<OwnerHelpEntitlement> {
  const { data } = await api.get('/me/help-entitlement');
  return data.data;
}
