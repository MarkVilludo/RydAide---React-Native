import type { MechanicSubscriptionDetails } from '../api/mechanicSubscription';

/** Website / CMS defaults from /pricing when the API has not been deployed yet. */
export const MECHANIC_PRO_MONTHLY_PRICE_PHP = 299;
export const MECHANIC_PRO_YEARLY_PRICE_PHP = 2999;

export function isMechanicProPlanCode(code: string | undefined | null): boolean {
  return code === 'MECHANIC_PRO' || code === 'MECHANIC_PRO_YEARLY';
}

export function billingIntervalLabel(dashboard: MechanicSubscriptionDetails | null | undefined): string {
  const interval = dashboard?.billing_interval?.toLowerCase();
  if (interval === 'year') return '/year';
  return '/month';
}

export function formatPhpAmount(amount: number): string {
  return `₱${Math.round(amount).toLocaleString('en-US')}`;
}

/** Prefer store localized label; otherwise format CMS ₱ amount. */
export function resolvePriceLabel(storeDisplay: string | null | undefined, cmsAmount: number | null | undefined): string | null {
  const fromStore = storeDisplay?.trim();
  if (fromStore) return fromStore;
  if (cmsAmount != null && cmsAmount > 0) return formatPhpAmount(cmsAmount);
  return null;
}

export function yearlySavingsVsMonthly(
  monthly: number | null | undefined,
  yearly: number | null | undefined,
): { percent: number; amount: number } | null {
  if (monthly == null || yearly == null || monthly <= 0 || yearly <= 0) return null;
  const full = monthly * 12;
  if (full <= yearly) return null;
  const amount = full - yearly;
  const percent = Math.round((amount / full) * 100);
  return percent > 0 ? { percent, amount } : null;
}

export function formatProPriceLine(
  dashboard: MechanicSubscriptionDetails | null | undefined,
  proMonthlyPrice: number,
  proYearlyPrice?: number,
  storeLabels?: { monthly?: string | null; yearly?: string | null },
): string {
  if (dashboard && isMechanicProPlanCode(dashboard.plan_code)) {
    const iv = dashboard.billing_interval?.toLowerCase();
    const amt = dashboard.amount_php;
    if (iv === 'year') {
      return `${formatPhpAmount(amt)}/year`;
    }
    return `${formatPhpAmount(amt)}/month`;
  }
  const monthly = resolvePriceLabel(storeLabels?.monthly, proMonthlyPrice) ?? formatPhpAmount(proMonthlyPrice);
  const yearly = resolvePriceLabel(storeLabels?.yearly, proYearlyPrice);
  if (yearly) {
    return `From ${monthly}/mo or ${yearly}/yr`;
  }
  return `${monthly}/month`;
}
