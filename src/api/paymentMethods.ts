import axios from 'axios';
import { api } from './client';
import type { HelpRequest } from './helpRequests';

/** Wallet types a user can save. Cash is always available and never saved as a wallet. */
export type WalletType = 'GCASH' | 'MAYA' | 'OTHER';
export type PaymentType = 'CASH' | WalletType;

export interface PaymentWallet {
  id: number;
  type: WalletType;
  /** "GCash", "Maya" or the provider name for OTHER. */
  label: string;
  provider_name: string | null;
  account_name: string;
  /** Full number — only for your own wallets, or your mechanic's on your job. */
  account_number?: string;
  /** e.g. 0917 123 4567 */
  account_number_display?: string;
  /** e.g. 09•• ••• 4567 */
  account_number_masked: string;
  /** Protected API URL (needs the bearer token — use protectedImageSource). Public /storage URL on older servers. */
  qr_url: string | null;
  has_qr?: boolean;
  is_preferred: boolean;
  updated_at?: string | null;
}

export interface CashOption {
  type: 'CASH';
  label: string;
  available: true;
  is_preferred: boolean;
}

export interface PaymentMethodsSummary {
  cash: CashOption;
  wallets: PaymentWallet[];
  preferred: { type: PaymentType; label: string; payment_method_id: number | null };
  limits: { max_wallets: number; max_qr_mb: number };
}

export interface JobPaymentRecord {
  status: string;
  is_paid: boolean;
  method: string | null;
  method_label: string | null;
  details: {
    type?: string;
    label?: string;
    payment_method_id?: number;
    account_name?: string;
    account_number_masked?: string;
  } | null;
  recorded_at: string | null;
}

export interface MechanicPaymentInfo {
  mechanic_name: string | null;
  amount_php: number | null;
  cash: CashOption;
  wallets: PaymentWallet[];
  payment: JobPaymentRecord | null;
}

export interface WalletInput {
  type: WalletType;
  provider_name?: string;
  account_name: string;
  account_number: string;
  /** Local file picked with expo-image-picker. */
  qr?: { uri: string; mimeType?: string | null; fileName?: string | null } | null;
  remove_qr?: boolean;
  is_preferred?: boolean;
}

/** True when the server doesn't have the payment-method endpoints yet (older deployment). */
export function isPaymentApiMissing(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404 && !String(error.response?.data?.message ?? '').includes('No query results');
}

export async function fetchPaymentMethods(): Promise<PaymentMethodsSummary> {
  const { data } = await api.get('/payment-methods');
  return data.data;
}

function walletFormData(input: WalletInput): FormData {
  const form = new FormData();
  form.append('type', input.type);
  if (input.type === 'OTHER' && input.provider_name) {
    form.append('provider_name', input.provider_name);
  }
  form.append('account_name', input.account_name);
  form.append('account_number', input.account_number);
  if (input.is_preferred != null) {
    form.append('is_preferred', input.is_preferred ? '1' : '0');
  }
  if (input.remove_qr) {
    form.append('remove_qr', '1');
  }
  if (input.qr?.uri) {
    const mime = input.qr.mimeType || guessMime(input.qr.uri);
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    form.append('qr', {
      uri: input.qr.uri,
      name: input.qr.fileName || `qr.${ext}`,
      type: mime,
    } as unknown as Blob);
  }
  return form;
}

function guessMime(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export async function createWallet(input: WalletInput): Promise<PaymentMethodsSummary> {
  const { data } = await api.post('/payment-methods', walletFormData(input), { timeout: 60000 });
  return data.data;
}

export async function updateWallet(id: number, input: WalletInput): Promise<PaymentMethodsSummary> {
  // POST (not PUT): multipart PUT is unreliable from React Native; the server accepts both.
  const { data } = await api.post(`/payment-methods/${id}`, walletFormData(input), { timeout: 60000 });
  return data.data;
}

export async function deleteWallet(id: number): Promise<PaymentMethodsSummary> {
  const { data } = await api.delete(`/payment-methods/${id}`);
  return data.data;
}

/** null = cash is preferred. */
export async function setPreferredPaymentMethod(paymentMethodId: number | null): Promise<PaymentMethodsSummary> {
  const { data } = await api.post('/payment-methods/preferred', { payment_method_id: paymentMethodId });
  return data.data;
}

/** Owner only: the assigned mechanic's cash/wallet details for paying them. */
export async function fetchMechanicPaymentInfo(helpRequestId: number): Promise<MechanicPaymentInfo> {
  const { data } = await api.get(`/help-requests/${helpRequestId}/mechanic-payment-methods`);
  return data.data;
}

export type RecordPaymentInput = { payment_method: string; payment_method_id?: number | null };

/** Owner marks that they paid the mechanic (records the method; no money moves). */
export async function ownerRecordPayment(helpRequestId: number, input: RecordPaymentInput): Promise<HelpRequest> {
  const { data } = await api.post(`/help-requests/${helpRequestId}/payment`, input);
  return data.data.help_request;
}

/** Mechanic marks that they received payment. */
export async function mechanicRecordPayment(helpRequestId: number, input: RecordPaymentInput): Promise<HelpRequest> {
  const { data } = await api.post(`/mechanic/help-requests/${helpRequestId}/payment`, input);
  return data.data.help_request;
}
