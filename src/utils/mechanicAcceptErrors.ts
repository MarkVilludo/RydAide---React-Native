import { AxiosError } from 'axios';
import { getApiErrorMessage } from '../api/client';
import { isSubscriptionRequiredError } from '../api/mechanicSubscription';
import { acceptLostRaceKind, type IncomingOfferUnavailable } from './incomingHelpOffer';

export function subscriptionRequiredMessage(error: unknown): string | null {
  if (!isSubscriptionRequiredError(error)) {
    return null;
  }
  const data = (error as AxiosError<{ message?: string }>).response?.data;
  return data?.message ?? 'Subscribe to Mechanic Pro to accept more HELP requests.';
}

export type AcceptErrorOutcome =
  | { kind: 'subscription'; message: string }
  | { kind: 'unavailable'; reason: IncomingOfferUnavailable }
  | { kind: 'blocked'; title: string; message: string; action?: 'listing' | 'go_online' }
  | { kind: 'other'; title: string; message: string };

/**
 * Turns an accept failure into mechanic-friendly copy.
 * Server messages come from AcceptHelpRequestAction (Laravel); match loosely so wording tweaks don't break it.
 */
export function classifyAcceptError(error: unknown): AcceptErrorOutcome {
  const subMsg = subscriptionRequiredMessage(error);
  if (subMsg) {
    return { kind: 'subscription', message: subMsg };
  }
  const lost = acceptLostRaceKind(error);
  if (lost) {
    return { kind: 'unavailable', reason: lost };
  }
  const raw = getApiErrorMessage(error);
  const msg = raw.toLowerCase();
  if (msg.includes('not eligible')) {
    // The offer to this mechanic was withdrawn (search moved on, or they went offline).
    return { kind: 'unavailable', reason: 'ended' };
  }
  if (msg.includes('only verified')) {
    return {
      kind: 'blocked',
      title: 'Listing not approved yet',
      message: 'You can accept requests once your listing is approved.',
      action: 'listing',
    };
  }
  if (msg.includes('go online')) {
    return {
      kind: 'blocked',
      title: 'You’re offline',
      message: 'Go online from your dashboard, then try again.',
      action: 'go_online',
    };
  }
  return { kind: 'other', title: 'Couldn’t accept this request', message: raw };
}
