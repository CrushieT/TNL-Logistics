import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  clearAccessSessionPreservingBinding,
  clearDeviceSession,
  replaceAuthenticatedSession,
} from '../src/features/auth/services/authStorageTransitions.mjs';
import {
  deriveInitials,
  formatRole,
  formatStaffType,
  maskDeviceId,
  normalizeSecurityError,
  resolveAccountDisplay,
  validateFourDigitPin,
  validatePasswordChange,
} from '../src/features/settings/accountSecurityFlow.mjs';
import {
  buildSessionRetryConfig,
  classifySessionFailure,
  sanitizeSensitiveError,
} from '../src/services/api/sessionHandling.mjs';

function createStorageState() {
  const state = {
    token: 'old-token',
    user: { username: 'field.user' },
    boundUser: { username: 'field.user' },
    deviceCredentials: { deviceId: 'device-1', deviceToken: 'a'.repeat(64) },
    isLocked: true,
  };
  return {
    state,
    adapter: {
      saveToken: async (token) => { state.token = token; },
      saveUser: async (user) => { state.user = user; },
      removeToken: async () => { state.token = null; },
      removeUser: async () => { state.user = null; },
      removeBoundUser: async () => { state.boundUser = null; },
      removeDeviceCredentials: async () => { state.deviceCredentials = null; },
      setAppLocked: async (isLocked) => { state.isLocked = isLocked; },
    },
  };
}

test('account display helpers use canonical values and safe fallbacks', () => {
  assert.equal(deriveInitials('Carlo Reyes', 'carlo'), 'CR');
  assert.equal(deriveInitials('Prince', 'prince'), 'P');
  assert.equal(deriveInitials('', 'terminal.user'), 'T');
  assert.equal(deriveInitials('   ', '   '), '?');
  assert.equal(formatRole('OFFICE_STAFF'), 'OFFICE STAFF');
  assert.equal(formatRole('UNKNOWN'), 'ROLE UNAVAILABLE');
  assert.equal(formatStaffType('INTERNAL_TRUCK'), 'INTERNAL TRUCK');
  assert.equal(formatStaffType(null), 'UNAVAILABLE');
  assert.equal(maskDeviceId('terminal-device-a12f93bc'), '••••••••a12f93bc');
  assert.equal(maskDeviceId('abc'), '••••••••abc');
  assert.equal(maskDeviceId(null), '—');
  assert.equal(maskDeviceId('   '), '—');

  const display = resolveAccountDisplay({ username: 'field.user', role: 'FIELD_STAFF' }, { isAuthenticated: true });
  assert.equal(display.fullName, '—');
  assert.equal(display.username, '@field.user');
  assert.equal(display.role, 'FIELD STAFF');
  assert.equal(display.isUnlocked, true);
});

test('password validation preserves whitespace semantics and never returns credentials', () => {
  assert.equal(validatePasswordChange('', 'abcdefgh', 'abcdefgh'), 'All password fields are required.');
  assert.equal(validatePasswordChange(' old pass ', ' new pass ', ' new pass '), null);
  assert.equal(validatePasswordChange('password', 'password', 'password'), 'New password must be different from current password.');
  assert.equal(validatePasswordChange('current', 'short', 'short'), 'New password must be between 8 and 128 characters.');
  assert.equal(validatePasswordChange('current', 'new-password', 'different'), 'New passwords do not match.');
  const result = validatePasswordChange('secret-current', 'secret-next', 'mismatch');
  assert.equal(result.includes('secret-current'), false);
  assert.equal(result.includes('secret-next'), false);
});

test('PIN validation accepts only exactly four ASCII digits', () => {
  assert.equal(validateFourDigitPin('4821'), true);
  for (const invalidPin of [undefined, '', '123', '12345', '123456', '12.3', '-123', '١٢٣٤', '12a4', ' 1234']) {
    assert.equal(validateFourDigitPin(invalidPin), false, `expected ${String(invalidPin)} to be invalid`);
  }
});

