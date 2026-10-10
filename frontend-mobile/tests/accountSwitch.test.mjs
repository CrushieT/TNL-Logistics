import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { classifySessionFailure } from '../src/services/api/sessionHandling.mjs';
import { createSessionCoordinator, commitSessionState, refreshMatchingProfile } from '../src/features/auth/services/sessionCoordinator.mjs';
import { commitCompleteSession, clearAccessSessionPreservingBinding } from '../src/features/auth/services/authStorageTransitions.mjs';

function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
}

test('late A profile cannot overwrite an installed B session', async () => {
  const coordinator = createSessionCoordinator();
  const firstGeneration = coordinator.begin();
  coordinator.publish(firstGeneration, { token: 'a', userId: 'A' });
  const response = deferred();
  let storedUser = { userId: 'A' };
  const pending = refreshMatchingProfile(coordinator, coordinator.current(), storedUser,
    () => response.promise, async (profile) => { storedUser = profile; });
  const nextGeneration = coordinator.begin();
  await coordinator.commit(nextGeneration, async () => { storedUser = { userId: 'B' }; });
  coordinator.publish(nextGeneration, { token: 'b', userId: 'B' });
  response.resolve({ userId: 'A', fullName: 'Old account' });
  assert.equal(await pending, null);
  assert.equal(storedUser.userId, 'B');
  assert.equal(coordinator.current().userId, 'B');
});

test('a mismatched profile cannot replace the current identity', async () => {
  const coordinator = createSessionCoordinator();
  const generation = coordinator.begin();
  coordinator.publish(generation, { token: 'a', userId: 'A' });
  let writes = 0;
  await assert.rejects(refreshMatchingProfile(coordinator, coordinator.current(), { userId: 'A' },
    async () => ({ userId: 'B' }), async () => { writes += 1; }),
  (error) => error.code === 'PROFILE_IDENTITY_MISMATCH');
  assert.equal(writes, 0);
});

test('locking invalidates pending authentication without installing its result', () => {
  const coordinator = createSessionCoordinator();
  const attempt = coordinator.begin();
  coordinator.begin();
  assert.throws(() => coordinator.publish(attempt, { token: 'late', userId: 'A' }),
    (error) => error.code === 'SESSION_SUPERSEDED');
  assert.equal(coordinator.current().token, undefined);
});

test('queued writes serialize so superseded work cannot finish after the new session', async () => {
  const coordinator = createSessionCoordinator();
  const release = deferred();
  const started = deferred();
  const writes = [];
  const firstGeneration = coordinator.begin();
  const oldWrite = coordinator.commit(firstGeneration, async () => {
    started.resolve();
    await release.promise;
    writes.push('A');
  });
  const rejected = assert.rejects(oldWrite, (error) => error.code === 'SESSION_SUPERSEDED');
  await started.promise;
  const secondGeneration = coordinator.begin();
  const newWrite = coordinator.commit(secondGeneration, async () => { writes.push('B'); });
  release.resolve();
  await Promise.all([rejected, newWrite]);
  assert.deepEqual(writes, ['A', 'B']);
});

test('a queued obsolete write never starts', async () => {
  const coordinator = createSessionCoordinator();
  const oldGeneration = coordinator.begin();
  let writes = 0;
  const pending = coordinator.commit(oldGeneration, async () => { writes += 1; });
  coordinator.begin();
  await assert.rejects(pending, (error) => error.code === 'SESSION_SUPERSEDED');
  assert.equal(writes, 0);
});

test('credential rotation invalidates an earlier profile within the same account', async () => {
  const coordinator = createSessionCoordinator();
  const generation = coordinator.begin();
  coordinator.publish(generation, { token: 'old', userId: 'A' });
  const response = deferred();
  let writes = 0;
  const pending = refreshMatchingProfile(coordinator, coordinator.current(), { userId: 'A' },
    () => response.promise, async () => { writes += 1; });
  coordinator.publish(generation, { token: 'new', userId: 'A' });
  response.resolve({ userId: 'A' });
  assert.equal(await pending, null);
  assert.equal(writes, 0);
});

