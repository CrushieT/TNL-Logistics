import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProductionModule, deferred } from './previewHarness.mjs';
import * as core from '../src/services/api/sessionCore.mjs';
import * as cache from '../src/services/api/responseCache.mjs';
import * as requests from '../src/services/api/requestCoordinator.mjs';

const expiry = Math.floor(Date.now() / 1000) + 3600;
const token = (exp = expiry, claims = {}) => `header.${Buffer.from(JSON.stringify({ uid: 'A', sub: 'admin', role: 'ADMIN', ver: 1, auth_time: 100, exp, ...claims })).toString('base64url')}.signature`;
const user = { userId: 'A', username: 'admin', role: 'ADMIN' };

function clientHarness() {
  let requestInterceptor, successInterceptor, errorInterceptor;
  const reads = [];
  const api = {
    interceptors: {
      request: { use(callback) { requestInterceptor = callback; } },
      response: { use(success, error) { successInterceptor = success; errorInterceptor = error; } },
    },
    get(url, config = {}) {
      config = requestInterceptor({ ...config, url });
      const response = deferred();
      reads.push({ config, response });
      return response.promise.then(
        value => successInterceptor({ data: user, headers: {}, ...value, config }),
        error => errorInterceptor({ ...error, config }),
      );
    },
    post: async () => ({ data: { ...user, token: token(expiry + 100, { ver: 2 }) } }),
  };
  const boot = [];
  const axios = {
    create: () => api,
    get: (url, config) => { const response = deferred(); boot.push({ url, config, response }); return response.promise; },
    post: async () => ({ data: { ...user, token: token(expiry, { uid: 'B', sub: 'other' }) } }),
  };
  const client = loadProductionModule('../src/services/api/client.js', name => {
    if (name === 'axios') return axios;
    if (name === 'react-native') return { Platform: { OS: 'web' } };
    if (name.endsWith('sessionCore.mjs')) return core;
    if (name.endsWith('responseCache.mjs')) return cache;
    throw new Error(name);
  });
  client.setToken(token()); client.setCurrentUser(user);
  return { client, reads, boot };
}

