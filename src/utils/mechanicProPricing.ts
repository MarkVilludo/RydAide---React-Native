import type { MechanicSubscriptionDetails } from '../api/mechanicSubscription';

export function isMechanicProPlanCode(code: string | undefined | null): boolean {
  return code === 'MECHANIC_PRO' || code === 'MECHANIC_PRO_YEARLY';
}

export function billingIntervalLabel(dashboard: MechanicSubscriptionDetails | null | undefined): string {
  const interval = dashboard?.billing_interval?.toLowerCase();
  if (interval === 'year') return '/year';
  return '/month';
}

export function formatPhpAmount(amount: number): string {
  return `₱${amount}`;
}

/** Prefer store localized label; otherwise format CMS ₱ amount. */
export function resolvePriceLabel(storeDisplay: string | null | undefined, cmsAmount: number | null | undefined): string | null {
  const fromStore = storeDisplay?.trim();
  if (fromStore) return fromStore;
  if (cmsAmount != null && cmsAmount > 0) return formatPhpAmount(cmsAmount);
  return null;
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
      return `₱${amt}/year`;
    }
    return `₱${amt}/month`;
  }
  const monthly = resolvePriceLabel(storeLabels?.monthly, proMonthlyPrice) ?? formatPhpAmount(proMonthlyPrice);
  const yearly = resolvePriceLabel(storeLabels?.yearly, proYearlyPrice);
  if (yearly) {
    return `From ${monthly}/mo or ${yearly}/yr`;
  }
  return `${monthly}/month`;
}
