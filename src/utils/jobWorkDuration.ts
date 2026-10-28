import type { ServiceJob } from '../api/helpRequests';

export function resolveJobWorkDurationSeconds(
  job: Pick<ServiceJob, 'started_at' | 'completed_at' | 'work_duration_seconds'> | null | undefined,
  nowMs: number = Date.now(),
): number | null {
  if (!job) {
    return null;
  }
  if (job.work_duration_seconds != null && job.completed_at) {
    return job.work_duration_seconds;
  }
  if (!job.started_at) {
    return null;
  }
  const start = Date.parse(job.started_at);
  if (!Number.isFinite(start)) {
    return null;
  }
  const end = job.completed_at ? Date.parse(job.completed_at) : nowMs;
  if (job.completed_at && !Number.isFinite(end)) {
    return null;
  }
  return Math.max(0, Math.floor((end - start) / 1000));
}

export function formatJobWorkDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  if (minutes < 60) {
    return remSec > 0 ? `${minutes}m ${remSec}s` : `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`;
}

export function jobWorkDurationLabel(
  job: Pick<ServiceJob, 'started_at' | 'completed_at' | 'work_duration_seconds'> | null | undefined,
  options?: { live?: boolean; nowMs?: number; bare?: boolean },
): string | null {
  const seconds = resolveJobWorkDurationSeconds(job, options?.nowMs);
  if (seconds == null) {
    return null;
  }
  const formatted = formatJobWorkDuration(seconds);
  if (options?.bare) {
    return formatted;
  }
  if (options?.live) {
    return `Work in progress · ${formatted}`;
  }
  return `Work time · ${formatted}`;
}

export function jobWorkDurationValueOnly(
  job: Pick<ServiceJob, 'started_at' | 'completed_at' | 'work_duration_seconds'> | null | undefined,
): string | null {
  const seconds = resolveJobWorkDurationSeconds(job);
  if (seconds == null) {
    return null;
  }
  return formatJobWorkDuration(seconds);
}
