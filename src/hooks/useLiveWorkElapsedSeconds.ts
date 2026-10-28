import { useEffect, useMemo, useRef, useState } from 'react';
import type { ServiceJob } from '../api/helpRequests';
import { resolveJobWorkDurationSeconds } from '../utils/jobWorkDuration';

type JobSlice = Pick<
  ServiceJob,
  'started_at' | 'completed_at' | 'work_duration_seconds' | 'work_elapsed_seconds' | 'status'
>;

/**
 * Single elapsed counter for owner + mechanic: server `work_elapsed_seconds` on each fetch,
 * ticked locally every second between polls (same `started_at` when server field absent).
 */
export function useLiveWorkElapsedSeconds(
  job: JobSlice | null | undefined,
  jobStatus?: string | null,
): number | null {
  const effectiveStatus = jobStatus ?? job?.status;
  const inProgress =
    effectiveStatus === 'IN_PROGRESS' && !!job?.started_at && !job?.completed_at;

  const [nowMs, setNowMs] = useState(() => Date.now());
  const syncRef = useRef({ base: 0, at: Date.now() });

  useEffect(() => {
    if (job?.work_elapsed_seconds != null && inProgress) {
      syncRef.current = {
        base: job.work_elapsed_seconds,
        at: Date.now(),
      };
    }
  }, [job?.work_elapsed_seconds, job?.started_at, inProgress]);

  useEffect(() => {
    if (!inProgress) {
      return;
    }
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [inProgress, job?.started_at]);

  return useMemo(() => {
    if (!job) {
      return null;
    }
    if (!inProgress) {
      return resolveJobWorkDurationSeconds(job, nowMs);
    }
    if (job.work_elapsed_seconds != null) {
      const { base, at } = syncRef.current;
      return Math.max(0, base + Math.floor((nowMs - at) / 1000));
    }
    return resolveJobWorkDurationSeconds(job, nowMs);
  }, [job, inProgress, nowMs]);
}
