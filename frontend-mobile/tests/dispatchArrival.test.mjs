import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as scanner from '../src/features/scanner/scannerFlow.mjs';
import * as shipments from '../src/features/waybills/shipmentOptionsFlow.mjs';
import * as options from '../src/features/waybills/waybillOptionsFlow.mjs';
import * as returns from '../src/features/waybills/waybillReturnFlow.mjs';
import * as vehicleOptions from '../src/features/scanner/vehicleOptionsFlow.mjs';
import * as access from '../src/features/auth/services/roleAccess.mjs';

const require = createRequire(import.meta.url);
const { code } = require('@babel/core').transformSync(
  readFileSync(new URL('../src/app/(main)/waybills.js', import.meta.url), 'utf8'), {
    configFile: false, babelrc: false,
    plugins: [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')],
  }
);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
};
const parcelId = (index) => `TRK-2026-${String(index).padStart(6, '0')}`;
const context = (trackingId) => ({ trackingId, shipmentId: `SHP-${trackingId}`, currentStatusCode: 'LOADED_ON_TRUCK', nextStatusCode: 'ARRIVED_AT_TNL', canScan: true, lost: false });

// Execute the production screen; only API, React scheduling, and native boundaries are mocked.
function mount(screenKind = 'dispatch') {
  const slots = [];
  let cursor = 0, dirty = true, tree, effects = [], mounted = true;
  let user = { userId: 'DISPATCH', role: screenKind === 'courier' ? 'COURIER_STAFF' : 'DISPATCH_STAFF' };
  let online = true;
  const listeners = new Map();
  const haptics = [];
  const calls = { lookups: [], batches: [], shipmentOptions: 0, navigation: [] };
  let lookup = async (trackingId) => context(trackingId);
  let submit = async () => [];
  let readWaybill = async (waybillId) => ({ waybillId, status: 'SENT_TO_HAULER', manifestRevision: 0, parcels: [] });
  let available = async () => Array.from({ length: 110 }, (_, index) => ({ trackingId: parcelId(index + 1) }));
  const changed = (previous, next) => !previous || !next || previous.some((value, index) => value !== next[index]);
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, (value) => {
        assert.ok(mounted, 'No state writes after unmount');
        slots[index].value = typeof value === 'function' ? value(slots[index].value) : value;
        dirty = true;
      }];
    },
    useReducer(reducer, initial) { const [value, update] = react.useState(initial); return [value, (action) => update((previous) => reducer(previous, action))]; },
    useRef(initial) { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
    useMemo(factory, dependencies) {
      const index = cursor++;
      if (!slots[index] || changed(slots[index].dependencies, dependencies)) slots[index] = { value: factory(), dependencies };
      return slots[index].value;
    },
    useCallback(callback, dependencies) { return react.useMemo(() => callback, dependencies); },
    useEffect(effect, dependencies) {
      const index = cursor++;
      if (!slots[index] || changed(slots[index].dependencies, dependencies)) {
        const previous = slots[index];
        slots[index] = { dependencies, cleanup: previous?.cleanup };
        effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect(); });
      }
    },
  };
  class AnimatedValue { setValue() {} stopAnimation(callback) { callback?.(280); } }
  const native = new Proxy({
    StyleSheet: { create: (styles) => styles }, Platform: { OS: 'android' },
    Animated: { Value: AnimatedValue, View: 'AnimatedView', spring: () => ({ start() {} }) },
    Keyboard: { dismiss() {}, addListener: () => ({ remove() {} }) },
    PanResponder: { create: () => ({ panHandlers: {} }) },
  }, { get: (target, key) => target[key] || key });
  const navigation = {
    addListener: (event, handler) => { listeners.set(event, handler); return () => listeners.delete(event); },
    dispatch: (action) => calls.navigation.push(action),
  };
  const router = { replace() {} };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', screenKind === 'courier' ? require('@babel/core').transformSync(readFileSync(new URL('../src/app/(main)/scan.js', import.meta.url), 'utf8'), {configFile: false, babelrc: false, plugins: [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')]}).code : code)((dependency) => {
    if (dependency === 'react') return react;
    if (dependency === 'react-native') return native;
    if (dependency === 'expo-router') return {
      useRouter: () => router, useNavigation: () => navigation,
      useFocusEffect: (callback) => react.useEffect(callback, [callback]),
    };
    if (dependency === 'expo-camera') return { useCameraPermissions: () => [{ granted: true }, () => {}] };
    if (dependency.endsWith('netinfo')) return { useNetInfo: () => ({ isConnected: online, isInternetReachable: online }) };
    if (dependency === 'expo-crypto') return { randomUUID: () => 'request-key' };
    if (dependency.endsWith('AuthContext')) return { useAuth: () => ({ user, isLoading: false }) };
    if (dependency.endsWith('trackingScanApi')) return { trackingScanApi: {
      submitSingleScan: async (payload) => ({ trackingId: payload.trackingId, transitionApplied: true, newStatusCode: payload.targetStatus }),
      listVehicleOptions: async () => ({ content: [], last: true }),
      getScanContext: (trackingId) => { calls.lookups.push(trackingId); return lookup(trackingId); },
      submitBatchScan: (payload) => { calls.batches.push(payload); return submit(payload); },
    } };
    if (dependency.endsWith('ScanFeedbackBanner')) return { __esModule: true, default: 'ScanFeedbackBanner' };
    if (dependency.endsWith('vehicleOptionsFlow.mjs')) return vehicleOptions;
    if (dependency.endsWith('scannerFlow.mjs')) return scanner;
    if (dependency.endsWith('shipmentOptionsFlow.mjs')) return shipments;
    if (dependency.endsWith('waybillOptionsFlow.mjs')) return options;
    if (dependency.endsWith('waybillReturnFlow.mjs')) return returns;
    if (dependency.endsWith('roleAccess.mjs')) return access;
    if (dependency.endsWith('waybillApi')) return {
      getWaybill: (waybillId) => readWaybill(waybillId),
      listShipmentOptions: async () => { calls.shipmentOptions += 1; return { content: [] }; },
      listWaybillOptions: async () => ({ content: [] }),
      listAvailableUnits: (shipmentId) => available(shipmentId),
      listShipmentWaybills: async () => [],
    };
    if (dependency.endsWith('/haptics')) return { safeHaptics: Object.fromEntries(['selection', 'success', 'error', 'warning'].map((kind) => [kind, () => haptics.push(kind)])) };
    if (dependency.endsWith('/theme')) return { colors: {}, typography: {}, spacing: {}, radius: {} };
    return { SafeAreaView: 'SafeAreaView', Icon: 'Icon', default: 'ScanViewfinder', __esModule: true };
  }, module, module.exports);
  const render = () => {
    for (let iteration = 0; dirty; iteration += 1) {
      assert.ok(iteration < 30, 'Render settles');
      dirty = false; cursor = 0; tree = module.exports.default();
      for (const effect of effects.splice(0)) effect();
    }
    return tree;
  };
  return {
    calls, render, haptics,
    setWaybill: (operation) => { readWaybill = operation; },
    setAvailable: (operation) => { available = operation; },
    async flush() { for (let index = 0; index < 12; index += 1) { await Promise.resolve(); render(); } },
    setLookup: (operation) => { lookup = operation; }, setSubmit: (operation) => { submit = operation; },
    setOnline: (value) => { online = value; dirty = true; render(); },
    setUser: (value) => { user = value; dirty = true; render(); },
    navigate(action) { let prevented = false; listeners.get('beforeRemove')?.({ preventDefault() { prevented = true; }, data: { action } }); render(); return prevented; },
    unmount() { for (const slot of slots) slot?.cleanup?.(); mounted = false; },
  };
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  if (tree.type === 'Modal' && !tree.props.visible) return [];
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('');
  if (tree == null || typeof tree === 'boolean') return '';
  if (tree?.type === 'ScanFeedbackBanner') return tree.props.message || '';
  return typeof tree === 'object' ? text(tree.props?.children) : String(tree);
}
function button(screen, label) {
  const found = nodes(screen.render()).find((node) => node.props.onPress && text(node) === label);
  assert.ok(found, `Button exists: ${label}`);
  return found.props;
}
function input(screen) { return nodes(screen.render()).find((node) => node.props.accessibilityLabel === 'Arrival tracking ID').props; }
async function add(screen, value) {
  input(screen).onChangeText(value); screen.render();
  await button(screen, 'ADD ARRIVAL').onPress(); screen.render();
}
async function arrival() {
  const screen = mount(); screen.render(); await screen.flush();
  assert.ok(button(screen, 'LOAD & GENERATE'));
  button(screen, 'ARRIVE AT TNL').onPress(); screen.render();
  return screen;
}