test('replacement sessions preserve device binding and credentials', async () => {
  const { state, adapter } = createStorageState();
  await replaceAuthenticatedSession(adapter, { token: 'replacement-token', user: { username: 'field.user', hasPinSet: true } });
  assert.equal(state.token, 'replacement-token');
  assert.equal(state.user.hasPinSet, true);
  assert.equal(state.boundUser.username, 'field.user');
  assert.equal(state.deviceCredentials.deviceId, 'device-1');
  assert.equal(state.isLocked, false);
});

test('session reauthentication preserves binding and locks the app', async () => {
  const { state, adapter } = createStorageState();
  await clearAccessSessionPreservingBinding(adapter);
  assert.equal(state.token, null);
  assert.equal(state.user, null);
  assert.equal(state.boundUser.username, 'field.user');
  assert.equal(state.deviceCredentials.deviceId, 'device-1');
  assert.equal(state.isLocked, true);
});

test('invalid-device and confirmed-unbind cleanup removes all auth state', async () => {
  for (const reason of ['invalid-device', 'confirmed-unbind']) {
    const { state, adapter } = createStorageState();
    await clearDeviceSession(adapter);
    assert.deepEqual(state, {
      token: null,
      user: null,
      boundUser: null,
      deviceCredentials: null,
      isLocked: false,
    }, reason);
  }
});

test('storage transitions expose no credential-value fields', async () => {
  const moduleSource = await readFile(new URL('../src/features/auth/services/authStorageTransitions.mjs', import.meta.url), 'utf8');
  assert.equal(/currentPassword|pinHash|verificationResult/i.test(moduleSource), false);
});

test('stale responses retry once with the newer stored token', () => {
  const error = {
    config: { headers: { Authorization: 'Bearer old-token' }, data: '{"password":"sensitive"}' },
    response: { status: 401, data: { code: 'SESSION_REAUTH_REQUIRED' } },
  };
  assert.equal(classifySessionFailure(error, 'replacement-token').action, 'retry');
  const retryConfig = buildSessionRetryConfig(error.config, 'replacement-token');
  assert.equal(retryConfig.headers.Authorization, 'Bearer replacement-token');
  assert.equal(retryConfig._sessionRetryAttempted, true);
  assert.equal(classifySessionFailure({ ...error, config: retryConfig }, 'replacement-token').action, 'reauthenticate');
});

test('sensitive API errors expose only the approved safe fields', () => {
  const credentials = {
    password: 'submitted-password',
    pin: '4821',
    token: 'raw-body-token',
  };
  const rawError = {
    config: {
      data: JSON.stringify(credentials),
      headers: {
        Authorization: 'Bearer submitted-jwt',
        'X-Device-Token': 'f'.repeat(64),
      },
    },
    response: {
      status: 429,
      data: { code: 'RATE_LIMITED', message: 'Too many attempts.', retryAfterSeconds: 42 },
    },
  };
  const sanitized = sanitizeSensitiveError(rawError);
  assert.deepEqual(Object.keys(sanitized).sort(), ['code', 'message', 'retryAfterSeconds', 'status']);
  assert.deepEqual(sanitized, {
    status: 429,
    code: 'RATE_LIMITED',
    message: 'Too many attempts.',
    retryAfterSeconds: 42,
  });
  const serialized = JSON.stringify(sanitized);
  for (const secret of [...Object.values(credentials), 'submitted-jwt', 'f'.repeat(64)]) {
    assert.equal(serialized.includes(secret), false);
  }
  assert.equal('config' in sanitized, false);
  assert.equal('response' in sanitized, false);
});

test('ordinary authorization denial and public authentication errors do not trigger cleanup', () => {
  assert.equal(classifySessionFailure({ response: { status: 403 }, config: {} }, 'token').action, 'none');
  assert.equal(classifySessionFailure({
    response: { status: 401, data: { code: 'SESSION_REAUTH_REQUIRED' } },
    config: { skipAuth: true },
  }, 'token').action, 'none');
});

