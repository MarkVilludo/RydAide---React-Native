import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { HelpRequest } from '../api/helpRequests';
import { jobStatusOf } from '../utils/helpRequestUi';

const TERMINAL = new Set(['COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_MECHANIC_FOUND']);

function isLiveHelpRequest(request: HelpRequest | null): boolean {
  if (!request) return true;
  if (TERMINAL.has(request.status)) return false;
  const job = jobStatusOf(request);
  if (job === 'COMPLETED') return false;
  return true;
}

function pollIntervalMs(request: HelpRequest | null): number {
  const job = request ? jobStatusOf(request) : '';
  if (job === 'IN_PROGRESS') return 1000;
  if (['ACCEPTED', 'ON_THE_WAY', 'ARRIVED'].includes(job) || request?.status === 'ACCEPTED') {
    return 1500;
  }
  if (request?.status === 'SEARCHING') return 2000;
  return 3000;
}

type Options = {
  /** Silent fetch — do not toggle a full-screen loading spinner. */
  refresh: () => Promise<HelpRequest | null | void> | void;
  request: HelpRequest | null;
};

/**
 * While the screen is focused and the request is still live, keep re-fetching so
 * status / quote / GPS changes from the other side show on Request details.
 */
export function useLiveHelpRequestRefresh({ refresh, request }: Options) {
  const requestRef = useRef(request);
  requestRef.current = request;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const tick = async () => {
        if (cancelled) return;
        try {
          await refreshRef.current();
        } catch {
          /* keep polling */
        }
        if (cancelled) return;
        if (!isLiveHelpRequest(requestRef.current)) return;
        timer = setTimeout(() => {
          void tick();
        }, pollIntervalMs(requestRef.current));
      };

      void tick();

      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      };
    }, []),
  );
}