test('production dispatch screen queues manual and camera parcels across shipments, confirms atomically, and refreshes loading options', async () => {
  const screen = await arrival();
  await add(screen, ` ${parcelId(1).toLowerCase()} `);
  const camera = nodes(screen.render()).find((node) => node.props.onBarcodeScanned);
  assert.equal(camera.props.cameraActive, true);
  await camera.props.onBarcodeScanned({ data: parcelId(2) }); screen.render();
  assert.match(text(screen.render()), /SHP-TRK-2026-000001/);
  assert.match(text(screen.render()), /LOADED_ON_TRUCK/);
  assert.equal(screen.calls.batches.length, 0);
  await button(screen, 'Confirm Arrival at TNL').onPress(); screen.render();
  assert.deepEqual(screen.calls.batches[0].trackingIds, [parcelId(1), parcelId(2)]);
  assert.equal(screen.calls.batches[0].targetStatus, 'ARRIVED_AT_TNL');
  assert.equal(screen.calls.batches[0].vehicleId, undefined);
  assert.match(text(screen.render()), /ARRIVAL QUEUE \(0\/100\)/);
  const previous = screen.calls.shipmentOptions;
  button(screen, 'LOAD & GENERATE').onPress(); await screen.flush();
  assert.equal(screen.calls.shipmentOptions, previous + 1);
});

