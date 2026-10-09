import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessMobileRoute,
  getMobileRoleLabel,
  getPrimaryMobileWorkflow,
  isSupportedMobileRole,
  MOBILE_ROLES,
  MOBILE_ROUTES,
  PRIMARY_MOBILE_WORKFLOWS,
  sanitizeMobileUser,
} from '../src/features/auth/services/roleAccess.mjs';

test('mobile accepts only the three staff roles and rejects Admin, legacy, null, and unknown roles', () => {
  for (const role of Object.values(MOBILE_ROLES)) {
    assert.equal(isSupportedMobileRole(role), true, role);
  }
  for (const role of ['ADMIN', 'OFFICE_STAFF', 'FIELD_STAFF', null, undefined, 'UNKNOWN_ROLE']) {
    assert.equal(isSupportedMobileRole(role), false, String(role));
  }
});

test('restored and server identities fail closed and never retain staffType', () => {
  const valid = sanitizeMobileUser({
    userId: 'USR-COURIER',
    role: 'COURIER_STAFF',
    staffType: null,
  });
  assert.deepEqual(valid, { userId: 'USR-COURIER', role: 'COURIER_STAFF' });
  assert.equal('staffType' in valid, false);
  assert.equal(sanitizeMobileUser({ role: 'FIELD_STAFF', staffType: 'INTERNAL_TRUCK' }), null);
  assert.equal(sanitizeMobileUser({ role: 'COURIER_STAFF', staffType: 'HAULER_STAFF' }), null);
  assert.equal(sanitizeMobileUser({ role: 'UNKNOWN_ROLE' }), null);
  assert.equal(sanitizeMobileUser({ role: null }), null);
});

test('each role lands on home and retains shared scanner, printer, and account access', () => {
  for (const role of Object.values(MOBILE_ROLES)) {
    assert.equal(canAccessMobileRoute(role, MOBILE_ROUTES.HOME), true, `${role} home`);
    assert.equal(canAccessMobileRoute(role, MOBILE_ROUTES.SCAN), true, `${role} scan`);
    assert.equal(canAccessMobileRoute(role, MOBILE_ROUTES.PRINTER), true, `${role} printer`);
    assert.equal(canAccessMobileRoute(role, MOBILE_ROUTES.ACCOUNT), true, `${role} account`);
  }
});

test('each role resolves to its mapped primary workflow', () => {
  assert.equal(getPrimaryMobileWorkflow('RECEIVING_STAFF'), PRIMARY_MOBILE_WORKFLOWS.RECEIVING);
  assert.equal(getPrimaryMobileWorkflow('COURIER_STAFF'), PRIMARY_MOBILE_WORKFLOWS.COURIER);
  assert.equal(getPrimaryMobileWorkflow('DISPATCH_STAFF'), PRIMARY_MOBILE_WORKFLOWS.DISPATCH);
  assert.equal(getPrimaryMobileWorkflow('FIELD_STAFF'), null);
});

test('direct navigation preserves receiving workflow boundaries', () => {
  assert.equal(canAccessMobileRoute('RECEIVING_STAFF', MOBILE_ROUTES.REGISTER), true);
  assert.equal(canAccessMobileRoute('RECEIVING_STAFF', MOBILE_ROUTES.SHIPMENTS), true);
  assert.equal(canAccessMobileRoute('RECEIVING_STAFF', MOBILE_ROUTES.WAYBILLS), false);
  assert.equal(canAccessMobileRoute('RECEIVING_STAFF', MOBILE_ROUTES.TRACKING_HISTORY), false);
});

test('direct navigation preserves courier workflow boundaries and history', () => {
  assert.equal(canAccessMobileRoute('COURIER_STAFF', MOBILE_ROUTES.REGISTER), false);
  assert.equal(canAccessMobileRoute('COURIER_STAFF', MOBILE_ROUTES.SHIPMENTS), false);
  assert.equal(canAccessMobileRoute('COURIER_STAFF', MOBILE_ROUTES.WAYBILLS), false);
  assert.equal(canAccessMobileRoute('COURIER_STAFF', MOBILE_ROUTES.TRACKING_HISTORY), true);
});

test('direct navigation preserves dispatch waybill and history access without receiving access', () => {
  assert.equal(canAccessMobileRoute('DISPATCH_STAFF', MOBILE_ROUTES.REGISTER), false);
  assert.equal(canAccessMobileRoute('DISPATCH_STAFF', MOBILE_ROUTES.SHIPMENTS), false);
  assert.equal(canAccessMobileRoute('DISPATCH_STAFF', MOBILE_ROUTES.WAYBILLS), true);
  assert.equal(canAccessMobileRoute('DISPATCH_STAFF', MOBILE_ROUTES.TRACKING_HISTORY), true);
});

test('unknown roles and routes fail closed and target role labels are explicit', () => {
  assert.equal(canAccessMobileRoute('FIELD_STAFF', MOBILE_ROUTES.SCAN), false);
  assert.equal(canAccessMobileRoute('COURIER_STAFF', 'UNKNOWN_ROUTE'), false);
  assert.equal(getMobileRoleLabel('RECEIVING_STAFF'), 'RECEIVING STAFF');
  assert.equal(getMobileRoleLabel('COURIER_STAFF'), 'COURIER STAFF');
  assert.equal(getMobileRoleLabel('DISPATCH_STAFF'), 'DISPATCH STAFF');
  assert.equal(getMobileRoleLabel('FIELD_STAFF'), 'ROLE UNAVAILABLE');
});
