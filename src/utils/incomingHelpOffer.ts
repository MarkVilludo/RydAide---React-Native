import { getApiErrorMessage } from '../api/client';
import type { HelpRequest } from '../api/helpRequests';

export type IncomingOfferUnavailable = 'taken' | 'ended';

export function acceptLostRaceKind(error: unknown): IncomingOfferUnavailable | null {
  const msg = getApiErrorMessage(error).toLowerCase();
  if (msg.includes('already been accepted') || msg.includes('another mechanic')) {
    return 'taken';
  }
  if (msg.includes('expired')) {
    return 'ended';
  }
  if (msg.includes('no longer available')) {
    return 'taken';
  }
  return null;
}

type UnavailableOptions = {
  /** When false, cancelled/expired requests still show normal history detail. */
  includeEnded?: boolean;
};

export function incomingOfferUnavailableReason(
  request: HelpRequest,
  options: UnavailableOptions = {},
): IncomingOfferUnavailable | null {
  const { includeEnded = true } = options;

  if (request.status === 'SEARCHING') {
    return null;
  }
  if (request.job) {
    return null;
  }
  if (request.mechanic_dispatch?.response === 'declined') {
    return null;
  }
  if (request.mechanic_dispatch?.response === 'accepted') {
    return null;
  }
  if (['CANCELLED', 'EXPIRED', 'NO_MECHANIC_FOUND'].includes(request.status)) {
    return includeEnded ? 'ended' : null;
  }
  return 'taken';
}

export function incomingOfferUnavailableTitle(kind: IncomingOfferUnavailable): string {
  if (kind === 'taken') {
    return 'Another mechanic took this one';
  }
  return 'This offer is no longer available';
}

export function incomingOfferUnavailableBody(kind: IncomingOfferUnavailable): string {
  if (kind === 'taken') {
    return 'Someone else accepted just before you. Stay online — the next nearby offer will show up here.';
  }
  return 'The owner cancelled or the search ended. Check Incoming for new offers.';
}
