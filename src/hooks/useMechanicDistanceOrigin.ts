import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { showAppToast } from '../components/AppToast';
import { SERVICE_PIN_USING_GPS_FALLBACK_TOAST } from '../constants/servicePinMessages';
import { useMechanicLiveLocation } from '../context/useMechanicLiveLocation';
import {
  DEFAULT_SERVICE_PIN_MAX_OFFSET_KM,
  DEFAULT_SERVICE_PIN_MAX_OFFSET_METERS,
  isServicePinNearGps,
  maxOffsetKmFromMeters,
} from '../utils/servicePinGuard';
import { useAppConfig } from './useAppConfig';

export type DistanceOrigin = { latitude: number; longitude: number };

export type MechanicDistanceMode = 'service_pin' | 'live';

export function useServicePinMaxOffsetMeters(): number {
  const { config } = useAppConfig();
  return config?.service_pin?.max_offset_meters ?? DEFAULT_SERVICE_PIN_MAX_OFFSET_METERS;
}

export function useServicePinMaxOffsetKm(): number {
  const meters = useServicePinMaxOffsetMeters();
  const { config } = useAppConfig();
  if (config?.service_pin?.max_offset_km != null) {
    return config.service_pin.max_offset_km;
  }
  return maxOffsetKmFromMeters(meters);
}

export function useMechanicDistanceOrigin(mode: MechanicDistanceMode = 'service_pin'): {
  origin: DistanceOrigin | null;
  permissionDenied: boolean;
  servicePin: DistanceOrigin | null;
  servicePinManual: boolean;
  reloadServicePin: () => Promise<void>;
  usingGpsBecausePinTooFar: boolean;
} {
  const { coords, permissionDenied, servicePin, servicePinManual, reloadServicePin } =
    useMechanicLiveLocation();
  const maxOffsetKm = useServicePinMaxOffsetKm();
  const pinFarWarned = useRef(false);

  useFocusEffect(
    useCallback(() => {
      void reloadServicePin();
    }, [reloadServicePin]),
  );

  const pinTooFarFromGps = useMemo(() => {
    if (!servicePinManual || !servicePin || !coords) {
      return false;
    }
    return !isServicePinNearGps(servicePin, coords, maxOffsetKm);
  }, [servicePinManual, servicePin, coords, maxOffsetKm]);

  const origin = useMemo(() => {
    if (mode === 'live') {
      return coords ?? servicePin;
    }
    if (pinTooFarFromGps && coords) {
      return coords;
    }
    return servicePin ?? coords;
  }, [mode, coords, servicePin, pinTooFarFromGps]);

  useEffect(() => {
    if (mode !== 'service_pin' || !pinTooFarFromGps || !coords) {
      pinFarWarned.current = false;
      return;
    }
    if (pinFarWarned.current) {
      return;
    }
    pinFarWarned.current = true;
    showAppToast(SERVICE_PIN_USING_GPS_FALLBACK_TOAST);
  }, [mode, pinTooFarFromGps, coords]);

  return {
    origin,
    permissionDenied,
    servicePin,
    servicePinManual,
    reloadServicePin,
    usingGpsBecausePinTooFar: pinTooFarFromGps && mode === 'service_pin',
  };
}

/** Coords to send to queue API — defers to saved service pin when the mechanic pinned manually. */
export function mechanicQueueFetchCoords(input: {
  servicePin: DistanceOrigin | null;
  servicePinManual: boolean;
  coords: DistanceOrigin | null;
  maxOffsetKm?: number;
}): DistanceOrigin | undefined {
  const maxKm = input.maxOffsetKm ?? DEFAULT_SERVICE_PIN_MAX_OFFSET_KM;

  if (input.coords) {
    if (input.servicePinManual && input.servicePin) {
      if (isServicePinNearGps(input.servicePin, input.coords, maxKm)) {
        return input.servicePin;
      }
      return input.coords;
    }
    if (!input.servicePinManual) {
      return input.coords;
    }
  }

  return input.servicePin ?? input.coords ?? undefined;
}
