import React from 'react';
import * as RN from 'react-native';
import type { RefreshControlProps } from 'react-native';

const BRAND_PRIMARY = '#0284c7';
const BRAND_SECONDARY = '#38bdf8';

/** Namespace import so Metro/Hermes always resolves the lazy RN export (avoids missing named binding). */
const RefreshControl = RN.RefreshControl;

type Props = Omit<RefreshControlProps, 'tintColor' | 'colors' | 'title' | 'titleColor'> & {
  /** iOS only — short hint under the spinner */
  title?: string;
};

/**
 * Pull-to-refresh control themed for RydAid (sky blue ring / spinner).
 */
export function RydAidRefreshControl({ title = 'Pull to refresh', ...rest }: Props) {
  return (
    <RefreshControl
      {...rest}
      tintColor={BRAND_PRIMARY}
      title={RN.Platform.OS === 'ios' ? title : undefined}
      titleColor={RN.Platform.OS === 'ios' ? '#64748b' : undefined}
      colors={[BRAND_PRIMARY, BRAND_SECONDARY]}
      progressBackgroundColor="#f8fafc"
    />
  );
}