test('only a current session can retry once after credential rotation', () => {
  const error = { config: { _sessionGeneration: 5, headers: { Authorization: 'Bearer old' } },
    response: { status: 401, data: { code: 'SESSION_REAUTH_REQUIRED' } } };
  assert.equal(classifySessionFailure(error, 'new', { generation: 5 }).action, 'retry');
  error.config._sessionRetryAttempted = true;
  assert.equal(classifySessionFailure(error, 'new', { generation: 5 }).action, 'reauthenticate');
});

test('an old invalid-device response cannot clear the new binding', () => {
  const error = { config: { _sessionGeneration: 1 },
    response: { status: 401, data: { code: 'INVALID_DEVICE_CREDENTIALS' } } };
  assert.equal(classifySessionFailure(error, 'b', { generation: 2 }).action, 'none');
});

function storageAdapter(failAt = -1) {
  const state = { token: 'a', user: { userId: 'A' }, boundUser: { userId: 'A' },
    deviceCredentials: { deviceId: 'phone', deviceToken: 'old' }, isLocked: true, pending: false };
  let writes = 0;
  const write = (action) => async (...args) => {
    if (writes++ === failAt) throw new Error('Storage unavailable');
    action(...args);
  };
  return { state, adapter: {
    setCommitPending: write((pending) => { state.pending = pending; }),
    setAppLocked: write((locked) => { state.isLocked = locked; }),
    saveDeviceCredentials: write((deviceId, deviceToken) => { state.deviceCredentials = { deviceId, deviceToken }; }),
    saveBoundUser: write((boundUser) => { state.boundUser = boundUser; }),
    saveToken: write((token) => { state.token = token; }),
    saveUser: write((user) => { state.user = user; }),
    removeToken: async () => { state.token = null; },
    removeUser: async () => { state.user = null; },
    removeBoundUser: async () => { state.boundUser = null; },
    removeDeviceCredentials: async () => { state.deviceCredentials = null; },
  } };
}

const replacement = { token: 'b', user: { userId: 'B' }, boundUser: { userId: 'B' },
  deviceCredentials: { deviceId: 'phone', deviceToken: 'new' } };

test('complete storage commit installs only B credentials and clears its marker', async () => {
  const { state, adapter } = storageAdapter();
  await commitCompleteSession(adapter, replacement);
  assert.deepEqual(state, { ...replacement, isLocked: false, pending: false });
});

test('each persistence failure prevents a mixed session from remaining usable', async () => {
  for (let failureIndex = 1; failureIndex < 8; failureIndex += 1) {
    const { state, adapter } = storageAdapter(failureIndex);
    await assert.rejects(commitCompleteSession(adapter, replacement));
    assert.equal(state.token, null);
    assert.equal(state.user, null);
    assert.equal(state.boundUser, null);
    assert.equal(state.deviceCredentials, null);
  }
});

test('provisional B identity preserves A device ownership until permanent-password login', async () => {
  const { state, adapter } = storageAdapter();
  await commitCompleteSession(adapter, { token: 'provisional-b', user: { userId: 'B', mustChangePassword: true } });
  assert.equal(state.user.userId, 'B');
  assert.equal(state.boundUser.userId, 'A');
  assert.equal(state.deviceCredentials.deviceToken, 'old');
});

test('an old account failure cannot retry its request under a new session', () => {
  const failure = {
    config: { _sessionGeneration: 1, headers: { Authorization: 'Bearer account-a-token' } },
    response: { status: 401, data: { code: 'SESSION_REAUTH_REQUIRED' } },
  };
  assert.equal(classifySessionFailure(failure, 'account-b-token', { generation: 2 }).action, 'none');
});

test('a failed profile persistence invalidates its matching runtime session', async () => {
  const coordinator = createSessionCoordinator();
  const generation = coordinator.begin();
  coordinator.publish(generation, { token: 'a', userId: 'A' });
  await assert.rejects(refreshMatchingProfile(coordinator, coordinator.current(), { userId: 'A' },
    async () => ({ userId: 'A' }), async () => { throw new Error('Storage unavailable'); }));
  assert.equal(coordinator.current().token, undefined);
});

test('a failed replacement commit clears the runtime token', async () => {
  const coordinator = createSessionCoordinator();
  const generation = coordinator.begin();
  coordinator.publish(generation, { token: 'old', userId: 'A' });
  const { adapter } = storageAdapter(4);
  await assert.rejects(commitSessionState(coordinator, generation,
    () => commitCompleteSession(adapter, replacement)), (error) => error.code === 'SESSION_PERSISTENCE_FAILED');
  assert.equal(coordinator.current().token, undefined);
});

