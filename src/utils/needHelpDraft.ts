import type { HelpRequest } from '../api/helpRequests';
import type { OwnerStackParamList } from '../navigation/types';
import { resolveMediaUrl } from './resolveMediaUrl';
import { vehicleTitle } from './helpRequestUi';

export type NeedHelpParams = OwnerStackParamList['NeedHelp'];

function splitAddressText(addressText: string | null | undefined): {
  landmark: string;
  address: string;
} {
  const raw = addressText?.trim() ?? '';
  if (!raw) {
    return { landmark: '', address: '' };
  }
  const sep = ' · ';
  if (!raw.includes(sep)) {
    return { landmark: '', address: raw };
  }
  const [first, ...rest] = raw.split(sep);
  return { landmark: first?.trim() ?? '', address: rest.join(sep).trim() };
}

/** Build Need Help wizard params from a terminal help request (retry after no match). */
export function needHelpParamsFromHelpRequest(request: HelpRequest): NeedHelpParams {
  const { landmark, address } = splitAddressText(request.address_text);
  const vehicleLine = request.vehicle_description?.trim() || vehicleTitle(request);

  return {
    emergency: request.request_type === 'EMERGENCY',
    latitude: request.latitude,
    longitude: request.longitude,
    vehicleDescription: vehicleLine,
    problemCategoryId: request.problem_category?.id,
    remarks: request.remarks,
    landmark,
    addressText: address,
    answers: request.answers?.map((a) => ({
      question_id: a.question_id,
      answer: a.answer,
    })),
    photoUris:
      request.media
        ?.filter((m) => m.media_type === 'photo' && m.url)
        .map((m) => resolveMediaUrl(m.url))
        .filter((uri) => uri.length > 0) ?? [],
    fromFailedMatch: true,
  };
}

export function needHelpInitialStep(params: NeedHelpParams | undefined): 'vehicle' | 'problem' | 'location' | 'review' {
  if (!params?.fromFailedMatch) {
    return 'vehicle';
  }
  const emergency = params.emergency ?? true;
  const remarksMin = emergency ? 2 : 10;
  const vehicleOk = (params.vehicleDescription?.trim().length ?? 0) >= 2;
  const remarksLen = params.remarks?.trim().length ?? 0;
  const problemOk = params.problemCategoryId != null && remarksLen >= remarksMin;
  const locationOk = params.latitude != null && params.longitude != null;
  return vehicleOk && problemOk && locationOk ? 'review' : 'vehicle';
}
