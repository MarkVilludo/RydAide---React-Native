import { AxiosError } from 'axios';
import { isSubscriptionRequiredError } from '../api/mechanicSubscription';

export function subscriptionRequiredMessage(error: unknown): string | null {
  if (!isSubscriptionRequiredError(error)) {
    return null;
  }
  const data = (error as AxiosError<{ message?: string }>).response?.data;
  return data?.message ?? 'Subscribe to Mechanic Pro to accept more HELP requests.';
}
