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
  teal: '#0D9488',
  tealSoft: '#F0FDFA',
  amber: '#D97706',
  amberSoft: '#FEF3C7',
  slate: '#475569',
  slateSoft: '#F1F5F9',
  purple: '#7C3AED',
  purpleSoft: '#F5F3FF',

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
  // Phase 1: Receiving Staff Custody (Intake & Labeling)
  Registered: { fg: colors.slate, bg: colors.slateSoft, border: '#CBD5E1', dot: '#64748B', outline: true },
  REGISTERED: { fg: colors.slate, bg: colors.slateSoft, border: '#CBD5E1', dot: '#64748B', outline: true },
  'QR Generated': { fg: colors.info, bg: colors.infoSoft, border: '#BFDBFE', dot: colors.info, outline: true },
  QR_GENERATED: { fg: colors.info, bg: colors.infoSoft, border: '#BFDBFE', dot: colors.info, outline: true },

  // Phase 2: Courier Staff Custody (First-Mile Pickup & Hub Consolidation)
  'Loaded on Truck': { fg: colors.amber, bg: colors.amberSoft, border: '#FDE68A', dot: colors.amber, outline: true },
  LOADED_ON_TRUCK: { fg: colors.amber, bg: colors.amberSoft, border: '#FDE68A', dot: colors.amber, outline: true },
  'Arrived at TNL': { fg: colors.teal, bg: colors.tealSoft, border: '#99F6E4', dot: colors.teal, outline: true },
  'Arrived in Daet': { fg: colors.teal, bg: colors.tealSoft, border: '#99F6E4', dot: colors.teal, outline: true },
  ARRIVED_AT_TNL: { fg: colors.teal, bg: colors.tealSoft, border: '#99F6E4', dot: colors.teal, outline: true },

  // Phase 3: Dispatch Staff Custody (Carrier Linehaul & Final Delivery)
  'Loaded to Hauler': { fg: colors.purple, bg: colors.purpleSoft, border: '#DDD6FE', dot: colors.purple, outline: true },
  LOADED_TO_HAULER: { fg: colors.purple, bg: colors.purpleSoft, border: '#DDD6FE', dot: colors.purple, outline: true },
  Completed: { fg: colors.success, bg: colors.successSoft, border: '#B8E2C8', dot: colors.success, outline: true },
  COMPLETED: { fg: colors.success, bg: colors.successSoft, border: '#B8E2C8', dot: colors.success, outline: true },
  'Delivered / Completed': { fg: colors.success, bg: colors.successSoft, border: '#B8E2C8', dot: colors.success, outline: true },

  // Exceptions & Entity States
  Lost: { fg: colors.danger, bg: colors.dangerSoft, border: colors.danger, dot: colors.danger },
  LOST: { fg: colors.danger, bg: colors.dangerSoft, border: colors.danger, dot: colors.danger },
  'With Loss': { fg: colors.danger, bg: colors.dangerSoft, border: colors.danger, dot: colors.danger },
  Active: { fg: colors.success, bg: colors.successSoft, border: '#B8E2C8', dot: colors.success },
  'In Maintenance': { fg: '#9A6700', bg: '#FFF8E7', border: '#F2D399', dot: '#B57B00' },
  Inactive: { fg: colors.inkFaint, bg: colors.canvas, border: colors.border, dot: colors.inkFaint },
};

export const paymentStyles = {
  Paid: { fg: colors.success, bg: colors.successSoft, border: '#B8E2C8', dot: colors.success },
  PAID: { fg: colors.success, bg: colors.successSoft, border: '#B8E2C8', dot: colors.success },
  Settled: { fg: colors.success, bg: colors.successSoft, border: '#B8E2C8', dot: colors.success },
  SETTLED: { fg: colors.success, bg: colors.successSoft, border: '#B8E2C8', dot: colors.success },
  Unpaid: { fg: colors.amber, bg: colors.amberSoft, border: '#FDE68A', dot: colors.amber },
  UNPAID: { fg: colors.amber, bg: colors.amberSoft, border: '#FDE68A', dot: colors.amber },
  'For Collection': { fg: colors.amber, bg: colors.amberSoft, border: '#FDE68A', dot: colors.amber },
  FOR_COLLECTION: { fg: colors.amber, bg: colors.amberSoft, border: '#FDE68A', dot: colors.amber },
  Partial: { fg: colors.amber, bg: colors.amberSoft, border: '#FDE68A', dot: colors.amber },
  PARTIAL: { fg: colors.amber, bg: colors.amberSoft, border: '#FDE68A', dot: colors.amber },
  PARTIALLY_PAID: { fg: colors.amber, bg: colors.amberSoft, border: '#FDE68A', dot: colors.amber },
};

