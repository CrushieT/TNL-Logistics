export const MOBILE_ROLES = Object.freeze({
  RECEIVING_STAFF: 'RECEIVING_STAFF',
  COURIER_STAFF: 'COURIER_STAFF',
  DISPATCH_STAFF: 'DISPATCH_STAFF',
});

export const MOBILE_ROUTES = Object.freeze({
  HOME: 'HOME',
  REGISTER: 'REGISTER',
  SHIPMENTS: 'SHIPMENTS',
  SCAN: 'SCAN',
  WAYBILLS: 'WAYBILLS',
  TRACKING_HISTORY: 'TRACKING_HISTORY',
  PRINTER: 'PRINTER',
  ACCOUNT: 'ACCOUNT',
});

export const PRIMARY_MOBILE_WORKFLOWS = Object.freeze({
  RECEIVING: 'RECEIVING',
  COURIER: 'COURIER',
  DISPATCH: 'DISPATCH',
});

const ROLE_ROUTE_ACCESS = Object.freeze({
  [MOBILE_ROLES.RECEIVING_STAFF]: Object.freeze([
    MOBILE_ROUTES.HOME,
    MOBILE_ROUTES.REGISTER,
    MOBILE_ROUTES.SHIPMENTS,
    MOBILE_ROUTES.PRINTER,
    MOBILE_ROUTES.ACCOUNT,
  ]),
  [MOBILE_ROLES.COURIER_STAFF]: Object.freeze([
    MOBILE_ROUTES.HOME,
    MOBILE_ROUTES.SCAN,
    MOBILE_ROUTES.TRACKING_HISTORY,
    MOBILE_ROUTES.PRINTER,
    MOBILE_ROUTES.ACCOUNT,
  ]),
  [MOBILE_ROLES.DISPATCH_STAFF]: Object.freeze([
    MOBILE_ROUTES.HOME,
    MOBILE_ROUTES.WAYBILLS,
    MOBILE_ROUTES.TRACKING_HISTORY,
    MOBILE_ROUTES.PRINTER,
    MOBILE_ROUTES.ACCOUNT,
  ]),
});

export function isSupportedMobileRole(role) {
  return Object.hasOwn(ROLE_ROUTE_ACCESS, role);
}

export function canAccessMobileRoute(role, route) {
  if (!isSupportedMobileRole(role) || !Object.values(MOBILE_ROUTES).includes(route)) {
    return false;
  }
  return ROLE_ROUTE_ACCESS[role].includes(route);
}

export function getPrimaryMobileWorkflow(role) {
  const workflows = {
    [MOBILE_ROLES.RECEIVING_STAFF]: PRIMARY_MOBILE_WORKFLOWS.RECEIVING,
    [MOBILE_ROLES.COURIER_STAFF]: PRIMARY_MOBILE_WORKFLOWS.COURIER,
    [MOBILE_ROLES.DISPATCH_STAFF]: PRIMARY_MOBILE_WORKFLOWS.DISPATCH,
  };
  return workflows[role] || null;
}

export function sanitizeMobileUser(user) {
  if (!user || typeof user !== 'object' || !isSupportedMobileRole(user.role)) {
    return null;
  }

  if (Object.hasOwn(user, 'staffType') || Object.hasOwn(user, 'staff_type')) {
    return null;
  }

  return { ...user };
}

export function getMobileRoleLabel(role) {
  const labels = {
    [MOBILE_ROLES.RECEIVING_STAFF]: 'RECEIVING STAFF',
    [MOBILE_ROLES.COURIER_STAFF]: 'COURIER STAFF',
    [MOBILE_ROLES.DISPATCH_STAFF]: 'DISPATCH STAFF',
  };
  return labels[role] || 'ROLE UNAVAILABLE';
}