test('validation accepts its own newer renewal before notifying once', async () => {
  const { client, reads } = clientHarness();
  let notifications = 0;
  client.onSessionChanged(() => notifications++);
  const pending = client.validateSession();
  reads[0].response.resolve({ headers: { 'x-renewed-token': token(expiry + 100) } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(reads.length, 1, 'own renewal must not trigger a retry');
  assert.equal(await pending, 'VALID');
  assert.equal(client.getToken(), token(expiry + 100));
  assert.equal(client.hasVerifiedAdminSession(), true);
  assert.equal(notifications, 1);
});

test('repeated validations accept advancing expiry and overlapping calls share the operation', async () => {
  const { client, reads } = clientHarness();
  for (let index = 0; index < 3; index++) {
    const pending = client.validateSession();
    assert.equal(client.validateSession(), pending);
    reads[index].response.resolve({ headers: { 'x-renewed-token': token(expiry + (index + 1) * 100) } });
    assert.equal(await pending, 'VALID');
  }
  assert.equal(reads.length, 3);
});

for (const renewal of [undefined, token(), token(expiry - 100), 'malformed']) {
  test(`validation preserves renewal rules: ${renewal === undefined ? 'missing' : renewal === 'malformed' ? renewal : core.decodeJwtPayload(renewal).exp}`, async () => {
    const { client, reads } = clientHarness();
    const pending = client.validateSession();
    reads[0].response.resolve({ headers: { 'x-renewed-token': renewal } });
    assert.equal(await pending, 'VALID');
    assert.equal(client.getToken(), token());
  });
}

for (const transition of ['logout', 'account', 'password']) {
  for (const outcome of ['success', '401', '403', 'network']) {
    test(`${transition} rejects obsolete validation ${outcome} and renewal`, async () => {
      const { client, reads } = clientHarness();
      const pending = client.validateSession();
      if (transition === 'logout') client.logout();
      if (transition === 'account') await client.login('other', 'test-only');
      if (transition === 'password') await client.changePassword('old', 'new');
      const activeToken = client.getToken();
      const activeUser = client.getCurrentUser();
      if (outcome === 'success') reads[0].response.resolve({ headers: { 'x-renewed-token': token(expiry + 500) } });
      else reads[0].response.reject({ response: { status: Number(outcome) || 503, data: { code: 'PASSWORD_CHANGE_REQUIRED' } } });
      assert.equal(await pending, 'UNVERIFIED');
      assert.equal(client.getToken(), activeToken);
      assert.deepEqual(client.getCurrentUser(), activeUser);
    });
  }
}

test('obsolete completion cannot clear newer pending validation', async () => {
  const { client, reads } = clientHarness();
  const old = client.validateSession();
  await client.login('other', 'test-only');
  const current = client.validateSession();
  reads[0].response.resolve({});
  await old;
  assert.equal(client.validateSession(), current);
  reads[1].response.resolve({});
  assert.equal(await current, 'VALID');
});

test('genuine concurrent replacement retries once and never waits on itself', async () => {
  const { client, reads } = clientHarness();
  const pending = client.validateSession();
  client.setToken(token(expiry + 100));
  reads[0].response.resolve({});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(reads.length, 2);
  assert.equal(client.validateSession(), pending);
  client.setToken(token(expiry + 200));
  reads[1].response.resolve({ headers: { 'x-renewed-token': token(expiry + 300) } });
  assert.equal(await pending, 'UNVERIFIED');
  assert.equal(reads.length, 2);
  assert.equal(client.getToken(), token(expiry + 200));
});

test('concurrent renewal retains the shared validation and successful bounded retry', async () => {
  const { client, reads } = clientHarness();
  const pending = client.validateSession();
  client.handleSlidingTokenRenewal(token(expiry + 100), token(), client.getSessionGeneration());
  assert.equal(client.validateSession(), pending);
  reads[0].response.resolve({});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(reads.length, 2);
  reads[1].response.resolve({ headers: { 'x-renewed-token': token(expiry + 200) } });
  assert.equal(await pending, 'VALID');
  assert.equal(client.getToken(), token(expiry + 200));
});

for (const outcome of ['401', 'staff']) {
  test(`current session rejects ${outcome}`, async () => {
    const { client, reads } = clientHarness();
    const pending = client.validateSession();
    if (outcome === '401') reads[0].response.reject({ response: { status: 401 } });
    else reads[0].response.resolve({ data: { ...user, role: 'STAFF' }, headers: { 'x-renewed-token': token(expiry + 100) } });
    await pending;
    assert.equal(client.getToken(), null);
    assert.equal(client.hasVerifiedAdminSession(), false);
  });
}

test('ordinary API responses still renew sliding tokens', async () => {
  const { client, reads } = clientHarness();
  const pending = client.default.get('/reports/summary');
  reads[0].response.resolve({ headers: { 'x-renewed-token': token(expiry + 100) } });
  await pending;
  assert.equal(client.getToken(), token(expiry + 100));
});

function mountProductionScreens(client) {
  const listeners = new Map();
  const priorWindow = globalThis.window;
  globalThis.window = {
    addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
  };
  const runtimes = [];
  const router = { replace() {}, push() {} };
  let reportReads = 0;
  function mount(path) {
    const slots = [];
    let cursor = 0, tree;
    let effects = [];
    const equal = (left, right) => left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
    const hooks = {
      createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
      useState(initial) {
        const index = cursor++;
        slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
        return [slots[index].value, next => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }];
      },
      useRef(initial) { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
      useMemo(factory, deps) {
        const index = cursor++;
        if (!slots[index] || !equal(slots[index].deps, deps)) slots[index] = { value: factory(), deps };
        return slots[index].value;
      },
      useCallback(callback, deps) { return hooks.useMemo(() => callback, deps); },
      useEffect(effect, deps) {
        const index = cursor++;
        if (!slots[index] || !equal(slots[index].deps, deps)) {
          const previous = slots[index]; slots[index] = { deps, cleanup: previous?.cleanup };
          effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect(); });
        }
      },
    };
    const react = { __esModule: true, default: hooks, ...hooks };
    const placeholder = () => null;
    const components = new Proxy({ __esModule: true, default: placeholder }, { get: (target, name) => target[name] ?? placeholder });
    const sessionHook = loadProductionModule('../src/services/api/useVerifiedAdminSession.js', name => name === 'react' ? react : client);
    const coordinatorHook = loadProductionModule('../src/services/api/useRequestCoordinator.js', name => name === 'react' ? react : name.endsWith('responseCache.mjs') ? cache : requests);
    const Screen = loadProductionModule(path, name => {
      if (name === 'react') return react;
      if (name === 'react-native') return { View: 'View', Text: 'Text', Pressable: 'Pressable', Platform: { OS: 'web' }, LogBox: { ignoreLogs() {} }, StyleSheet: { create: value => value } };
      if (name === 'expo-router') return { Stack: Object.assign(placeholder, { Screen: placeholder, Protected: placeholder }), usePathname: () => '/reports', useRouter: () => router, useRootNavigationState: () => ({ key: 'root' }) };
      if (name.endsWith('/api/client')) return client;
      if (name.endsWith('/useVerifiedAdminSession')) return sessionHook;
      if (name.endsWith('/useRequestCoordinator')) return coordinatorHook;
      if (name.endsWith('/responseCache.mjs')) return cache;
      if (name.endsWith('/requestCoordinator.mjs')) return requests;
      if (name.endsWith('/printAuditOutbox')) return { retryPendingPrintAudits: async () => {} };
      if (name.endsWith('/theme')) return { colors: {}, fonts: {}, radius: {}, spacing: {} };
      if (name.endsWith('/reports')) return { ...components, getReportSummary: async () => { reportReads++; return { kpis: {}, clientRevenue: [] }; } };
      if (name.endsWith('/shipments')) return { subscribeRealtimeEvents: () => () => {} };
      return components;
    }).default;
    const runtime = {
      render() { cursor = 0; tree = Screen(); const pending = effects; effects = []; pending.forEach(effect => effect()); },
      nodes(node = tree) { if (Array.isArray(node)) return node.flatMap(item => runtime.nodes(item)); if (!node || typeof node !== 'object') return []; return [node, ...runtime.nodes(node.props?.children)]; },
      unmount() { slots.forEach(slot => slot?.cleanup?.()); },
    };
    runtimes.push(runtime);
    return runtime;
  }
  const root = mount('../src/app/_layout.js');
  mount('../src/app/reports.js');
  return {
    root,
    reportReads: () => reportReads,
    event(name) { listeners.get(name)?.forEach(callback => callback()); },
    async flush() { for (let index = 0; index < 8; index++) { runtimes.forEach(runtime => runtime.render()); await new Promise(resolve => setImmediate(resolve)); } },
    unmount() { runtimes.forEach(runtime => runtime.unmount()); globalThis.window = priorWindow; },
  };
}

