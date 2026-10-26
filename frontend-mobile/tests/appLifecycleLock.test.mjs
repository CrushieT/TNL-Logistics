import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  shouldRestoreLockedSession,
} from '../src/features/auth/services/appLifecycleLock.mjs';

test('root layout does not lock the session from AppState changes', async () => {
  const source = await readFile(new URL('../src/app/_layout.js', import.meta.url), 'utf8');
  assert.equal(source.includes('AppState'), false);
  assert.doesNotMatch(source, /AppState\.addEventListener/);
});

test('cold launch locks only fully configured native device bindings', () => {
  const configured = {
    platform: 'android',
    boundUser: { username: 'field.user', hasPinSet: true },
    user: { username: 'field.user', hasPinSet: true, mustChangePassword: false },
    hasDeviceCredentials: true,
    persistedLocked: false,
  };
  assert.equal(shouldRestoreLockedSession(configured), true);
  assert.equal(shouldRestoreLockedSession({ ...configured, platform: 'web' }), false);
  assert.equal(shouldRestoreLockedSession({ ...configured, hasDeviceCredentials: false }), false);
  assert.equal(shouldRestoreLockedSession({
    ...configured,
    user: { ...configured.user, mustChangePassword: true },
  }), false);
  assert.equal(shouldRestoreLockedSession({
    ...configured,
    user: { ...configured.user, hasPinSet: false },
  }), false);
  assert.equal(shouldRestoreLockedSession({ ...configured, boundUser: null }), false);
});

test('an existing secure lock survives restore without forcing incomplete onboarding', () => {
  const base = {
    platform: 'ios',
    boundUser: { username: 'field.user', hasPinSet: true },
    user: { username: 'field.user', hasPinSet: true, mustChangePassword: false },
    hasDeviceCredentials: true,
    persistedLocked: true,
  };
  assert.equal(shouldRestoreLockedSession(base), true);
  assert.equal(shouldRestoreLockedSession({
    ...base,
    user: { ...base.user, hasPinSet: false },
  }), false);
});