test('production arrival rejects malformed, missing, lost, ineligible, duplicate, and 101st parcels', async () => {
  const screen = await arrival();
  await add(screen, 'SHP-INVALID'); assert.equal(screen.calls.lookups.length, 0);
  screen.setLookup(async () => { throw new Error('Missing'); });
  await add(screen, parcelId(1)); assert.match(text(screen.render()), /Failed to verify/);
  for (const invalid of [{ lost: true }, { canScan: false }, { currentStatusCode: 'QR_GENERATED' }]) {
    screen.setLookup(async (trackingId) => ({ ...context(trackingId), ...invalid }));
    await add(screen, parcelId(1));
    assert.match(text(screen.render()), /ARRIVAL QUEUE \(0\/100\)/);
  }
  screen.setLookup(async (trackingId) => context(trackingId));
  for (let index = 1; index <= 100; index += 1) await add(screen, parcelId(index));
  const lookups = screen.calls.lookups.length;
  await add(screen, parcelId(1)); assert.match(text(screen.render()), /already in the arrival queue/);
  await add(screen, parcelId(101)); assert.match(text(screen.render()), /maximum 100/);
  assert.equal(screen.calls.lookups.length, lookups);
});

test('arrival preserves failed queues, blocks offline and busy submissions, and prevents same-render duplicate submits', async () => {
  const screen = await arrival(); await add(screen, parcelId(1));
  screen.setSubmit(async () => { throw new Error('Timeout'); });
  await button(screen, 'Confirm Arrival at TNL').onPress(); screen.render();
  assert.match(text(screen.render()), /Queue retained/);
  screen.setOnline(false);
  assert.equal(button(screen, 'Confirm Arrival at TNL').disabled, true);
  await button(screen, 'Confirm Arrival at TNL').onPress();
  assert.equal(screen.calls.batches.length, 1);
  screen.setOnline(true);
  const request = deferred(); screen.setSubmit(() => request.promise);
  const handler = button(screen, 'Confirm Arrival at TNL').onPress;
  const pending = handler(); await handler(); screen.render();
  assert.equal(screen.calls.batches.length, 2);
  assert.equal(button(screen, 'LOAD & GENERATE').disabled, true);
  assert.equal(button(screen, 'Confirm Arrival at TNL').disabled, true);
  request.resolve([]); await pending; screen.render();
  assert.match(text(screen.render()), /ARRIVAL QUEUE \(0\/100\)/);
});

