import { DEFAULT_SERVICE_PIN_MAX_OFFSET_METERS } from '../utils/servicePinGuard';

/** Short rule shown on dashboard / service location screens. */
export function servicePinManualSaveHint(maxMeters: number = DEFAULT_SERVICE_PIN_MAX_OFFSET_METERS): string {
  return `Pin must be within ${maxMeters} m of your current location. This is a small map correction—not a way to place yourself anywhere.`;
}

export function servicePinTooFarToast(maxMeters: number = DEFAULT_SERVICE_PIN_MAX_OFFSET_METERS): string {
  return `Keep your service pin within ${maxMeters} m of your current GPS. Moving it farther isn’t allowed—it can mislead customers.`;
}

export function servicePinTooFarAlertBody(maxMeters: number = DEFAULT_SERVICE_PIN_MAX_OFFSET_METERS): string {
  return `You can adjust your pin manually, but only within ${maxMeters} meters of where you actually are (your current GPS). Saving a pin farther away isn’t allowed, because it gives customers the wrong idea of how near you are.`;
}

/** @deprecated use servicePinTooFarToast() */
export const SERVICE_PIN_TOO_FAR_TOAST = servicePinTooFarToast();

export const SERVICE_PIN_TOO_FAR_ALERT_TITLE = 'Pin too far from you';

/** @deprecated use servicePinTooFarAlertBody() */
export const SERVICE_PIN_TOO_FAR_ALERT_BODY = servicePinTooFarAlertBody();

export const SERVICE_PIN_GPS_REQUIRED =
  'Turn on location access so we can verify your pin is near your current position.';

export const SERVICE_PIN_USING_GPS_FALLBACK_TOAST =
  'Your saved pin looks far from your current location. Showing distance from your GPS instead.';
