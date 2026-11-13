import type { HelpRequest } from '../api/helpRequests';
import type { JobPaymentRecord, PaymentType, WalletType } from '../api/paymentMethods';

export const WALLET_TYPES: Array<{ value: WalletType; label: string; icon: string; numberLabel: string; numberPlaceholder: string }> = [
  { value: 'GCASH', label: 'GCash', icon: '🔵', numberLabel: 'GCash mobile number', numberPlaceholder: '0917 123 4567' },
  { value: 'MAYA', label: 'Maya', icon: '🟢', numberLabel: 'Maya mobile number', numberPlaceholder: '0917 123 4567' },
  { value: 'OTHER', label: 'Other', icon: '👛', numberLabel: 'Account number', numberPlaceholder: 'Account or mobile number' },
];

export function paymentIcon(type: PaymentType | string | null | undefined): string {
  switch ((type ?? '').toUpperCase()) {
    case 'CASH':
      return '💵';
    case 'GCASH':
      return '🔵';
    case 'MAYA':
      return '🟢';
    default:
      return '👛';
  }
}

export function isMobileWallet(type: WalletType): boolean {
  return type === 'GCASH' || type === 'MAYA';
}

/** Mirrors the server: 09XXXXXXXXX, 9XXXXXXXXX, 639XXXXXXXXX or +639XXXXXXXXX → 09XXXXXXXXX. */
export function normalizeMobile(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (/^09\d{9}$/.test(digits)) return digits;
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^9\d{9}$/.test(digits)) return `0${digits}`;
  return null;
}

/** Formats while typing: 0917 123 4567. */
export function formatMobileInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

export type WalletFormValues = {
  type: WalletType | null;
  providerName: string;
  accountName: string;
  accountNumber: string;
};

export type WalletFormErrors = Partial<Record<'type' | 'providerName' | 'accountName' | 'accountNumber' | 'qr', string>>;

export function walletFormErrors(v: WalletFormValues): WalletFormErrors {
  const errors: WalletFormErrors = {};
  if (!v.type) {
    errors.type = 'Choose a wallet: GCash, Maya or Other.';
  }
  if (v.type === 'OTHER' && v.providerName.trim().length < 2) {
    errors.providerName = 'Enter the wallet or bank name, e.g. ShopeePay.';
  }
  if (v.accountName.trim().length < 2) {
    errors.accountName = 'Enter the account name exactly as it appears in the app.';
  }
  if (!v.accountNumber.trim()) {
    errors.accountNumber = 'Enter the account or mobile number.';
  } else if (v.type && isMobileWallet(v.type) && !normalizeMobile(v.accountNumber)) {
    errors.accountNumber = `Enter the 11-digit mobile number linked to your ${v.type === 'GCASH' ? 'GCash' : 'Maya'}, e.g. 0917 123 4567.`;
  } else if (v.type === 'OTHER' && !/^[A-Za-z0-9][A-Za-z0-9 -]{2,32}[A-Za-z0-9]$/.test(v.accountNumber.trim())) {
    errors.accountNumber = 'Use letters and numbers only (4–34 characters).';
  }
  return errors;
}

/** "Cash" / "GCash" etc. from a help request's owner plan (null on older servers). */
export function ownerPaymentPlanLabel(request: Pick<HelpRequest, 'payment_preference'>): string | null {
  const p = request.payment_preference;
  if (!p?.type) return null;
  return p.label || (p.type === 'CASH' ? 'Cash' : p.type);
}

export function paymentRecordLine(payment: JobPaymentRecord | null | undefined): string | null {
  if (!payment) return null;
  if (!payment.is_paid) return null;
  const label = payment.method_label || payment.method || 'Recorded';
  const masked = payment.details?.account_number_masked;
  return masked ? `Paid with ${label} · ${masked}` : `Paid with ${label}`;
}

export function formatPeso(amount: number | null | undefined): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  return `₱${Math.round(amount).toLocaleString('en-PH')}`;
}
