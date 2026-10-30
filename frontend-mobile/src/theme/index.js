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
  info: '#3355CC',
  infoSoft: '#E9EDFB',
  warning: '#A8790F',
  warningSoft: '#F7EFDA',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  teal: '#0D9488',
  tealSoft: '#F0FDFA',
  amber: '#D97706',
  amberSoft: '#FEF3C7',
  slate: '#475569',
  slateSoft: '#F1F5F9',
  purple: '#7C3AED',
  purpleSoft: '#F5F3FF',

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

export function getParcelStatusColor(status, isLost = false) {
  if (isLost) return colors.danger;
  switch (status) {
    case 'Completed':
    case 'Delivered / Completed':
    case 'COMPLETED':
      return colors.success;
    case 'Loaded to Hauler':
    case 'LOADED_TO_HAULER':
      return colors.purple;
    case 'Arrived at TNL':
    case 'Arrived at TNL Hub':
    case 'Outload / Arrive TNL':
    case 'Arrived in Daet':
    case 'ARRIVED_AT_TNL':
      return colors.teal;
    case 'Loaded on Truck':
    case 'LOADED_ON_TRUCK':
      return colors.amber;
    case 'QR Generated':
    case 'QR_GENERATED':
      return colors.info;
    case 'Registered':
    case 'REGISTERED':
    default:
      return colors.slate;
  }
}

export function formatParcelStatusDisplay(status) {
  return ['Arrived at TNL', 'Arrived at TNL Hub', 'Outload / Arrive TNL', 'ARRIVED_AT_TNL'].includes(status)
    ? 'Arrived in Daet'
    : status;
}

export function getParcelStatusBadgeStyle(status) {
  const foreground = getParcelStatusColor(status);
  const palette = {
    [colors.slate]: { backgroundColor: colors.slateSoft, borderColor: '#CBD5E1' },
    [colors.info]: { backgroundColor: colors.infoSoft, borderColor: '#BFDBFE' },
    [colors.amber]: { backgroundColor: colors.amberSoft, borderColor: '#FDE68A' },
    [colors.teal]: { backgroundColor: colors.tealSoft, borderColor: '#99F6E4' },
    [colors.purple]: { backgroundColor: colors.purpleSoft, borderColor: '#DDD6FE' },
    [colors.success]: { backgroundColor: colors.successSoft, borderColor: '#B8E2C8' },
  };
  return { color: foreground, ...palette[foreground] };
}

