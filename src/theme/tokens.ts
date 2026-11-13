import type { TextStyle } from 'react-native';
import { colors } from './colors';

/** 4-pt spacing scale. Prefer these over ad-hoc margins/paddings. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** Corner radii: inputs/buttons 12, cards 16, sheets 20, pills full. */
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/** Touch targets: 44 = platform minimum (links, icon buttons); 48 = buttons and inputs. */
export const touch = {
  min: 44,
  control: 48,
  large: 52,
} as const;

/** Type scale. Body text is 15/16; never go below 12 for readable copy. */
export const type = {
  display: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: colors.text },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '800', color: colors.text },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '800', color: colors.text },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400', color: colors.text },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: colors.text },
  label: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: colors.text },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400', color: colors.muted },
  micro: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.muted },
  button: { fontSize: 16, fontWeight: '800' },
} as const satisfies Record<string, TextStyle>;

/** Light card shadow used across surfaces. */
export const elevation = {
  card: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
} as const;

export { colors };
