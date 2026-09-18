// Design tokens for TNL Logistics Mobile App
// Off-white canvas, sharp ink typography, burnt orange accents, and hairline borders.

export const colors = {
  canvas: '#F3F2ED',       // warm page background
  surface: '#FFFFFF',      // cards and panels
  ink: '#1A1A1A',          // primary text
  inkSoft: '#4A4A46',      // secondary text
  inkFaint: '#8A897F',     // tertiary / labels / meta
  border: '#E1DFD5',       // hairline borders
  borderStrong: '#111111', // bold card/frame borders

  accent: '#C6491F',       // primary action / alert orange (burnt orange)
  accentSoft: '#FFF5F0',   // tinted orange background for notice banners

  success: '#2E7D46',
  successSoft: '#E7F3EA',
  warning: '#A8790F',
  warningSoft: '#F7EFDA',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',

  keypadBg: '#FFFFFF',
  keypadBorder: '#E0E0E0',
  pinDotEmpty: '#D9D8D3',
  pinDotFilled: '#111111',

  black: '#111111',
};

export const typography = {
  h1: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.inkFaint,
    fontWeight: '700',
  },
  body: {
    fontSize: 14,
    color: colors.inkSoft,
    lineHeight: 20,
  },
  bodySmall: {
    fontSize: 12,
    color: colors.inkFaint,
    lineHeight: 16,
  },
  mono: {
    fontSize: 12,
    color: colors.inkFaint,
    fontFamily: 'monospace',
  },
  metric: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  pill: 999,
};
