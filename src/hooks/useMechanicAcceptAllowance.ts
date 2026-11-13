import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { fetchEntitlements } from '../api/auth';
import type { Entitlements } from '../api/types';

export type MechanicAcceptAllowance = {
  /** True only when the server says this mechanic can't accept (free requests used, no Pro). */
  blocked: boolean;
  /** Free accepted-request limit when one applies (null for Pro or when limits are off). */
  limit: number | null;
  loaded: boolean;
};

/**
 * Reads `/entitlements` on focus so offer screens can explain an upgrade *before* the mechanic taps Accept.
 * Mirrors Laravel MechanicRequestLimitService::canAccept via `can_accept_help_requests`.
 */
export function useMechanicAcceptAllowance(): MechanicAcceptAllowance {
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchEntitlements()
        .then((e) => {
          if (alive) setEntitlements(e);
        })
        .catch(() => {
          /* keep last known; the accept call still enforces it server-side */
        });
      return () => {
        alive = false;
      };
    }, []),
  );

  return {
    blocked: entitlements?.can_accept_help_requests === false,
    limit: entitlements?.accepted_requests?.limit ?? entitlements?.max_accepted_requests ?? null,
    loaded: entitlements != null,
  };
}