test('an obsolete failed commit cannot invalidate a newer session', async () => {
  const coordinator = createSessionCoordinator();
  const generation = coordinator.begin();
  const started = deferred();
  const release = deferred();
  const pending = commitSessionState(coordinator, generation, async () => {
    started.resolve();
    await release.promise;
    throw new Error('Storage unavailable');
  });
  await started.promise;
  const nextGeneration = coordinator.begin();
  coordinator.publish(nextGeneration, { token: 'b', userId: 'B' });
  release.resolve();
  await assert.rejects(pending);
  assert.equal(coordinator.current().token, 'b');
});

test('delayed device storage cannot send A profile request as B', async () => {
  const coordinator = createSessionCoordinator();
  const firstGeneration = coordinator.begin();
  coordinator.publish(firstGeneration, { token: 'a', userId: 'A' });
  const credentials = deferred();
  let requests = 0;
  const source = await readFile(new URL('../src/features/auth/services/authService.js', import.meta.url), 'utf8');
  const createService = new Function('apiClient', 'getDeviceCredentials', 'authSessionCoordinator',
    source.replace(/^import .*;\r?$/gm, '').replace('export const authService =', 'const authService =') + '\nreturn authService;');
  const service = createService({ get: async () => { requests += 1; return { data: { userId: 'B' } }; } },
    () => credentials.promise, coordinator);
  const request = service.fetchCurrentUser();
  const nextGeneration = coordinator.begin();
  coordinator.publish(nextGeneration, { token: 'b', userId: 'B' });
  credentials.resolve({ deviceId: 'phone', deviceToken: 'old' });
  await assert.rejects(request, (error) => error.code === 'SESSION_SUPERSEDED');
  assert.equal(requests, 0);
});

async function createPasswordChangeScreenHarness(changePassword, cancelAuthentication = async () => {}) {
  const source = await readFile(new URL('../src/app/(auth)/change-password.js', import.meta.url), 'utf8');
  const screenBody = source.split('export default function ChangePasswordScreen() {')[1]
    .split('  const isBusy')[0].split('  const isButtonEnabled')[0];
  const createScreen = new Function('useRouter', 'useAuth', 'useState', 'useRef', 'useEffect',
    screenBody + '\nreturn { handleSubmit, handleCancel };');
  const state = ['temporary-password', 'permanent-password', 'permanent-password', '', false];
  const refs = [];
  const routes = [];
  let auth = { user: { username: 'account_b' }, token: 'provisional-b', mustChangePassword: true,
    isLoading: false, completeRequiredPasswordChange: changePassword,
    startPasswordReauthentication: cancelAuthentication };
  return {
    state, routes,
    setAuthLoading(isLoading) { auth = { ...auth, isLoading }; },
    clearSession() { auth = { ...auth, user: null, token: null, mustChangePassword: false }; },
    render() {
      let stateIndex = 0;
      let refIndex = 0;
      const effects = [];
      const screen = createScreen(() => ({ replace: (route) => routes.push(route) }), () => auth,
        (initialValue) => {
          const index = stateIndex++;
          if (!(index in state)) state[index] = initialValue;
          return [state[index], (value) => { state[index] = value; }];
        }, (initialValue) => {
          const index = refIndex++;
          refs[index] ||= { current: initialValue };
          return refs[index];
        }, (effect) => effects.push(effect));
      return { ...screen, flushEffects: () => effects.forEach((effect) => effect()) };
    },
  };
}

for (const guardOrder of ['before-success-redirect', 'after-success-redirect']) {
  test(`B password-change navigation survives the session guard ${guardOrder}`, async () => {
    const response = deferred();
    const harness = await createPasswordChangeScreenHarness(() => response.promise);
    const pending = harness.render().handleSubmit();
    harness.clearSession();
    if (guardOrder === 'before-success-redirect') harness.render().flushEffects();
    response.resolve({ username: 'account_b' });
    await pending;
    harness.render().flushEffects();
    assert.deepEqual(harness.routes, [{ pathname: '/(auth)/login',
      params: { username: 'account_b', reason: 'password_changed' } }]);
  });
}

