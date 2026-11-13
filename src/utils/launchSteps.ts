import { useSyncExternalStore } from 'react';

/**
 * Cold-start checkpoints the branded loading screen waits for, so the first thing the user
 * sees after it is the finished dashboard — not a half-loaded one or a screen that redirects.
 *
 * - `dashboard`: the role's home screen finished its first data load.
 * - `recovery`: the active-job / notification redirect check finished (and navigated if needed).
 */
export type LaunchStep = 'dashboard' | 'recovery';

let state: Record<LaunchStep, boolean> = { dashboard: false, recovery: false };
const listeners = new Set<() => void>();

export function markLaunchStep(step: LaunchStep): void {
  if (state[step]) return;
  state = { ...state, [step]: true };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): Record<LaunchStep, boolean> {
  return state;
}

export function useLaunchSteps(): Record<LaunchStep, boolean> {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