export const collectionStyles = {
  READY_FOR_SOA: { fg: colors.info, bg: colors.infoSoft, border: '#BFDBFE', dot: colors.info, label: 'Ready for SOA' },
  'Ready for SOA': { fg: colors.info, bg: colors.infoSoft, border: '#BFDBFE', dot: colors.info, label: 'Ready for SOA' },
  SOA_GENERATED: { fg: colors.amber, bg: colors.amberSoft, border: '#FDE68A', dot: colors.amber, label: 'SOA Generated' },
  'SOA Generated': { fg: colors.amber, bg: colors.amberSoft, border: '#FDE68A', dot: colors.amber, label: 'SOA Generated' },
  SETTLED: { fg: colors.success, bg: colors.successSoft, border: '#B8E2C8', dot: colors.success, label: 'Settled' },
  Settled: { fg: colors.success, bg: colors.successSoft, border: '#B8E2C8', dot: colors.success, label: 'Settled' },
};

export const labelStyles = {
  Printed: { fg: colors.success, bg: colors.successSoft, border: '#B8E2C8', dot: colors.success },
  PRINTED: { fg: colors.success, bg: colors.successSoft, border: '#B8E2C8', dot: colors.success },
  Reprinted: { fg: colors.success, bg: colors.successSoft, border: '#B8E2C8', dot: colors.success },
  REPRINTED: { fg: colors.success, bg: colors.successSoft, border: '#B8E2C8', dot: colors.success },
  Pending: { fg: colors.inkFaint, bg: colors.canvas, border: colors.border, dot: colors.inkFaint },
  PENDING: { fg: colors.inkFaint, bg: colors.canvas, border: colors.border, dot: colors.inkFaint },
  'Not Printed': { fg: colors.inkFaint, bg: colors.canvas, border: colors.border, dot: colors.inkFaint },
  NOT_PRINTED: { fg: colors.inkFaint, bg: colors.canvas, border: colors.border, dot: colors.inkFaint },
  'Label: Printed': { fg: colors.success, bg: colors.successSoft, border: '#B8E2C8', dot: colors.success },
  'Label: Pending': { fg: colors.inkFaint, bg: colors.canvas, border: colors.border, dot: colors.inkFaint },
};

export const waybillStyles = {
  'Signed / Completed': { fg: colors.success, bg: colors.successSoft, border: '#B8E2C8', dot: colors.success },
  'Waybill: Signed / Completed': { fg: colors.success, bg: colors.successSoft, border: '#B8E2C8', dot: colors.success },
  SIGNED_COMPLETED: { fg: colors.success, bg: colors.successSoft, border: '#B8E2C8', dot: colors.success },
  'Closed with Loss': { fg: colors.danger, bg: colors.dangerSoft, border: colors.danger, dot: colors.danger },
  'Waybill: Closed with Loss': { fg: colors.danger, bg: colors.dangerSoft, border: colors.danger, dot: colors.danger },
  'Closed as All Lost': { fg: colors.danger, bg: colors.dangerSoft, border: colors.danger, dot: colors.danger },
  'Waybill: Closed as All Lost': { fg: colors.danger, bg: colors.dangerSoft, border: colors.danger, dot: colors.danger },
  'Sent to Hauler': { fg: colors.purple, bg: colors.purpleSoft, border: '#DDD6FE', dot: colors.purple },
  'Waybill: Sent to Hauler': { fg: colors.purple, bg: colors.purpleSoft, border: '#DDD6FE', dot: colors.purple },
  SENT_TO_HAULER: { fg: colors.purple, bg: colors.purpleSoft, border: '#DDD6FE', dot: colors.purple },
  Generated: { fg: colors.info, bg: colors.infoSoft, border: '#BFDBFE', dot: colors.info },
  'Waybill: Generated': { fg: colors.info, bg: colors.infoSoft, border: '#BFDBFE', dot: colors.info },
  GENERATED: { fg: colors.info, bg: colors.infoSoft, border: '#BFDBFE', dot: colors.info },
  'Not Generated': { fg: colors.inkFaint, bg: colors.canvas, border: colors.border },
  'Waybill: Not Generated': { fg: colors.inkFaint, bg: colors.canvas, border: colors.border },
  NOT_GENERATED: { fg: colors.inkFaint, bg: colors.canvas, border: colors.border },
};