test('password change synchronously blocks a duplicate submission', async () => {
  const response = deferred();
  let requests = 0;
  const harness = await createPasswordChangeScreenHarness(() => { requests += 1; return response.promise; });
  const screen = harness.render();
  const first = screen.handleSubmit();
  const second = screen.handleSubmit();
  response.resolve({ username: 'account_b' });
  await Promise.all([first, second]);
  assert.equal(requests, 1);
});

test('failed password change releases navigation ownership and permits retry', async () => {
  let requests = 0;
  const harness = await createPasswordChangeScreenHarness(async () => {
    requests += 1;
    if (requests === 1) throw new Error('Incorrect current password');
    return { username: 'account_b' };
  });
  await harness.render().handleSubmit();
  assert.equal(harness.state[3], 'Incorrect current password');
  assert.equal(harness.state[4], false);
  await harness.render().handleSubmit();
  assert.equal(requests, 2);
  assert.equal(harness.routes.at(-1).params.username, 'account_b');
});

test('password-change session guard still rejects an unauthenticated direct visit', async () => {
  const harness = await createPasswordChangeScreenHarness(async () => ({}));
  harness.clearSession();
  harness.render().flushEffects();
  assert.deepEqual(harness.routes, ['/(auth)/login']);
});

for (const guardOrder of ['during-cancel', 'after-cancel']) {
  test(`cancel clears B access and fields, retains A binding, and opens password login ${guardOrder}`, async () => {
    const coordinator = createSessionCoordinator();
    coordinator.publish(coordinator.begin(), { token: 'provisional-b', userId: 'B' });
    const { state, adapter } = storageAdapter();
    state.token = 'provisional-b';
    state.user = { userId: 'B', username: 'account_b', mustChangePassword: true };
    const retainedBinding = structuredClone({ boundUser: state.boundUser, credentials: state.deviceCredentials });
    let passwordChanges = 0;
    let reauthenticate;
    const harness = await createPasswordChangeScreenHarness(async () => { passwordChanges += 1; },
      (options) => reauthenticate(options));
    const contextSource = await readFile(new URL('../src/features/auth/context/AuthContext.js', import.meta.url), 'utf8');
    const callbackSource = contextSource.slice(contextSource.indexOf('  const startPasswordReauthentication ='),
      contextSource.indexOf('  useEffect(() => {', contextSource.indexOf('  const startPasswordReauthentication =')));
    reauthenticate = new Function('useCallback', 'user', 'boundUser', 'clearAccessSessionPreservingBinding',
      'coordinator', 'router', callbackSource + '\nreturn startPasswordReauthentication;')(
      (callback) => callback, state.user, state.boundUser, async () => {
        const generation = coordinator.begin();
        await clearAccessSessionPreservingBinding(adapter);
        harness.clearSession();
        if (guardOrder === 'during-cancel') harness.render().flushEffects();
        return generation;
      }, coordinator, { replace: (route) => harness.routes.push(route) });
    await harness.render().handleCancel();
    harness.render().flushEffects();
    assert.equal(state.token, null);
    assert.equal(state.user, null);
    assert.equal(coordinator.current().token, undefined);
    assert.deepEqual(state.boundUser, retainedBinding.boundUser);
    assert.deepEqual(state.deviceCredentials, retainedBinding.credentials);
    assert.equal(state.isLocked, true);
    assert.deepEqual(harness.state.slice(0, 3), ['', '', '']);
    assert.equal(passwordChanges, 0);
    assert.deepEqual(harness.routes, [{ pathname: '/(auth)/login',
      params: { username: 'account_b', reason: 'password_change_cancelled' } }]);
  });
}

test('cancel cannot run while a password update is pending', async () => {
  const response = deferred();
  let cancellations = 0;
  const harness = await createPasswordChangeScreenHarness(() => response.promise,
    async () => { cancellations += 1; });
  const screen = harness.render();
  const pending = screen.handleSubmit();
  await screen.handleCancel();
  assert.equal(cancellations, 0);
  response.resolve({ username: 'account_b' });
  await pending;
});

test('cancel synchronously blocks repeat cancellation and password submission', async () => {
  const response = deferred();
  let cancellations = 0;
  let passwordChanges = 0;
  const harness = await createPasswordChangeScreenHarness(async () => { passwordChanges += 1; },
    () => { cancellations += 1; return response.promise; });
  const screen = harness.render();
  const pending = screen.handleCancel();
  await screen.handleCancel();
  await screen.handleSubmit();
  assert.equal(cancellations, 1);
  assert.equal(passwordChanges, 0);
  response.resolve();
  await pending;
});

