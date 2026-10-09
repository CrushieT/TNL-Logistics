import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCreateUserRequest,
  buildUpdateUserRequest,
  getRoleLabel,
  ROLE_FILTERS,
  STAFF_ROLE_OPTIONS,
} from '../src/features/users/userRoles.mjs';

test('Admin user management exposes exactly the three explicit staff roles', () => {
  assert.deepEqual(STAFF_ROLE_OPTIONS, [
    { label: 'Receiving Staff', value: 'RECEIVING_STAFF' },
    { label: 'Courier Staff', value: 'COURIER_STAFF' },
    { label: 'Dispatch Staff', value: 'DISPATCH_STAFF' },
  ]);
  assert.deepEqual(ROLE_FILTERS, [
    'ALL',
    'ADMIN',
    'RECEIVING_STAFF',
    'COURIER_STAFF',
    'DISPATCH_STAFF',
  ]);
});

test('create-user requests omit retired subtype input and preserve selected target role', () => {
  const request = buildCreateUserRequest({
    fullName: 'Dispatch User',
    username: 'dispatch.user',
    password: 'temporary-password',
    role: 'DISPATCH_STAFF',
    staffType: 'HAULER_STAFF',
    pin: '4821',
  });
  assert.deepEqual(request, {
    fullName: 'Dispatch User',
    username: 'dispatch.user',
    password: 'temporary-password',
    role: 'DISPATCH_STAFF',
    pin: '4821',
  });
  assert.equal('staffType' in request, false);
});

test('update-user requests omit retired subtype input and preserve Admin invariants', () => {
  const staffRequest = buildUpdateUserRequest({
    fullName: 'Courier User',
    username: 'courier.user',
    role: 'COURIER_STAFF',
    active: false,
    staffType: 'INTERNAL_TRUCK',
  });
  assert.deepEqual(staffRequest, {
    fullName: 'Courier User',
    username: 'courier.user',
    role: 'COURIER_STAFF',
    active: false,
  });
  assert.equal('staffType' in staffRequest, false);

  const adminRequest = buildUpdateUserRequest({
    fullName: 'System Administrator',
    username: 'admin',
    role: 'ADMIN',
    active: false,
  });
  assert.equal(adminRequest.active, true);
});

test('unsupported and legacy role assignments fail closed', () => {
  for (const role of ['OFFICE_STAFF', 'FIELD_STAFF', 'UNKNOWN_ROLE', null, undefined]) {
    assert.throws(() => buildCreateUserRequest({ role }), /supported staff role/);
    assert.throws(() => buildUpdateUserRequest({ role }), /supported user role/);
  }
});

test('role presentation never falls back to an unknown raw authority value', () => {
  assert.equal(getRoleLabel('ADMIN'), 'Administrator');
  assert.equal(getRoleLabel('RECEIVING_STAFF'), 'Receiving Staff');
  assert.equal(getRoleLabel('COURIER_STAFF'), 'Courier Staff');
  assert.equal(getRoleLabel('DISPATCH_STAFF'), 'Dispatch Staff');
  assert.equal(getRoleLabel('FIELD_STAFF'), 'Unknown role');
});
