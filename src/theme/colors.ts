/** Shared RydAid mobile palette — keep screens on these tokens. */
export const colors = {
  /** App page / SafeArea background */
  bg: '#f8fafc',
  surface: '#ffffff',
  surfaceMuted: '#f1f5f9',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  mutedSoft: '#94a3b8',
  /** Brand primary (CTAs, links, focus) */
  primary: '#0284c7',
  primarySoft: '#f0f9ff',
  primaryBorder: '#bae6fd',
  primaryInk: '#0369a1',
  primaryBright: '#38bdf8',
  onPrimary: '#ffffff',
  live: '#16a34a',
  liveBright: '#22c55e',
  liveSoft: '#f0fdf4',
  liveBorder: '#86efac',
  liveInk: '#166534',
  busy: '#f59e0b',
  busySoft: '#fff7ed',
  busyBorder: '#fdba74',
  warnSoft: '#fffbeb',
  warnBorder: '#fde68a',
  warnInk: '#92400e',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  dangerBorder: '#fecaca',
  dangerInk: '#991b1b',
  /** Active job / strong ops strip */
  active: '#0f766e',
  activeSoft: '#99f6e4',
} as const;

export type AppColor = (typeof colors)[keyof typeof colors];
