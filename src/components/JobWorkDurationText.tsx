import React, { useMemo } from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';
import type { ServiceJob } from '../api/helpRequests';
import { useLiveWorkElapsedSeconds } from '../hooks/useLiveWorkElapsedSeconds';
import { formatJobWorkDuration } from '../utils/jobWorkDuration';

type Props = {
  job: Pick<ServiceJob, 'started_at' | 'completed_at' | 'work_duration_seconds' | 'work_elapsed_seconds' | 'status'> | null | undefined;
  /** Help request operational status (may differ from nested job.status on some payloads). */
  jobStatus?: string | null;
  style?: TextStyle;
  liveStyle?: TextStyle;
  bare?: boolean;
};

export function JobWorkDurationText({ job, jobStatus, style, liveStyle, bare = false }: Props) {
  const effectiveStatus = jobStatus ?? job?.status;
  const inProgress =
    effectiveStatus === 'IN_PROGRESS' && !!job?.started_at && !job?.completed_at;

  const elapsedSeconds = useLiveWorkElapsedSeconds(job, jobStatus);

  const label = useMemo(() => {
    if (elapsedSeconds == null) {
      return null;
    }
    const formatted = formatJobWorkDuration(elapsedSeconds);
    if (bare) {
      return formatted;
    }
    if (inProgress) {
      return `Work in progress · ${formatted}`;
    }
    return `Work time · ${formatted}`;
  }, [elapsedSeconds, bare, inProgress]);

  if (!label) {
    return null;
  }

  return <Text style={[styles.base, style, inProgress && (liveStyle ?? styles.live)]}>{label}</Text>;
}

const styles = StyleSheet.create({
  base: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 6 },
  live: { color: '#b45309' },
});
