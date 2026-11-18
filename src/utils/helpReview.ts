import type { HelpRequest } from '../api/helpRequests';
import { isOwnerCompletedHelpRequest } from './helpRequestStatus';

export function ownerNeedsReview(request: HelpRequest): boolean {
  return isOwnerCompletedHelpRequest(request) && !!request.mechanic && !request.review;
}