test('cancel failure clears sensitive fields, reports a safe error, and permits retry', async () => {
  let cancellations = 0;
  const harness = await createPasswordChangeScreenHarness(async () => ({}), async () => {
    cancellations += 1;
    if (cancellations === 1) throw new Error('Storage unavailable');
  });
  await harness.render().handleCancel();
  assert.deepEqual(harness.state.slice(0, 3), ['', '', '']);
  assert.equal(harness.state[3], 'Unable to return to login. Please try again.');
  assert.equal(harness.state[5], false);
  await harness.render().handleCancel();
  assert.equal(cancellations, 2);
});

test('superseded cancellation does not trigger a competing session-guard redirect', async () => {
  const harness = await createPasswordChangeScreenHarness(async () => ({}), async () => {
    harness.clearSession();
    throw { code: 'SESSION_SUPERSEDED' };
  });
  await harness.render().handleCancel();
  harness.render().flushEffects();
  assert.deepEqual(harness.routes, []);
  assert.equal(harness.state[3], '');
});

test('password submission and cancel are blocked during auth restoration', async () => {
  let requests = 0;
  const harness = await createPasswordChangeScreenHarness(async () => { requests += 1; },
    async () => { requests += 1; });
  harness.setAuthLoading(true);
  const screen = harness.render();
  await screen.handleCancel();
  await screen.handleSubmit();
  assert.equal(requests, 0);
});

test('password screen wires an accessible-sized cancel action to the shared busy guard', async () => {
  const source = await readFile(new URL('../src/app/(auth)/change-password.js', import.meta.url), 'utf8');
  assert.match(source, /onPress=\{handleCancel\}[\s\S]*?disabled=\{isBusy\}/);
  assert.match(source, /Cancel and return to login/);
  assert.match(source, /cancelButton:.*minHeight: 48/);
  assert.match(source, /const isBusy = submitting \|\| isCancelling \|\| authLoading/);
});

test('cancel cleanup failure after clearing memory stays on the password page for retry', async () => {
  let cancellations = 0;
  let passwordChanges = 0;
  const usernames = [];
  const harness = await createPasswordChangeScreenHarness(async () => { passwordChanges += 1; }, async (options) => {
    cancellations += 1;
    usernames.push(options.username);
    harness.clearSession();
    if (cancellations === 1) throw new Error('Storage unavailable');
  });
  await harness.render().handleCancel();
  harness.render().flushEffects();
  assert.deepEqual(harness.routes, []);
  assert.equal(harness.state[3], 'Unable to return to login. Please try again.');
  harness.state.splice(0, 3, 'temporary-password', 'permanent-password', 'permanent-password');
  await harness.render().handleSubmit();
  assert.equal(passwordChanges, 0);
  await harness.render().handleCancel();
  assert.equal(cancellations, 2);
  assert.deepEqual(usernames, ['account_b', 'account_b']);
});

