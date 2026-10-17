import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as cache from '../src/services/api/responseCache.mjs';
import * as requests from '../src/services/api/requestCoordinator.mjs';
import * as sessionCore from '../src/services/api/sessionCore.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');
const plugins = [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')];

function loadProductionModule(path, resolveImport) {
  const filename = new URL(path, import.meta.url);
  const { code } = transformSync(readFileSync(filename, 'utf8'), {
    filename: filename.pathname, configFile: false, babelrc: false, plugins,
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(resolveImport, module, module.exports);
  return module.exports;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

function component(name) {
  const placeholder = () => null;
  placeholder.displayName = name;
  return placeholder;
}

function componentModule(overrides = {}) {
  const exports = { __esModule: true, default: component('default'), ...overrides };
  return new Proxy(exports, { get(target, name) {
    if (!(name in target)) target[name] = component(String(name));
    return target[name];
  } });
}

// Run production screens/hooks with deterministic state and API boundaries.
// Child rendering is stubbed; DOM layout remains a browser verification gate.
function mountScreen(name, api = {}) {
  const slots = [];
  let cursor = 0;
  let dirty = true;
  let tree;
  let pendingEffects = [];
  let auth = { isAuthenticated: true, isVerified: true, userId: 'ADMIN-A', sessionGeneration: 1 };
  const invalidationListeners = new Set();
  const realtimeListeners = new Set();
  const coordinators = new Map();
  const equalDeps = (left, right) => left && right && left.length === right.length && left.every((item, index) => Object.is(item, right[index]));
  const hooks = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    Fragment: 'Fragment',
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, next => {
        const value = typeof next === 'function' ? next(slots[index].value) : next;
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; }
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo(factory, deps) {
      const index = cursor++;
      if (!slots[index] || !equalDeps(slots[index].deps, deps)) slots[index] = { deps, value: factory() };
      return slots[index].value;
    },
    useCallback(callback, deps) { return hooks.useMemo(() => callback, deps); },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || !equalDeps(slots[index].deps, deps)) {
        const previous = slots[index];
        slots[index] = { deps, cleanup: previous?.cleanup };
        pendingEffects.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect(); });
      }
    },
  };
  const react = { __esModule: true, default: hooks, ...hooks };
  const native = componentModule({ StyleSheet: { create: value => value }, Platform: { OS: 'web' }, useWindowDimensions: () => ({ width: 1200, height: 900 }) });
  const hook = loadProductionModule('../src/services/api/useRequestCoordinator.js', dependency => dependency === 'react' ? react : {
    ...requests, createRequestCoordinator(options) {
      const coordinator = requests.createRequestCoordinator(options);
      coordinators.set(options.scope, coordinator);
      return coordinator;
    },
  });
  const cycleList = [{ isoDate: '2026-10-22', label: 'Current Cycle' }];
  const subscribeRealtimeEvents = listener => { realtimeListeners.add(listener); return () => realtimeListeners.delete(listener); };
  const authModule = {
    getSessionAuthContext: () => ({ ...auth }),
    onSessionInvalidated: listener => { invalidationListeners.add(listener); return () => invalidationListeners.delete(listener); },
  };
  const Screen = loadProductionModule(`../src/app/${name}.js`, dependency => {
    if (dependency === 'react') return react;
    if (dependency === 'react-native') return native;
    if (dependency === 'expo-router') return { useRouter: () => ({ push() {} }) };
    if (dependency.endsWith('/responseCache.mjs')) return cache;
    if (dependency.endsWith('/requestCoordinator.mjs')) return requests;
    if (dependency.endsWith('/useRequestCoordinator')) return hook;
    if (dependency.endsWith('/api/client')) return authModule;
    if (dependency.endsWith('/theme')) return { colors: new Proxy({}, { get: () => '#111' }), fonts: {}, spacing: {}, radius: {}, type: {} };
    return componentModule({
      subscribeRealtimeEvents,
      getDashboardSummary: api.dashboard || (async () => ({ shipmentCount: 10 })),
      getReportSummary: api.reports || (async () => ({ kpis: {}, clientRevenue: [] })),
      getWeeklyCollections: api.collections || (async () => ({ items: [] })),
      getActiveCollectionCycles: api.cycles || (async () => cycleList),
      getRecentThursdays: () => cycleList,
      listTrackingLogs: api.logs || (async () => ({ content: [], page: { totalElements: 0 } })),
      getTrackingMetrics: api.metrics || (async () => ({ todayTotalScans: 0 })),
    });
  }).default;
  function render() { cursor = 0; dirty = false; tree = Screen(); return tree; }
  async function flush() {
    for (let iteration = 0; iteration < 12; iteration++) {
      if (dirty) render();
      const effects = pendingEffects; pendingEffects = [];
      effects.forEach(effect => effect());
      await new Promise(resolve => setImmediate(resolve));
      if (!dirty && pendingEffects.length === 0) return tree;
    }
    throw new Error('Screen did not settle');
  }
  function nodes(node = tree) {
    if (Array.isArray(node)) return node.flatMap(item => nodes(item));
    if (!node || typeof node !== 'object') return [];
    return [node, ...nodes(node.props?.children)];
  }
  return {
    render, flush, coordinators,
    props: displayName => nodes().find(node => node.type?.displayName === displayName)?.props,
    text: () => JSON.stringify(tree),
    emit: () => realtimeListeners.forEach(listener => listener({ type: 'STATUS_UPDATE', data: {} })),
    invalidate() {
      auth = { isAuthenticated: false, isVerified: false, userId: null, sessionGeneration: 2 };
      cache.clearAllCache(); invalidationListeners.forEach(listener => listener());
    },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

beforeEach(() => cache.clearAllCache());

for (const name of ['index', 'reports', 'weekly-collections', 'tracking-logs']) {
  test(`${name}: actual screen renders without coordinator initialization errors`, async () => {
    const screen = mountScreen(name);
    assert.doesNotThrow(() => screen.render());
    await screen.flush(); screen.unmount();
  });
}

test('Reports actual handlers accept a silent cache refresh and unlock Print', async () => {
  const response = deferred();
  const screen = mountScreen('reports', { reports: () => response.promise });
  screen.render();
  const { startDate, endDate } = screen.props('ReportsHeader');
  cache.setCacheEntry(cache.CACHE_SLOTS.REPORTS, {
    userId: 'ADMIN-A', sessionGeneration: 1, queryParams: { startDate, endDate }, data: { kpis: { billed: 10 } },
  });
  await screen.flush();
  assert.equal(screen.props('ReportsHeader').printDisabled, true);
  response.resolve({ kpis: { billed: 20 }, clientRevenue: [] });
  await screen.flush();
  assert.equal(screen.props('ReportsHeader').printDisabled, false);
  assert.equal(screen.props('ReportsKpiBar').kpis.billed, 20);
  screen.unmount();
});

test('Reports actual hook resumes its real fetcher with captured authentication/query metadata', async () => {
  let reads = 0;
  const screen = mountScreen('reports', { reports: async () => ({ kpis: { billed: ++reads }, clientRevenue: [] }) });
  await screen.flush();
  const coordinator = screen.coordinators.get('reports');
  coordinator.setVisibility(false); screen.emit();
  await new Promise(resolve => setTimeout(resolve, 320));
  assert.equal(reads, 1);
  await coordinator.setVisibility(true); await screen.flush();
  assert.equal(reads, 2);
  assert.equal(screen.props('ReportsKpiBar').kpis.billed, 2);
  assert.equal(screen.props('ReportsHeader').printDisabled, false);
  screen.unmount();
});

test('Reports actual invalidation cancels and rejects a deferred response', async () => {
  const response = deferred();
  const screen = mountScreen('reports', { reports: () => response.promise });
  await screen.flush(); screen.invalidate();
  response.resolve({ kpis: { billed: 999 } }); await screen.flush();
  assert.equal(cache.getCacheStats().entryCount, 0);
  assert.equal(screen.props('ReportsHeader').printDisabled, true);
  assert.equal(screen.props('ReportsKpiBar').kpis, undefined);
  screen.unmount();
});

test('Reports actual preview failure keeps prior values stale and Print disabled', async () => {
  const response = deferred();
  const screen = mountScreen('reports', { reports: () => response.promise });
  screen.render();
  const { startDate, endDate } = screen.props('ReportsHeader');
  cache.setCacheEntry(cache.CACHE_SLOTS.REPORTS, {
    userId: 'ADMIN-A', sessionGeneration: 1, queryParams: { startDate, endDate }, data: { kpis: { billed: 10 } },
  });
  await screen.flush(); response.reject(new Error('Test report unavailable')); await screen.flush();
  assert.equal(screen.props('ReportsKpiBar').kpis.billed, 10);
  assert.equal(screen.props('ReportsHeader').printDisabled, true);
  assert.match(screen.text(), /Report metrics may be stale/);
  screen.unmount();
});

test('Reports actual date-change handler rejects the previous range response', async () => {
  const original = deferred();
  let reads = 0;
  const screen = mountScreen('reports', { reports: () => ++reads === 1 ? original.promise : Promise.resolve({ kpis: { billed: 20 } }) });
  await screen.flush();
  screen.props('ReportsHeader').onEndDateChange('2026-10-25');
  await screen.flush(); original.resolve({ kpis: { billed: 999 } }); await screen.flush();
  assert.equal(screen.props('ReportsKpiBar').kpis.billed, 20);
  assert.equal(screen.props('ReportsHeader').printDisabled, false);
  screen.unmount();
});

test('Dashboard actual cycle discovery is aborted and cannot repopulate after logout', async () => {
  const response = deferred();
  let signal;
  const screen = mountScreen('index', { cycles: options => { signal = options.signal; return response.promise; } });
  await screen.flush(); screen.invalidate();
  assert.equal(signal.aborted, true);
  response.resolve([{ isoDate: '2026-10-22' }]); await screen.flush();
  assert.equal(cache.getCacheStats().entryCount, 0);
  assert.equal(screen.props('CycleDropdown'), undefined);
  screen.unmount();
});

test('Tracking Logs actual handlers retain successful empty data as stale after resume failure', async () => {
  let reads = 0;
  const screen = mountScreen('tracking-logs', { logs: async () => {
    if (++reads > 1) throw new Error('Test refresh unavailable');
    return { content: [], page: { totalElements: 0 } };
  } });
  await screen.flush();
  const coordinator = screen.coordinators.get('tracking-logs');
  coordinator.setVisibility(false); screen.emit();
  await new Promise(resolve => setTimeout(resolve, 320));
  await coordinator.setVisibility(true); await screen.flush();
  assert.match(screen.text(), /Tracking logs may be stale/);
  assert.doesNotMatch(screen.text(), /Unable to load tracking logs/);
  screen.unmount();
});

test('coordinator snapshots queued metadata and cancellation permits a new request', async () => {
  const first = deferred();
  const accepted = [];
  const coordinator = requests.createRequestCoordinator({ onSuccess: (data, metadata) => accepted.push(metadata) });
  const auth = { userId: 'A', sessionGeneration: 1 };
  const query = { cycle: 'first' };
  const pending = coordinator.request('same', () => first.promise, { requestAuth: auth, requestQuery: query });
  await coordinator.request('same', async () => ({}), { requestAuth: auth, requestQuery: query });
  auth.userId = 'changed'; query.cycle = 'changed';
  first.resolve({}); await pending; await new Promise(resolve => setImmediate(resolve));
  assert.equal(accepted.length, 2);
  assert.equal(accepted[1].requestAuth.userId, 'A');
  assert.equal(accepted[1].requestQuery.cycle, 'first');
  coordinator.cancel(); await coordinator.request('new', async () => ({}), {});
  assert.equal(accepted.length, 3);
});

test('response acceptance rejects authenticated but unverified sessions', () => {
  const auth = { isAuthenticated: true, isVerified: true, userId: 'A', sessionGeneration: 1 };
  assert.equal(cache.isResponseAcceptable({ requestAuth: auth, requestQuery: {}, currentAuth: { ...auth, isVerified: false }, activeQuery: {} }), false);
});

test('actual client login, password change, renewal, and logout enforce session/cache boundaries', async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = expiration => `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'admin', uid: 'A', role: 'ADMIN', ver: 1, auth_time: now, exp: expiration })).toString('base64url')}.signature`;
  const activeToken = token(now + 1200);
  const response = { token: activeToken, userId: 'A', role: 'ADMIN' };
  const apiClient = { interceptors: { request: { use() {} }, response: { use() {} } }, post: async () => ({ data: response }) };
  const axios = { create: () => apiClient, post: async () => ({ data: response }) };
  const client = loadProductionModule('../src/services/api/client.js', dependency => {
    if (dependency === 'axios') return axios;
    if (dependency === 'react-native') return { Platform: { OS: 'test' } };
    if (dependency.endsWith('/responseCache.mjs')) return cache;
    if (dependency.endsWith('/sessionCore.mjs')) return sessionCore;
    throw new Error(`Unexpected dependency ${dependency}`);
  });
  client.setToken(activeToken); client.setCurrentUser({ userId: 'A', role: 'ADMIN' });
  assert.equal(client.getSessionAuthContext().isVerified, false);
  await client.login('admin', 'test-only');
  const auth = client.getSessionAuthContext();
  assert.equal(auth.isVerified, true);
  cache.setCacheEntry(cache.CACHE_SLOTS.REPORTS, { ...auth, queryParams: {}, data: {} });
  client.handleSlidingTokenRenewal(token(now + 1800), activeToken, auth.sessionGeneration);
  assert.equal(cache.getCacheStats().entryCount, 1);
  await client.changePassword('old-test-only', 'new-test-only');
  assert.equal(cache.getCacheStats().entryCount, 0);
  assert.equal(client.getSessionAuthContext().sessionGeneration, auth.sessionGeneration + 1);
  client.logout(); assert.equal(client.getSessionAuthContext().isVerified, false);
});