test('arrival confirms discard on mode and route exits, cancel retains queue', async () => {
  const screen = await arrival(); await add(screen, parcelId(1));
  button(screen, 'RETURNED WAYBILL').onPress(); screen.render();
  assert.ok(button(screen, 'Keep arrival queue'));
  button(screen, 'Keep arrival queue').onPress(); screen.render();
  assert.match(text(screen.render()), /ARRIVAL QUEUE \(1\/100\)/);
  assert.equal(screen.navigate({ type: 'GO_BACK' }), true);
  button(screen, 'Discard arrival queue').onPress(); screen.render();
  assert.deepEqual(screen.calls.navigation, [{ type: 'GO_BACK' }]);
  assert.equal(screen.calls.batches.length, 0);
});

test('arrival ignores obsolete lookups after tab changes, logout, account switch, and unmount', async () => {
  for (const leave of [
    (screen) => { button(screen, 'LOAD & GENERATE').onPress(); screen.render(); },
    (screen) => screen.setUser(null),
    (screen) => screen.setUser({ userId: 'OTHER', role: 'DISPATCH_STAFF' }),
    (screen) => screen.unmount(),
  ]) {
    const screen = await arrival();
    const request = deferred(); screen.setLookup(() => request.promise);
    input(screen).onChangeText(parcelId(1)); screen.render();
    const pending = button(screen, 'ADD ARRIVAL').onPress();
    leave(screen);
    request.resolve(context(parcelId(1))); await pending;
    assert.equal(screen.calls.batches.length, 0);
  }
});

test('obsolete arrival submission success and failure cannot clear another account queue or write after unmount', async () => {
  for (const shouldReject of [false, true]) {
    const screen = await arrival(); await add(screen, parcelId(1));
    const request = deferred(); screen.setSubmit(() => request.promise);
    const pending = button(screen, 'Confirm Arrival at TNL').onPress();
    screen.setUser({ userId: 'OTHER', role: 'DISPATCH_STAFF' });
    await add(screen, parcelId(2));
    if (shouldReject) request.reject(new Error('Obsolete failure')); else request.resolve([]);
    await pending; screen.render();
    assert.match(text(screen.render()), /ARRIVAL QUEUE \(1\/100\)/);
    assert.doesNotMatch(text(screen.render()), /Arrival at TNL confirmed|Queue retained/);
  }
  const screen = await arrival(); await add(screen, parcelId(1));
  const request = deferred(); screen.setSubmit(() => request.promise);
  const pending = button(screen, 'Confirm Arrival at TNL').onPress();
  screen.unmount(); request.resolve([]); await pending;
});

test('arrival discard invalidates pending lookups and remove restores queue capacity', async () => {
  const screen = await arrival(); await add(screen, parcelId(1));
  const request = deferred(); screen.setLookup(() => request.promise);
  input(screen).onChangeText(parcelId(2)); screen.render();
  const pending = button(screen, 'ADD ARRIVAL').onPress();
  button(screen, 'LOAD & GENERATE').onPress(); screen.render();
  button(screen, 'Discard arrival queue').onPress(); screen.render();
  request.resolve(context(parcelId(2))); await pending;
  button(screen, 'ARRIVE AT TNL').onPress(); screen.render();
  assert.match(text(screen.render()), /ARRIVAL QUEUE \(0\/100\)/);
  screen.setLookup(async (trackingId) => context(trackingId));
  await add(screen, parcelId(1));
  nodes(screen.render()).find((node) => node.props.accessibilityLabel === `Remove arrival ${parcelId(1)}`).props.onPress();
  screen.render();
  assert.equal(button(screen, 'Confirm Arrival at TNL').disabled, true);
  await add(screen, parcelId(1));
  assert.match(text(screen.render()), /ARRIVAL QUEUE \(1\/100\)/);
});

test('arrival reserves pending IDs and capacity before lookups settle, and never submits during verification', async () => {
  const screen = await arrival();
  const request = deferred(); screen.setLookup(() => request.promise);
  input(screen).onChangeText(parcelId(1)); screen.render();
  const handler = button(screen, 'ADD ARRIVAL').onPress;
  const pending = handler(); await handler(); screen.render();
  assert.equal(screen.calls.lookups.length, 1);
  assert.equal(button(screen, 'Confirm Arrival at TNL').disabled, true);
  request.resolve(context(parcelId(1))); await pending; screen.render();
  assert.match(text(screen.render()), /ARRIVAL QUEUE \(1\/100\)/);
});

