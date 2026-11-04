import { api } from './client';

export type MechanicFreeCredits = {
  total: number;
  used: number;
  remaining: number;
};

export type MechanicSubscriptionDetails = {
  billing_status: string;
  plan_name: string;
  plan_code: string;
  amount_php: number;
  billing_interval: string;
  currency: string;
  free_credits: MechanicFreeCredits;
  subscription: {
    id: number;
    status: string;
    starts_at: string | null;
    expires_at: string | null;
    next_billing_at: string | null;
    cancelled_at: string | null;
    gateway: string | null;
    payment_method: string | null;
  } | null;
  payments_enabled: boolean;
  payment_method_label: string;
  billing_provider?: string;
  store_products?: { ios?: string; android?: string };
};

export type PaymentHistoryItem = {
  id: number;
  amount: number;
  currency: string;
  payment_method: string | null;
  status: string;
  payment_reference: string;
  paid_at: string | null;
  created_at: string | null;
};

export async function fetchMechanicSubscription(): Promise<{
  subscription: MechanicSubscriptionDetails;
  payment_history: PaymentHistoryItem[];
}> {
  const { data } = await api.get('/mechanic/subscription');
  return data.data;
}

export async function verifyMechanicProStorePurchase(body: {
  platform: 'ios' | 'android';
  product_id: string;
  purchase_token?: string;
  receipt_data?: string;
  transaction_id?: string;
  original_transaction_id?: string;
  sandbox?: boolean;
}): Promise<{ already_processed: boolean; subscription: MechanicSubscriptionDetails }> {
  const { data } = await api.post('/mechanic/subscription/verify-purchase', body);
  return data.data;
}

export async function cancelMechanicSubscription(): Promise<void> {
  await api.post('/mechanic/subscription/cancel');
}

export function isSubscriptionRequiredError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return false;
  }
  const response = (error as { response?: { data?: { code?: string } } }).response;
  return response?.data?.code === 'SUBSCRIPTION_REQUIRED';
}