for (const guardOrder of ['during-cleanup', 'after-failure']) {
  test(`successful B password update with failed cleanup retains password login recovery ${guardOrder}`, async () => {
    const coordinator = createSessionCoordinator();
    coordinator.publish(coordinator.begin(), { token: 'provisional-b', userId: 'B' });
    const { state, adapter } = storageAdapter();
    state.token = 'provisional-b';
    state.user = { userId: 'B', username: 'account_b', mustChangePassword: true };
    const retainedBinding = structuredClone({ boundUser: state.boundUser, credentials: state.deviceCredentials });
    const removeToken = adapter.removeToken;
    let cleanupAttempts = 0;
    let passwordChanges = 0;
    adapter.removeToken = async () => {
      cleanupAttempts += 1;
      if (cleanupAttempts === 1) throw new Error('Private storage failure details');
      await removeToken();
    };
    let completePasswordChange;
    let reauthenticate;
    const harness = await createPasswordChangeScreenHarness(
      (...args) => completePasswordChange(...args), (options) => reauthenticate(options));
    const clearAccess = async () => {
      const generation = coordinator.begin();
      harness.clearSession();
      if (guardOrder === 'during-cleanup') harness.render().flushEffects();
      await coordinator.commit(generation, () => clearAccessSessionPreservingBinding(adapter));
      return generation;
    };
    const source = await readFile(new URL('../src/features/auth/context/AuthContext.js', import.meta.url), 'utf8');
    const passwordCallback = source.slice(source.indexOf('  const completeRequiredPasswordChange ='),
      source.indexOf('  const rotatePasswordInSession ='));
    completePasswordChange = new Function('useCallback', 'authService', 'coordinator', 'setIsLoading',
      'clearAccessSessionPreservingBinding', 'user', passwordCallback + '\nreturn completeRequiredPasswordChange;')(
      (callback) => callback, { changePassword: async () => { passwordChanges += 1; return { username: 'account_b' }; } },
      coordinator, () => {}, clearAccess, state.user);
    const reauthenticationCallback = source.slice(source.indexOf('  const startPasswordReauthentication ='),
      source.indexOf('  useEffect(() => {', source.indexOf('  const startPasswordReauthentication =')));
    reauthenticate = new Function('useCallback', 'user', 'boundUser', 'clearAccessSessionPreservingBinding',
      'coordinator', 'router', reauthenticationCallback + '\nreturn startPasswordReauthentication;')(
      (callback) => callback, null, { username: 'account_a' }, clearAccess, coordinator,
      { replace: (route) => harness.routes.push(route) });
    await harness.render().handleSubmit();
    harness.render().flushEffects();
    assert.deepEqual(harness.routes, []);
    assert.deepEqual(harness.state.slice(0, 3), ['', '', '']);
    assert.equal(harness.state[3], 'Your password was changed. Select Cancel and return to login to sign in with your new password.');
    assert.equal(coordinator.current().token, undefined);
    assert.deepEqual(state.boundUser, retainedBinding.boundUser);
    assert.deepEqual(state.deviceCredentials, retainedBinding.credentials);
    harness.state.splice(0, 3, 'temporary-password', 'permanent-password', 'permanent-password');
    await harness.render().handleSubmit();
    assert.equal(passwordChanges, 1);
    await harness.render().handleCancel();
    harness.render().flushEffects();
    assert.equal(cleanupAttempts, 2);
    assert.equal(state.token, null);
    assert.equal(state.user, null);
    assert.equal(state.isLocked, true);
    assert.deepEqual(harness.routes, [{ pathname: '/(auth)/login',
      params: { username: 'account_b', reason: 'password_change_cancelled' } }]);
    assert.deepEqual(state.boundUser, retainedBinding.boundUser);
    assert.deepEqual(state.deviceCredentials, retainedBinding.credentials);
  });
}

test('superseded password update cannot trigger a competing session-guard redirect', async () => {
  const harness = await createPasswordChangeScreenHarness(async () => {
    harness.clearSession();
    throw { code: 'SESSION_SUPERSEDED' };
  });
  await harness.render().handleSubmit();
  harness.render().flushEffects();
  assert.deepEqual(harness.routes, []);
  assert.equal(harness.state[3], '');
});

for (const failureStage of ['password-request', 'superseded-cleanup']) {
  test(`password-change context preserves the original error from ${failureStage}`, async () => {
    const coordinator = createSessionCoordinator();
    coordinator.begin();
    const failure = failureStage === 'password-request'
      ? { status: 400, message: 'Incorrect current password' }
      : { code: 'SESSION_SUPERSEDED' };
    let cleanupAttempts = 0;
    const source = await readFile(new URL('../src/features/auth/context/AuthContext.js', import.meta.url), 'utf8');
    const callbackSource = source.slice(source.indexOf('  const completeRequiredPasswordChange ='),
      source.indexOf('  const rotatePasswordInSession ='));
    const completePasswordChange = new Function('useCallback', 'authService', 'coordinator', 'setIsLoading',
      'clearAccessSessionPreservingBinding', 'user', callbackSource + '\nreturn completeRequiredPasswordChange;')(
      (callback) => callback, { changePassword: async () => {
        if (failureStage === 'password-request') throw failure;
        return { username: 'account_b' };
      } }, coordinator, () => {}, async () => { cleanupAttempts += 1; throw failure; }, { username: 'account_b' });
    await assert.rejects(completePasswordChange('temporary-password', 'permanent-password'),
      (error) => error === failure);
    assert.equal(cleanupAttempts, failureStage === 'password-request' ? 0 : 1);
  });
}