async function scanLoading(screen, trackingId) {
  const camera = nodes(screen.render()).find((node) => node.props.onBarcodeScanned);
  assert.equal(camera.props.cameraActive, true);
  await camera.props.onBarcodeScanned({ data: trackingId });
  screen.render();
  await new Promise((resolve) => setTimeout(resolve, 610));
}

test('loading camera starts without selection and scanning opens and queues a parcel', async () => {
  const screen = mount(); screen.render(); await screen.flush();
  screen.setLookup(async (trackingId) => ({ ...context(trackingId), shipmentId: 'SHP-A', currentStatusCode: 'ARRIVED_AT_TNL' }));
  await scanLoading(screen, parcelId(1));
  assert.match(text(screen.render()), /SHP-A/);
  assert.match(text(screen.render()), /TRK-2026-000001 added to manifest queue/);
  assert.equal(screen.calls.batches.length, 0);
  await scanLoading(screen, parcelId(2));
  assert.match(text(screen.render()), /TRK-2026-000002 added to manifest queue/);
  await scanLoading(screen, parcelId(2));
  assert.match(text(screen.render()), /already in the manifest queue/);
  assert.deepEqual(screen.haptics, ['success', 'success', 'warning']);
});

test('loading scans confirm shipment switches and cancellation preserves the queue', async () => {
  const screen = mount(); screen.render(); await screen.flush();
  screen.setLookup(async (trackingId) => ({ ...context(trackingId), shipmentId: trackingId === parcelId(1) ? 'SHP-A' : 'SHP-B', currentStatusCode: 'ARRIVED_AT_TNL' }));
  await scanLoading(screen, parcelId(1));
  await scanLoading(screen, parcelId(2));
  assert.ok(button(screen, 'Switch shipment'));
  button(screen, 'Cancel').onPress(); screen.render();
  await scanLoading(screen, parcelId(1));
  assert.match(text(screen.render()), /already in the manifest queue/);
  await scanLoading(screen, parcelId(2));
  await button(screen, 'Switch shipment').onPress(); screen.render();
  assert.match(text(screen.render()), /TRK-2026-000002 added to manifest queue/);
  assert.equal(screen.calls.batches.length, 0);
});

test('loading ignores a lookup resolved after leaving Load & Generate', async () => {
  const screen = mount(); screen.render(); await screen.flush();
  const request = deferred(); screen.setLookup(() => request.promise);
  const camera = nodes(screen.render()).find((node) => node.props.onBarcodeScanned);
  const pending = camera.props.onBarcodeScanned({ data: parcelId(1) });
  screen.setUser({ userId: 'OTHER', role: 'DISPATCH_STAFF' });
  request.resolve({ ...context(parcelId(1)), currentStatusCode: 'ARRIVED_AT_TNL' });
  await pending; screen.render();
  assert.doesNotMatch(text(screen.render()), /added to manifest queue/);
});

test('failed replacement reads preserve the old shipment queue and allow retry', async () => {
  const screen = mount(); screen.render(); await screen.flush();
  screen.setLookup(async (trackingId) => ({ ...context(trackingId), shipmentId: trackingId === parcelId(1) ? 'SHP-A' : 'SHP-B', currentStatusCode: 'ARRIVED_AT_TNL' }));
  await scanLoading(screen, parcelId(1));
  await scanLoading(screen, parcelId(2));
  screen.setAvailable(async () => { throw new Error('Read failed'); });
  await button(screen, 'Switch shipment').onPress(); screen.render();
  assert.match(text(screen.render()), /Could not open shipment/);
  button(screen, 'Cancel').onPress(); screen.render();
  await scanLoading(screen, parcelId(1));
  assert.match(text(screen.render()), /already in the manifest queue/);
});

