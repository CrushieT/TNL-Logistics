import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as cache from '../src/services/api/responseCache.mjs';
import * as requests from '../src/services/api/requestCoordinator.mjs';
import * as waybillDirectory from '../src/features/waybills/waybillDirectory.mjs';
import * as statementModel from '../src/features/collections/utils/statementPrintModel.mjs';
import * as sessionCore from '../src/services/api/sessionCore.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');
const plugins = [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')];

export function loadProductionModule(path, resolveImport) {
  const filename = new URL(path, import.meta.url);
  const { code } = transformSync(readFileSync(filename, 'utf8'), {
    filename: filename.pathname, configFile: false, babelrc: false, plugins,
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(resolveImport, module, module.exports);
  return module.exports;
}

export function deferred() {
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
export function mountScreen(name, api = {}, initialAuth = {}, onSubscribe) {
  const slots = [];
  let cursor = 0;
  let dirty = true;
  let tree;
  let pendingEffects = [];
  let searchParams = { ...api.searchParams };
  let auth = { isAuthenticated: true, isVerified: true, userId: 'ADMIN-A', sessionGeneration: 1, ...initialAuth };
  const sessionListeners = new Set();
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
        slots[index] = { deps, effect, cleanup: previous?.cleanup };
        pendingEffects.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect(); });
      }
    },
  };
  const react = { __esModule: true, default: hooks, ...hooks };
  const native = componentModule({ StyleSheet: { create: value => value }, Platform: { OS: 'web' }, useWindowDimensions: () => ({ width: 1200, height: 900 }) });
  const hook = loadProductionModule('../src/services/api/useRequestCoordinator.js', dependency => dependency === 'react' ? react : dependency.endsWith('/responseCache.mjs') ? cache : {
    ...requests, createRequestCoordinator(options) {
      const coordinator = requests.createRequestCoordinator(options);
      coordinators.set(options.scope, coordinator);
      return coordinator;
    },
  });
  const cycleList = [{ isoDate: '2026-10-22', label: 'Current Cycle' }];
  const subscribeRealtimeEvents = listener => { realtimeListeners.add(listener); return () => realtimeListeners.delete(listener); };
  const authModule = {
    default: { get: api.clientGet || (async () => ({ data: [] })) },
    get: api.clientGet || (async () => ({ data: [] })),
    getSessionAuthContext: () => ({ ...auth }),
    onSessionChanged: listener => {
      sessionListeners.add(listener);
      if (onSubscribe) auth = { ...auth, ...onSubscribe() };
      return () => sessionListeners.delete(listener);
    },
    onSessionInvalidated: listener => { invalidationListeners.add(listener); return () => invalidationListeners.delete(listener); },
  };
  const verifiedSessionHook = loadProductionModule('../src/services/api/useVerifiedAdminSession.js', dependency => dependency === 'react' ? react : authModule);
  const cachedHook = loadProductionModule('../src/services/api/useCachedPreview.js', dependency => {
    if (dependency === 'react') return react;
    if (dependency === './client') return authModule;
    if (dependency === './useVerifiedAdminSession') return verifiedSessionHook;
    if (dependency === './useRequestCoordinator') return hook;
    if (dependency === './sseClient') return { subscribeRealtimeEvents };
    if (dependency === './responseCache.mjs') return cache;
    throw new Error(dependency);
  });
  const Screen = loadProductionModule(name.startsWith('features/') ? `../src/${name}` : `../src/app/${name}.js`, dependency => {
    if (dependency.endsWith('/statementPrintModel.mjs')) return statementModel;
    if (dependency.endsWith('/useCachedPreview')) return cachedHook;
    if (dependency === 'react') return react;
    if (dependency === 'react-native') return native;
    if (dependency === 'expo-router') return { useRouter: () => ({ push() {} }), useLocalSearchParams: () => searchParams };
    if (dependency.endsWith('/responseCache.mjs')) return cache;
    if (dependency.endsWith('/requestCoordinator.mjs')) return requests;
    if (dependency.endsWith('/useRequestCoordinator')) return hook;
    if (dependency.endsWith('/useVerifiedAdminSession')) return verifiedSessionHook;
    if (dependency.endsWith('/api/client')) return authModule;
    if (dependency.endsWith('/theme')) return { colors: new Proxy({}, { get: () => '#111' }), fonts: {}, spacing: {}, radius: {}, type: {} };
    return componentModule({
      subscribeRealtimeEvents,
      ...waybillDirectory,
      listShipments: api.shipments || (async () => ({ content: [] })),
      listVehicles: api.vehicles || (async () => []),
      listClients: api.clients || (async () => []),
      listWaybills: api.waybills || (async () => ({ content: [] })),
      getShipmentPaymentHistory: api.paymentSummary || (async () => ({ balance: 100 })),
      listPaymentShipments: api.payments || (async () => ({ content: [] })),
      getStatementPreview: api.statements || (async () => ({ items: [], totalCharges: 0 })),
      getAuthorizedCollectors: api.collectors || (async () => []),
      getDashboardSummary: api.dashboard || (async () => ({ shipmentCount: 10 })),
      getReportSummary: api.reports || (async () => ({ kpis: {}, clientRevenue: [] })),
      getWeeklyCollections: api.collections || (async () => ({ items: [] })),
      getActiveCollectionCycles: api.cycles || (async () => cycleList),
      getRecentThursdays: () => cycleList,
      listTrackingLogs: api.logs || (async () => ({ content: [], page: { totalElements: 0 } })),
      getTrackingMetrics: api.metrics || (async () => ({ todayTotalScans: 0 })),
      ...api,
    });
  }).default;
  function render() { cursor = 0; dirty = false; tree = Screen(api.props || {}); return tree; }
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
    return [node, ...nodes(node.props?.children), ...nodes(node.props?.right ?? null)];
  }
  return {
    render, flush, coordinators,
    changeRoute(next) { searchParams = { ...next }; dirty = true; },
    allProps: displayName => nodes().filter(node => node.type?.displayName === displayName).map(node => node.props),
    props: displayName => nodes().find(node => node.type?.displayName === displayName)?.props,
    text: () => JSON.stringify(tree),
    emit: (event = { type: 'STATUS_UPDATE', data: {} }) => {
      cache.invalidateBusinessEvent(event.type);
      realtimeListeners.forEach(listener => listener(event));
    },
    changeSession(next = {}) {
      auth = { ...auth, ...next };
      sessionListeners.forEach(listener => listener());
    },
    replayEffects() {
      slots.forEach(slot => slot?.cleanup?.());
      slots.forEach(slot => { if (slot?.effect) slot.cleanup = slot.effect(); });
    },
    invalidate() {
      auth = { isAuthenticated: false, isVerified: false, userId: null, sessionGeneration: 2 };
      cache.clearAllCache(); invalidationListeners.forEach(listener => listener());
      sessionListeners.forEach(listener => listener());
    },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

