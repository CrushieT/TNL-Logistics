export const USER_ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  RECEIVING_STAFF: 'RECEIVING_STAFF',
  COURIER_STAFF: 'COURIER_STAFF',
  DISPATCH_STAFF: 'DISPATCH_STAFF',
});

export const STAFF_ROLE_OPTIONS = Object.freeze([
  { label: 'Receiving Staff', value: USER_ROLES.RECEIVING_STAFF },
  { label: 'Courier Staff', value: USER_ROLES.COURIER_STAFF },
  { label: 'Dispatch Staff', value: USER_ROLES.DISPATCH_STAFF },
]);

export const ROLE_FILTERS = Object.freeze(['ALL', ...Object.values(USER_ROLES)]);

export const ROLE_LABELS = Object.freeze({
  [USER_ROLES.ADMIN]: 'Administrator',
  [USER_ROLES.RECEIVING_STAFF]: 'Receiving Staff',
  [USER_ROLES.COURIER_STAFF]: 'Courier Staff',
  [USER_ROLES.DISPATCH_STAFF]: 'Dispatch Staff',
});

export const PLATFORM_ACCESS = Object.freeze({
  [USER_ROLES.ADMIN]: 'Web administration console',
  [USER_ROLES.RECEIVING_STAFF]: 'Mobile receiving, registration, and printing',
  [USER_ROLES.COURIER_STAFF]: 'Mobile transit scanning and tracking history',
  [USER_ROLES.DISPATCH_STAFF]: 'Mobile dispatch, waybills, and tracking history',
});

export const ROLE_CHIP_COLORS = Object.freeze({
  [USER_ROLES.ADMIN]: { bg: '#EFF6FF', text: '#1D4ED8' },
  [USER_ROLES.RECEIVING_STAFF]: { bg: '#F0FDF4', text: '#15803D' },
  [USER_ROLES.COURIER_STAFF]: { bg: '#FFF7ED', text: '#C2410C' },
  [USER_ROLES.DISPATCH_STAFF]: { bg: '#FFF7ED', text: '#C2410C' },
});

export function isSupportedUserRole(role) {
  return Object.values(USER_ROLES).includes(role);
}

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || 'Unknown role';
}

function requireStaffRole(role) {
  if (!STAFF_ROLE_OPTIONS.some((option) => option.value === role)) {
    throw new Error('Select a supported staff role.');
  }
}

export function buildCreateUserRequest(input) {
  requireStaffRole(input?.role);
  const request = {
    fullName: input.fullName,
    username: input.username,
    password: input.password,
    role: input.role,
  };
  if (input.pin !== undefined) request.pin = input.pin;
  return request;
}

export function buildUpdateUserRequest(input) {
  if (!isSupportedUserRole(input?.role)) {
    throw new Error('Select a supported user role.');
  }
  return {
    fullName: input.fullName,
    username: input.username,
    role: input.role,
    active: input.role === USER_ROLES.ADMIN ? true : input.active,
  };
}
