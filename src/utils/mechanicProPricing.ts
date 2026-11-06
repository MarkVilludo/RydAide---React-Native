import type { MechanicSubscriptionDetails } from '../api/mechanicSubscription';

export function isMechanicProPlanCode(code: string | undefined | null): boolean {
  return code === 'MECHANIC_PRO' || code === 'MECHANIC_PRO_YEARLY';
}

export function billingIntervalLabel(dashboard: MechanicSubscriptionDetails | null | undefined): string {
  const interval = dashboard?.billing_interval?.toLowerCase();
  if (interval === 'year') return '/year';
  return '/month';
}

export function formatProPriceLine(
  dashboard: MechanicSubscriptionDetails | null | undefined,
  proMonthlyPrice: number,
  proYearlyPrice?: number,
): string {
  if (dashboard && isMechanicProPlanCode(dashboard.plan_code)) {
    const iv = dashboard.billing_interval?.toLowerCase();
    const amt = dashboard.amount_php;
    if (iv === 'year') {
      return `₱${amt}/year`;
    }
    return `₱${amt}/month`;
  }
  const y = proYearlyPrice != null && proYearlyPrice > 0;
  if (y) {
    return `From ₱${proMonthlyPrice}/mo or ₱${proYearlyPrice}/yr`;
  }
  return `₱${proMonthlyPrice}/month`;
}