test('security errors are normalized without leaking response objects', () => {
  assert.deepEqual(normalizeSecurityError({ code: 'FAILURE', message: 'Safe message', retryAfterSeconds: 9 }), {
    code: 'FAILURE',
    message: 'Safe message',
    retryAfterSeconds: 9,
  });
});

test('auth service marks public requests and sensitive payloads explicitly', async () => {
  const source = await readFile(new URL('../src/features/auth/services/authService.js', import.meta.url), 'utf8');
  for (const methodName of ['fetchCurrentUser', 'changePassword', 'verifyCurrentPassword', 'setupInitialPin', 'rotatePin', 'unbindCurrentDevice']) {
    assert.match(source, new RegExp(`async ${methodName}\\(`));
  }
  assert.match(source, /mobile-login[\s\S]*skipAuth: true[\s\S]*sensitivePayload: true/);
  assert.match(source, /mobile-pin-login[\s\S]*skipAuth: true[\s\S]*sensitivePayload: true/);
  assert.match(source, /mobile-pin-status[\s\S]*skipAuth: true/);
});

test('settings routes and dashboard account navigation are wired', async () => {
  const [layout, home, fieldDashboard, officeDashboard] = await Promise.all([
    readFile(new URL('../src/app/(main)/_layout.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/(main)/index.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/field/components/FieldDashboard.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/office/components/OfficeDashboard.js', import.meta.url), 'utf8'),
  ]);
  assert.match(layout, /name="settings\/index"/);
  assert.match(layout, /name="settings\/password"/);
  assert.match(layout, /name="settings\/pin"/);
  assert.match(home, /router\.push\('\/(?:\(main\)\/)?settings'\)/);
  assert.match(fieldDashboard, /ACCOUNT & SHIFT/);
  assert.match(fieldDashboard, /onPress=\{onAccount\}/);
  assert.match(officeDashboard, /ACCOUNT & SHIFT/);
  assert.match(officeDashboard, /onPress=\{onAccount\}/);
});

test('production settings screens use canonical profile data and no sample identity', async () => {
  const sources = await Promise.all([
    readFile(new URL('../src/app/(main)/settings/index.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/settings/components/AccountIdentityCard.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/field/components/FieldDashboard.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/office/components/OfficeDashboard.js', import.meta.url), 'utf8'),
  ]);
  const combined = sources.join('\n');
  assert.match(combined, /fetchCurrentUser/);
  assert.match(combined, /deviceBinding/);
  for (const placeholder of ['Carlo Reyes', 'Andrea Lim', 'Juan Dela Cruz', 'Central Hub', 'Field Courier Transit']) {
    assert.equal(combined.includes(placeholder), false, `found placeholder ${placeholder}`);
  }
});

test('initial PIN reauthentication preserves device binding and returns to password login', async () => {
  const [setupScreen, authContext] = await Promise.all([
    readFile(new URL('../src/app/(auth)/setup-pin.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/auth/context/AuthContext.js', import.meta.url), 'utf8'),
  ]);
  assert.match(setupScreen, /PASSWORD_REAUTH_REQUIRED/);
  assert.match(setupScreen, /pin_setup_reauth_required/);
  assert.match(authContext, /clearAccessSessionPreservingBinding/);
  assert.match(authContext, /startPasswordReauthentication/);
});

test('password and PIN rotations replace JWT without clearing device credentials', async () => {
  const source = await readFile(new URL('../src/features/auth/context/AuthContext.js', import.meta.url), 'utf8');
  assert.match(source, /rotatePasswordInSession[\s\S]*installSession\(result\.token/);
  assert.match(source, /rotateUserPin[\s\S]*installSession\(result\.token/);
  const rotationBlock = source.slice(source.indexOf('const rotatePasswordInSession'), source.indexOf('const unlockWithPin'));
  assert.equal(rotationBlock.includes('removeDeviceCredentials'), false);
});