test('ineligible scanned parcels open their shipment without being queued; malformed and missing scans preserve selection', async () => {
  const screen = mount(); screen.render(); await screen.flush();
  screen.setLookup(async (trackingId) => ({ ...context(trackingId), shipmentId: 'SHP-LOST', lost: true }));
  await scanLoading(screen, parcelId(1));
  assert.match(text(screen.render()), /SHP-LOST/);
  assert.match(text(screen.render()), /lost/);
  assert.doesNotMatch(text(screen.render()), /added to manifest queue/);
  await scanLoading(screen, 'invalid');
  assert.equal(screen.calls.lookups.length, 1);
  screen.setLookup(async () => { throw new Error('Missing parcel'); });
  await scanLoading(screen, parcelId(2));
  assert.match(text(screen.render()), /Missing parcel/);
  assert.match(text(screen.render()), /SHP-LOST/);
  screen.setOnline(false);
  assert.equal(nodes(screen.render()).find((node) => node.props.onBarcodeScanned).props.cameraActive, false);
});

test('parcel lookup keeps the preview active and rejected status produces error feedback', async () => {
  const screen = mount(); screen.render(); await screen.flush();
  const request = deferred(); screen.setLookup(() => request.promise);
  const camera = () => nodes(screen.render()).find((node) => node.props.onBarcodeScanned);
  const pending = camera().props.onBarcodeScanned({ data: parcelId(1) });
  assert.equal(camera().props.cameraActive, true, 'Lookup must not unmount the preview');
  request.resolve(context(parcelId(1)));
  await pending; screen.render();
  assert.equal(camera().props.cameraActive, true);
  assert.deepEqual(screen.haptics, ['error']);
});

test('first accepted parcel scan produces success feedback', async () => {
  const screen = mount(); screen.render(); await screen.flush();
  screen.setLookup(async (trackingId) => ({ ...context(trackingId), currentStatusCode: 'ARRIVED_AT_TNL' }));
  await scanLoading(screen, parcelId(1));
  assert.deepEqual(screen.haptics, ['success']);
});

test('switch shipment action appears above cancel', async () => {
  const screen = mount(); screen.render(); await screen.flush();
  screen.setLookup(async (trackingId) => ({ ...context(trackingId), currentStatusCode: 'ARRIVED_AT_TNL' }));
  await scanLoading(screen, parcelId(1));
  await scanLoading(screen, parcelId(2));
  const labels = nodes(screen.render()).filter((node) => node.props.onPress).map(text);
  assert.ok(labels.indexOf('Switch shipment') < labels.indexOf('Cancel'));
});

function feedback(screen) { return nodes(screen.render()).find((node) => node.type === 'ScanFeedbackBanner').props; }

test('arrival reports checking, queue count, duplicates, and confirmed arrival separately', async () => {
  const screen = await arrival();
  const request = deferred(); screen.setLookup(() => request.promise);
  input(screen).onChangeText(parcelId(1)); screen.render();
  const pending = button(screen, 'ADD ARRIVAL').onPress();
  assert.equal(feedback(screen).kind, 'loading');
  assert.match(feedback(screen).message, /Checking parcel/);
  request.resolve(context(parcelId(1))); await pending;
  assert.equal(feedback(screen).kind, 'success');
  assert.match(feedback(screen).message, /added to arrival queue. 1 queued/);
  assert.deepEqual(screen.haptics, ['success']);
  assert.equal(screen.calls.batches.length, 0);
  await add(screen, parcelId(1));
  assert.equal(feedback(screen).kind, 'warning');
  assert.deepEqual(screen.haptics, ['success', 'warning']);
  feedback(screen).onDismiss(); screen.render();
  await button(screen, 'Confirm Arrival at TNL').onPress();
  assert.equal(feedback(screen).message, 'Arrival at TNL confirmed.');
});

test('courier single scan reports checking and review before a confirmed status update', async () => {
  const screen = mount('courier'); screen.render(); await screen.flush();
  const request = deferred(); screen.setLookup(() => request.promise);
  const camera = nodes(screen.render()).find((node) => node.props.onBarcodeScanned);
  const pending = camera.props.onBarcodeScanned({ data: parcelId(1) });
  assert.equal(feedback(screen).kind, 'loading');
  request.resolve({ ...context(parcelId(1)), currentStatusCode: 'QR_GENERATED', nextStatusCode: 'LOADED_ON_TRUCK', requiresVehicle: true });
  await pending; await screen.flush();
  assert.equal(feedback(screen).kind, 'info');
  assert.match(feedback(screen).message, /status unchanged/);
  let review = nodes(screen.render()).find((node) => node.props.onConfirm);
  review.props.onSelectVehicle('VH-TEST'); screen.render();
  review = nodes(screen.render()).find((node) => node.props.onConfirm);
  await review.props.onConfirm(); screen.render();
  assert.equal(feedback(screen).message, 'Truck loading recorded.');
});

