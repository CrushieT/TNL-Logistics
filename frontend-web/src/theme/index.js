// Design tokens lifted directly from the TNL Logistics prototype.
// Modern operations-console aesthetic: off-white canvas, sharp black ink,
// hairline rules, burnt orange accent, and crisp dual-font typography.

export const colors = {
  canvas: '#F3F2ED',       // page background
  surface: '#FFFFFF',      // cards / panels
  sidebar: '#FFFFFF',
  ink: '#1A1A1A',           // primary text
  inkSoft: '#4A4A46',       // secondary text
  inkFaint: '#8A897F',      // tertiary / labels / meta
  border: '#E1DFD5',        // hairline borders
  borderStrong: '#111111',  // card/frame borders

  accent: '#C6491F',        // primary action / active nav / alerts (burnt orange-red)
  accentSoft: '#F6E7DE',

  success: '#2E7D46',
  successSoft: '#E7F3EA',
  info: '#3355CC',
  infoSoft: '#E9EDFB',
  warning: '#A8790F',
  warningSoft: '#F7EFDA',
  danger: '#C0392B',
  dangerSoft: '#FBEAE8',

  black: '#111111',
};

export const fonts = {
  sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: '"Roboto Mono", "JetBrains Mono", Consolas, "Liberation Mono", Menlo, Courier, monospace',
};

export const type = {
  eyebrow: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.inkFaint,
    fontWeight: '700',
  },
  h1: {
    fontFamily: fonts.sans,
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  label: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.inkFaint,
    fontWeight: '700',
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
    fontWeight: '400',
  },
  bodySmall: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkSoft,
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.ink,
    fontWeight: '600',
  },
  metric: {
    fontFamily: fonts.sans,
    fontSize: 28,
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
  sm: 2,
  md: 4,
  pill: 999,
};

// Status -> pill color mapping used across shipments, tracking, packages
export const statusStyles = {
  Registered: { fg: colors.info, bg: colors.infoSoft, dot: colors.info, outline: true },
  'QR Generated': { fg: colors.info, bg: colors.infoSoft, dot: colors.info, outline: true },
  'Loaded on Truck': { fg: colors.inkSoft, bg: colors.surface, dot: colors.warning, outline: true },
  'Arrived at TNL': { fg: colors.success, bg: colors.successSoft, dot: colors.success, outline: true },
  'Loaded to Hauler': { fg: colors.success, bg: colors.successSoft, dot: colors.success, outline: true },
  Active: { fg: colors.success, bg: colors.successSoft, border: '#B8E2C8', dot: colors.success },
  'In Maintenance': { fg: '#9A6700', bg: '#FFF8E7', border: '#F2D399', dot: '#B57B00' },
  Inactive: { fg: colors.inkFaint, bg: colors.canvas, border: colors.border, dot: colors.inkFaint },
};

export const paymentStyles = {
  Paid: { fg: colors.success, bg: colors.successSoft },
  Unpaid: { fg: colors.danger, bg: colors.dangerSoft },
  Partial: { fg: colors.warning, bg: colors.warningSoft },
};

export const labelStyles = {
  Printed: { fg: colors.success, bg: colors.successSoft, border: '#B8E2C8', dot: colors.success },
  Pending: { fg: colors.inkFaint, bg: colors.canvas, border: colors.border, dot: colors.inkFaint },
  'Label: Printed': { fg: colors.success, bg: colors.successSoft, border: '#B8E2C8', dot: colors.success },
  'Label: Pending': { fg: colors.inkFaint, bg: colors.canvas, border: colors.border, dot: colors.inkFaint },
};

export const waybillStyles = {
  'Signed / Completed': { fg: colors.ink, bg: colors.canvas, border: colors.borderStrong },
  'Waybill: Signed / Completed': { fg: colors.ink, bg: colors.canvas, border: colors.borderStrong },
  'Sent to Hauler': { fg: colors.info, bg: colors.infoSoft, border: colors.info },
  'Waybill: Sent to Hauler': { fg: colors.info, bg: colors.infoSoft, border: colors.info },
  Generated: { fg: colors.warning, bg: colors.warningSoft, border: colors.warning },
  'Waybill: Generated': { fg: colors.warning, bg: colors.warningSoft, border: colors.warning },
  'Not Generated': { fg: colors.inkFaint, bg: colors.canvas, border: colors.border },
  'Waybill: Not Generated': { fg: colors.inkFaint, bg: colors.canvas, border: colors.border },
};