for (const failure of ['first-boot', 'validation', 'none']) {
  test(`root and Reports recover from ${failure} without recursive startup`, async () => {
    cache.clearAllCache();
    const { client, reads, boot } = clientHarness();
    const screens = mountProductionScreens(client);
    try {
      await screens.flush();
      screens.event('focus'); screens.event('online');
      assert.equal(boot.length, 1);
      assert.equal(boot[0].config.timeout, 15000);
      assert.equal(screens.reportReads(), 0);
      if (failure === 'first-boot') boot[0].response.reject(new Error('offline'));
      else boot[0].response.resolve({ data: { isFirstBoot: false } });
      await screens.flush();
      if (failure === 'validation') { reads[0].response.reject(new Error('offline')); await screens.flush(); }
      if (failure !== 'none') {
        assert.ok(screens.root.nodes().some(node => node.props?.accessibilityRole === 'alert'));
        const retry = screens.root.nodes().find(node => node.props?.accessibilityLabel === 'Retry session verification');
        assert.equal(retry.props.disabled, false);
        retry.props.onPress();
        await screens.flush();
        assert.equal(screens.root.nodes().find(node => node.props?.accessibilityLabel === 'Retry session verification').props.disabled, true);
        screens.event('focus'); screens.event('online');
        assert.equal(boot.length, 2);
        boot[1].response.resolve({ data: { isFirstBoot: false } });
        await screens.flush();
      }
      reads.at(-1).response.resolve({ headers: { 'x-renewed-token': token(expiry + 100) } });
      await screens.flush();
      assert.equal(client.hasVerifiedAdminSession(), true);
      assert.equal(screens.reportReads(), 1);
      assert.equal(boot.length, failure === 'none' ? 1 : 2);
      assert.equal(screens.root.nodes().some(node => node.props?.accessibilityRole === 'alert'), false);
    } finally { screens.unmount(); }
  });
}

test('old root pass cannot update state or clear a replacement generation pass', async () => {
  cache.clearAllCache();
  const { client, boot } = clientHarness();
  const screens = mountProductionScreens(client);
  try {
    await screens.flush();
    await client.login('other', 'test-only');
    assert.equal(boot.length, 2);
    boot[0].response.resolve({ data: { isFirstBoot: true } });
    await screens.flush();
    screens.event('focus'); screens.event('online');
    assert.equal(boot.length, 2);
    boot[1].response.resolve({ data: { isFirstBoot: false } });
    await screens.flush();
    assert.equal(screens.reportReads(), 1);
    assert.equal(screens.root.nodes().some(node => node.props?.accessibilityRole === 'alert'), false);
  } finally { screens.unmount(); }
});