test('courier batch scan reports queue count while keeping status confirmation separate', async () => {
  const screen = mount('courier'); screen.render(); await screen.flush();
  button(screen, 'RAPID BATCH').onPress(); screen.render();
  let panel = nodes(screen.render()).find((node) => node.props.onSelectOperation);
  panel.props.onSelectOperation('LOADED_ON_TRUCK'); screen.render();
  panel = nodes(screen.render()).find((node) => node.props.onSelectOperation);
  panel.props.onSelectVehicle('VH-TEST'); screen.render();
  screen.setLookup(async (trackingId) => ({ ...context(trackingId), currentStatusCode: 'QR_GENERATED', nextStatusCode: 'LOADED_ON_TRUCK' }));
  const camera = nodes(screen.render()).find((node) => node.props.onBarcodeScanned);
  await camera.props.onBarcodeScanned({ data: parcelId(1) }); await screen.flush();
  assert.equal(feedback(screen).kind, 'success');
  assert.match(feedback(screen).message, /added to queue. 1 queued/);
  assert.deepEqual(screen.haptics, ['success']);
  assert.equal(screen.calls.batches.length, 0);
  screen.unmount();
});

test('courier rejects a later-status parcel without advertising a successful status change', async () => {
  const screen = mount('courier'); screen.render(); await screen.flush();
  screen.setLookup(async (trackingId) => context(trackingId));
  await nodes(screen.render()).find((node) => node.props.onBarcodeScanned).props.onBarcodeScanned({ data: parcelId(1) });
  await screen.flush();
  assert.equal(feedback(screen).kind, 'error');
  assert.match(feedback(screen).message, /not eligible/);
});

test('returned waybill scan reports checking and QR confirmation without claiming completion', async () => {
  const screen = mount(); screen.render(); await screen.flush();
  button(screen, 'RETURNED WAYBILL').onPress(); screen.render(); await screen.flush();
  const request = deferred(); screen.setWaybill(() => request.promise);
  const camera = nodes(screen.render()).find((node) => node.props.onBarcodeScanned);
  const pending = camera.props.onBarcodeScanned({ data: 'WAYBILL:WYB-2026-0001' });
  assert.equal(feedback(screen).kind, 'loading');
  request.resolve({ waybillId: 'WYB-2026-0001', status: 'SENT_TO_HAULER', manifestRevision: 0, parcels: [] });
  await pending; screen.render();
  assert.equal(feedback(screen).kind, 'success');
  assert.match(feedback(screen).message, /return confirmed. Review the manifest/);
  assert.doesNotMatch(feedback(screen).message, /waybill completed/i);
  assert.equal(screen.calls.batches.length, 0);
});

test('returned scans open generated and completed waybills for review without unlocking completion', async () => {
  for (const status of ['GENERATED', 'SIGNED_COMPLETED']) {
    const screen = mount(); screen.render(); await screen.flush();
    button(screen, 'RETURNED WAYBILL').onPress(); screen.render(); await screen.flush();
    screen.setWaybill(async (waybillId) => ({ waybillId, shipmentId: 'SHP-REVIEW', status, manifestRevision: 1, parcels: [] }));
    await nodes(screen.render()).find((node) => node.props.onBarcodeScanned).props.onBarcodeScanned({ data: 'WAYBILL:WYB-2026-0001' });
    screen.render();
    assert.match(text(screen.render()), /WAYBILL MANIFEST/);
    assert.match(text(screen.render()), /SHP-REVIEW/);
    assert.match(feedback(screen).message, /opened for review/);
    assert.doesNotMatch(feedback(screen).message, /return confirmed|can be completed/);
    assert.equal(nodes(screen.render()).some((node) => node.props.onPress && /COMPLETE WAYBILL/.test(text(node))), false);
    assert.equal(screen.calls.batches.length, 0);
    assert.deepEqual(screen.haptics, ['success']);
  }
});
