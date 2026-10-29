import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');
const plugins = [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')];

function loadModule(path, resolveImport, timers = globalThis) {
  const { code } = transformSync(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    configFile: false, babelrc: false, plugins,
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', '__DEV__', 'setTimeout', 'clearTimeout', code)(resolveImport, module, module.exports, true, timers.setTimeout, timers.clearTimeout);
  return module.exports;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

// Execute production hooks and JSX; native rendering and layout require device acceptance.
function mountPrinter(options = {}) {
  const storage = options.storage || new Map();
  const appListeners = new Set();
  const nativeListeners = new Set();
  const disconnects = [];
  const permissionRequests = [];
  const auditEntries = [];
  let permissionGranted = options.permissionGranted ?? true;
  let bluetoothEnabled = options.bluetoothEnabled ?? true;
  let user = options.user === undefined ? { userId: 'TEST' } : options.user;
  let isAuthenticated = options.isAuthenticated ?? Boolean(user);
  const appState = {
    currentState: options.appState || 'active',
    addEventListener(event, listener) { appListeners.add(listener); return { remove: () => appListeners.delete(listener) }; },
  };
  let activeRender;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    createContext: () => ({ Provider: 'Provider' }),
    useContext: (context) => context.current,
    useState: (...args) => activeRender.useState(...args),
    useRef: (...args) => activeRender.useRef(...args),
    useCallback: (...args) => activeRender.useCallback(...args),
    useEffect: (...args) => activeRender.useEffect(...args),
  };
  function renderer(component) {
    const slots = [];
    const effects = [];
    let cursor = 0;
    const hooks = {
      useState(initial) {
        const index = cursor++;
        slots[index] ??= { value: initial };
        return [slots[index].value, (value) => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
      },
      useRef(initial) {
        const index = cursor++;
        slots[index] ??= { current: initial };
        return slots[index];
      },
      useCallback(callback, dependencies) {
        const index = cursor++;
        if (!slots[index] || dependencies.some((value, offset) => !Object.is(value, slots[index].dependencies[offset]))) {
          slots[index] = { callback, dependencies };
        }
        return slots[index].callback;
      },
      useEffect(effect, dependencies) {
        const index = cursor++;
        if (!slots[index] || dependencies.some((value, offset) => !Object.is(value, slots[index].dependencies[offset]))) {
          const previous = slots[index];
          slots[index] = { dependencies };
          effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect(); });
        }
      },
    };
    return {
      render() { activeRender = hooks; cursor = 0; return component(); },
      async initialize() { await this.flush(); },
      async flush() {
        for (let index = 0; index < 60; index += 1) {
          for (const effect of effects.splice(0)) effect();
          await Promise.resolve();
        }
      },
      unmount() { for (const slot of slots) slot?.cleanup?.(); },
    };
  }
  let nextScan = async () => ({ paired: [], found: [], discoveryStarted: true });
  let nextConnection = options.connect || (async () => {});
  const calls = { scans: 0, connections: [], prints: 0, audits: 0 };
  const native = {
    BluetoothManager: {
      scanDevices: () => { calls.scans += 1; return nextScan(); },
      connect: (address) => { calls.connections.push(address); return nextConnection(); },
      isBluetoothEnabled: async () => bluetoothEnabled,
      disconnect: async (address) => { disconnects.push(address); await options.disconnect?.(address); },
    },
    BluetoothTscPrinter: { printLabel: async () => { calls.prints += 1; await options.print?.(); } },
  };
  const serviceModule = loadModule('../src/features/printer/services/bluetoothPrinterService.js', (dependency) => {
    if (dependency === 'react-native') return {
      Platform: { OS: 'android', Version: options.apiLevel || 36 },
      DeviceEventEmitter: { addListener: (event, listener) => { nativeListeners.add(listener); return { remove: () => nativeListeners.delete(listener) }; } },
      PermissionsAndroid: {
        PERMISSIONS: { BLUETOOTH_SCAN: 'SCAN', BLUETOOTH_CONNECT: 'CONNECT' },
        RESULTS: { GRANTED: 'granted' },
        check: async () => options.checkPermission ? options.checkPermission() : permissionGranted,
        requestMultiple: async (permissions) => {
          permissionRequests.push(permissions);
          return Object.fromEntries(permissions.map((permission) => [permission, permissionGranted ? 'granted' : 'denied']));
        },
      },
    };
    if (dependency.endsWith('secureStore')) return {
      getItem: async (key) => storage.get(key) ?? null,
      setItem: async (key, value) => { await options.writeStorage?.(key, value); storage.set(key, value); },
      deleteItem: async (key) => storage.delete(key),
    };
    if (dependency === 'react-native-bluetooth-escpos-printer') return options.missingBridge ? {} : native;
    throw new Error(`Unexpected service dependency: ${dependency}`);
  }, options.timers);
  const contextModule = loadModule('../src/features/printer/context/PrinterContext.js', (dependency) => {
    if (dependency === 'react') return react;
    if (dependency === 'react-native') return { AppState: appState };
    if (dependency.endsWith('bluetoothPrinterService')) return serviceModule;
    if (dependency.endsWith('AuthContext')) return { useAuth: () => ({ user, isAuthenticated }) };
    if (dependency.endsWith('/client')) return { apiClient: { get: async () => ({ data: { companyName: 'TNL' } }) } };
    if (dependency.endsWith('printAuditOutbox')) return {
      assertPrintAuditCapacityAvailable: async () => {},
      getPendingPrintAudits: async (ownerUserId) => (options.pendingAudits || []).filter((entry) => entry.ownerUserId === ownerUserId), getPendingCount: async () => 0,
      syncPrintAuditEntry: async ({ entry }) => { calls.audits += 1; auditEntries.push(entry); return 'SYNCED'; },
    };
    if (dependency.endsWith('thermalLabelData')) return {
      normalizeLabelData: (shipment, unit) => ({ ...unit, shipmentId: shipment.shipmentId }),
      resolveCurrentLabelBranding: (fetchBranding) => fetchBranding(),
    };
    if (dependency.endsWith('tsplFormatter')) return { buildTsplOptions: () => ({ width: 100, height: 150 }) };
    if (dependency === 'expo-crypto') return { randomUUID: () => 'TEST-JOB' };
    if (dependency.endsWith('shipmentApi')) return { shipmentApi: { printLabels: async () => { calls.audits += 1; } } };
    return {};
  });
  const provider = renderer(() => contextModule.PrinterProvider({ children: null }));
  function context() {
    const tree = provider.render();
    // Assign the context value through the production hook's context object.
    const previous = react.useContext;
    react.useContext = () => tree.props.value;
    const value = contextModule.usePrinter();
    react.useContext = previous;
    return value;
  }
  let currentContext;
  const screenModule = loadModule('../src/app/(main)/printer.js', (dependency) => {
    if (dependency === 'react') return react;
    if (dependency === 'react-native') return {
      StyleSheet: { create: (styles) => styles }, View: 'View', Text: 'Text', ScrollView: 'ScrollView', Switch: 'Switch', ActivityIndicator: 'ActivityIndicator',
    };
    if (dependency.endsWith('PrinterContext')) return { usePrinter: () => currentContext };
    if (dependency.endsWith('bluetoothPrinterService')) return serviceModule;
    if (dependency.endsWith('thermalLabelData')) return { normalizeLabelData: () => ({}) };
    if (dependency.endsWith('/theme')) return { colors: {}, typography: {} };
    const name = dependency.split('/').at(-1);
    return { [name]: name, SafeAreaView: 'SafeAreaView', Icon: 'Icon' };
  });
  const screen = renderer(() => screenModule.default());
  return {
    provider, context, calls, storage, disconnects, permissionRequests, auditEntries,
    service: serviceModule.bluetoothPrinterService,
    setPermission: (value) => { permissionGranted = value; },
    setBluetooth: (value) => { bluetoothEnabled = value; },
    async setUser(value) { user = value; isAuthenticated = Boolean(value); context(); await provider.flush(); },
    async setAuthenticated(value) { isAuthenticated = value; context(); await provider.flush(); },
    async appState(state) { appState.currentState = state; for (const listener of appListeners) listener(state); await provider.flush(); },
    async loseConnection() { for (const listener of nativeListeners) listener(); await provider.flush(); },
    listenerCounts: () => [appListeners.size, nativeListeners.size],
    setScan: (operation) => { nextScan = operation; },
    setConnection: (operation) => { nextConnection = operation; },
    screen() { currentContext = context(); return screen.render(); },
  };
}

function flatten(tree) {
  if (Array.isArray(tree)) return tree.flatMap(flatten);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...flatten(tree.props?.children)];
}
function button(tree, label) {
  return flatten(tree).find((node) => node.props?.onPress && flatten(node.props.children).some((child) => child.type === 'Text' && child.props.children.includes(label)));
}
function hasText(tree, text) {
  return flatten(tree).some((node) => node.type === 'Text' && node.props.children.includes(text));
}
const paired = { name: 'XP-470B', address: 'AA:BB' };
const notice = 'Discovery unavailable; showing paired devices.';

async function initialize(mount) {
  mount.context();
  await mount.provider.initialize();
}

test('actual provider and Printer screen show fallback, keep Connect explicit, and never print while scanning', async () => {
  const mount = mountPrinter();
  await initialize(mount);
  mount.setScan(async () => JSON.stringify({ paired: [paired], found: [], discoveryStarted: false }));
  await button(mount.screen(), 'Scan').props.onPress();
  let tree = mount.screen();
  assert.equal(hasText(tree, notice), true);
  assert.equal(hasText(tree, paired.name), true);
  const nodes = flatten(tree);
  assert.ok(nodes.findIndex((node) => node.type === 'Text' && node.props.children.includes(notice)) < nodes.findIndex((node) => node.type === 'Text' && node.props.children.includes(paired.name)));
  assert.equal(mount.context().isConnected, false);
  assert.equal(mount.context().isScanning, false);
  assert.deepEqual(mount.calls, { scans: 1, connections: [], prints: 0, audits: 0 });
  const connection = deferred();
  mount.setConnection(() => connection.promise);
  const pending = button(tree, 'Connect').props.onPress();
  await mount.provider.flush();
  assert.equal(mount.context().isConnecting, true);
  assert.equal(button(mount.screen(), 'Scan').props.disabled, true);
  connection.resolve();
  await pending;
  tree = mount.screen();
  assert.equal(mount.context().isConnecting, false);
  assert.equal(mount.context().isConnected, true);
  assert.equal(hasText(tree, 'CONNECTED'), true);
  assert.equal(flatten(tree).find((node) => node.type === 'StatusModal').props.title, 'Printer Connected');
  assert.deepEqual(mount.calls, { scans: 1, connections: ['AA:BB'], prints: 0, audits: 0 });
});

test('notice clears at new scan, on complete discovery, on failure, and on mode changes', async () => {
  const mount = mountPrinter();
  await initialize(mount);
  const fallback = async () => ({ paired: [paired], found: [], discoveryStarted: false });
  mount.setScan(fallback);
  const devices = await mount.context().scanDevices();
  assert.equal(Array.isArray(devices), true);
  assert.equal(mount.context().scanNotice, notice);
  const discovery = deferred();
  mount.setScan(() => discovery.promise);
  const pending = mount.context().scanDevices();
  assert.equal(mount.context().scanNotice, null);
  assert.equal(mount.context().isScanning, true);
  assert.equal(flatten(mount.screen()).some((node) => node.type === 'ActivityIndicator'), true);
  assert.equal(button(mount.screen(), 'Connect').props.disabled, true);
  await assert.rejects(mount.context().scanDevices(), /already in progress/);
  discovery.resolve({ paired: [paired], found: [], discoveryStarted: true });
  await pending;
  assert.equal(mount.context().scanNotice, null);
  assert.equal(mount.context().isScanning, false);
  mount.setScan(fallback);
  await mount.context().scanDevices();
  mount.setScan(async () => { throw new Error('Bluetooth permission denied'); });
  await button(mount.screen(), 'Scan').props.onPress();
  assert.equal(mount.context().scanNotice, null);
  assert.equal(mount.context().isScanning, false);
  assert.equal(flatten(mount.screen()).find((node) => node.type === 'StatusModal').props.title, 'Scan Failed');
  mount.setScan(fallback);
  await mount.context().scanDevices();
  await mount.context().toggleVirtualMode(true);
  assert.equal(mount.context().scanNotice, null);
  assert.equal(mount.context().availableDevices[0].type, 'VIRTUAL');
  assert.equal(mount.calls.prints, 0);
  assert.equal(mount.calls.audits, 0);
});

test('mode change ignores an obsolete scan and connection failures remain visible', async () => {
  const mount = mountPrinter();
  await initialize(mount);
  const discovery = deferred();
  mount.setScan(() => discovery.promise);
  const pending = mount.context().scanDevices();
  await mount.context().toggleVirtualMode(true);
  discovery.resolve({ paired: [paired], found: [], discoveryStarted: false });
  await pending;
  assert.equal(mount.context().scanNotice, null);
  assert.equal(mount.context().isScanning, false);
  assert.equal(mount.context().availableDevices[0].type, 'VIRTUAL');
  await mount.context().toggleVirtualMode(false);
  mount.setScan(async () => ({ paired: [paired], found: [], discoveryStarted: false }));
  await mount.context().scanDevices();
  mount.setConnection(async () => { throw Object.assign(new Error('Nearby devices denied'), { code: 'PERMISSION_DENIED' }); });
  await button(mount.screen(), 'Connect').props.onPress();
  assert.equal(mount.context().isConnected, false);
  assert.equal(mount.context().isConnecting, false);
  assert.equal(flatten(mount.screen()).find((node) => node.type === 'StatusModal').props.title, 'Connection Failed');
  assert.equal(mount.calls.prints, 0);
  assert.equal(mount.calls.audits, 0);
});

test('discovery timeout clears scanning and fallback notice, then allows retry without printing', async () => {
  const mount = mountPrinter();
  await initialize(mount);
  mount.setScan(async () => ({ paired: [paired], found: [], discoveryStarted: false }));
  await mount.context().scanDevices();
  assert.equal(mount.context().scanNotice, notice);

  const pendingDiscovery = deferred();
  mount.setScan(() => pendingDiscovery.promise);
  const pendingScan = button(mount.screen(), 'Scan').props.onPress();
  assert.equal(mount.context().scanNotice, null);
  assert.equal(mount.context().isScanning, true);
  pendingDiscovery.reject(Object.assign(new Error('Discovery timed out. Check Bluetooth and try again.'), { code: 'DISCOVER' }));
  await pendingScan;
  const failedScreen = mount.screen();
  assert.equal(mount.context().isScanning, false);
  assert.equal(mount.context().scanNotice, null);
  assert.equal(button(failedScreen, 'Scan').props.disabled, false);
  const failureModal = flatten(failedScreen).find((node) => node.type === 'StatusModal');
  assert.equal(failureModal.props.title, 'Scan Failed');
  assert.equal(failureModal.props.message, 'Discovery timed out. Check Bluetooth and try again.');

  mount.setScan(async () => ({ paired: [paired], found: [], discoveryStarted: true }));
  const devices = await mount.context().scanDevices();
  assert.equal(devices[0].address, paired.address);
  assert.equal(mount.context().scanNotice, null);
  assert.equal(mount.context().isScanning, false);
  assert.equal(mount.calls.connections.length, 0);
  assert.equal(mount.calls.prints, 0);
  assert.equal(mount.calls.audits, 0);
});

const savedPrinter = { name: 'Remembered XP-470B', address: 'AA:BB:CC:DD:EE:FF', type: 'BLUETOOTH' };
const printerKey = 'tnl_paired_printer';
const eligibilityKey = 'tnl_printer_auto_reconnect';
function savedStorage(eligibility) {
  const storage = new Map([[printerKey, JSON.stringify(savedPrinter)]]);
  if (eligibility !== undefined) storage.set(eligibilityKey, eligibility);
  return storage;
}
function manualClock() {
  let nextId = 0;
  const timers = new Map();
  return {
    setTimeout(callback, delay) { const id = ++nextId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fire(delay) {
      const timer = [...timers].find(([, entry]) => entry.delay === delay);
      assert.ok(timer, `Expected a ${delay}ms timer`);
      timers.delete(timer[0]);
      timer[1].callback();
    },
    size: () => timers.size,
  };
}

test('startup restores a legacy physical preference and reconnects only to its address without printing, prompts, or discovery', async () => {
  const mount = mountPrinter({ storage: savedStorage() });
  await initialize(mount);
  assert.equal(mount.context().rememberedDevice.address, savedPrinter.address);
  assert.equal(mount.context().isConnected, true);
  assert.equal(mount.context().autoReconnectEnabled, true);
  assert.deepEqual(mount.calls, { scans: 0, connections: [savedPrinter.address], prints: 0, audits: 0 });
  assert.deepEqual(mount.permissionRequests, []);
  assert.equal(hasText(mount.screen(), savedPrinter.address), true);
  await mount.loseConnection();
  assert.equal(mount.context().isConnected, false);
  assert.equal(mount.context().rememberedDevice.name, savedPrinter.name);
  assert.equal(button(mount.screen(), 'Reconnect').props.disabled, false);
  assert.match(mount.context().connectionError, /connection lost/);
  await mount.appState('active');
  assert.equal(mount.calls.connections.length, 1);
  await mount.appState('background');
  await mount.appState('active');
  await mount.appState('active');
  assert.equal(mount.calls.connections.length, 2);
  assert.equal(mount.context().isConnected, true);
  assert.equal(mount.calls.prints + mount.calls.audits + mount.calls.scans, 0);
  mount.provider.unmount();
});

test('missing or malformed printer preferences never connect or crash startup', async () => {
  for (const value of [null, '{broken', 'null', '[]', '42', '{}', JSON.stringify({ address: 'invalid' }), JSON.stringify({ ...savedPrinter, type: 'OTHER' })]) {
    const storage = new Map();
    if (value !== null) storage.set(printerKey, value);
    const mount = mountPrinter({ storage });
    await initialize(mount);
    assert.equal(mount.context().rememberedDevice, null);
    assert.equal(mount.context().isConnected, false);
    assert.equal(mount.calls.connections.length, 0);
    assert.equal(button(mount.screen(), 'Reconnect'), undefined);
    mount.provider.unmount();
  }
});

test('automatic failures are recoverable and never prompt or discover; duplicate active events do not retry', async () => {
  for (const options of [{ missingBridge: true }, { bluetoothEnabled: false }, { permissionGranted: false }, { connect: async () => { throw new Error('Printer out of range'); } }]) {
    const mount = mountPrinter({ storage: savedStorage(), ...options });
    await initialize(mount);
    assert.equal(mount.context().isConnected, false);
    assert.equal(mount.context().isConnecting, false);
    assert.ok(mount.context().connectionError);
    assert.equal(button(mount.screen(), 'Reconnect').props.disabled, false);
    assert.deepEqual(mount.permissionRequests, []);
    assert.equal(mount.calls.prints + mount.calls.audits + mount.calls.scans, 0);
    const previousAttempts = mount.calls.connections.length;
    await mount.appState('active');
    await mount.appState('active');
    assert.equal(mount.calls.connections.length, previousAttempts);
    mount.setPermission(true);
    mount.setBluetooth(true);
    mount.setConnection(async () => {});
    await mount.appState('inactive');
    await mount.appState('active');
    if (!options.missingBridge) assert.equal(mount.context().isConnected, true);
    mount.provider.unmount();
  }
});

test('Disconnect persists pause before native teardown, survives restart, and manual Reconnect resumes automation', async () => {
  const storage = savedStorage();
  const mount = mountPrinter({ storage, disconnect: async () => assert.equal(storage.get(eligibilityKey), 'false') });
  await initialize(mount);
  await button(mount.screen(), 'Disconnect').props.onPress();
  assert.equal(storage.get(eligibilityKey), 'false');
  assert.equal(mount.context().isConnected, false);
  assert.equal(mount.context().rememberedDevice.address, savedPrinter.address);
  await mount.appState('background');
  await mount.appState('active');
  assert.equal(mount.calls.connections.length, 1);
  mount.provider.unmount();
  const restarted = mountPrinter({ storage });
  await initialize(restarted);
  assert.equal(restarted.calls.connections.length, 0);
  await button(restarted.screen(), 'Reconnect').props.onPress();
  assert.equal(restarted.context().isConnected, true);
  assert.equal(storage.get(eligibilityKey), 'true');
  assert.deepEqual(restarted.permissionRequests, [['CONNECT']]);
  await restarted.loseConnection();
  await restarted.appState('background');
  await restarted.appState('active');
  assert.equal(restarted.calls.connections.length, 2);
  assert.equal(restarted.calls.prints + restarted.calls.audits, 0);
  restarted.provider.unmount();
});

test('Forget requires screen confirmation and removes both app preferences without discovery or print calls', async () => {
  const storage = savedStorage('false');
  const mount = mountPrinter({ storage });
  await initialize(mount);
  await button(mount.screen(), 'Forget printer').props.onPress();
  let modal = flatten(mount.screen()).find((node) => node.type === 'StatusModal');
  assert.equal(modal.props.title, 'Forget printer?');
  assert.equal(modal.props.cancelText, 'Cancel');
  modal.props.onCancel();
  assert.equal(storage.has(printerKey), true);
  await button(mount.screen(), 'Forget printer').props.onPress();
  modal = flatten(mount.screen()).find((node) => node.type === 'StatusModal');
  await modal.props.onConfirm();
  assert.equal(storage.has(printerKey), false);
  assert.equal(storage.has(eligibilityKey), false);
  assert.equal(mount.context().rememberedDevice, null);
  await mount.appState('background');
  await mount.appState('active');
  assert.deepEqual(mount.calls, { scans: 0, connections: [], prints: 0, audits: 0 });
  mount.provider.unmount();
  const restarted = mountPrinter({ storage });
  await initialize(restarted);
  assert.equal(restarted.calls.connections.length, 0);
  restarted.provider.unmount();
});

test('startup, foreground, and manual requests coalesce, while competing printer addresses remain rejected', async () => {
  const connection = deferred();
  const mount = mountPrinter({ storage: savedStorage(), connect: () => connection.promise });
  await initialize(mount);
  assert.equal(mount.context().isConnecting, true);
  await mount.appState('active');
  const manual = mount.context().reconnectPrinter();
  await assert.rejects(mount.context().connectPrinter({ ...savedPrinter, address: '11:22:33:44:55:66' }), { code: 'CONNECTION_IN_PROGRESS' });
  assert.equal(mount.calls.connections.length, 1);
  assert.equal(mount.permissionRequests.length, 0);
  connection.resolve();
  await manual;
  assert.equal(mount.context().isConnected, true);
  assert.equal(mount.storage.get(eligibilityKey), 'true');
  assert.equal(mount.calls.prints + mount.calls.audits, 0);
  mount.provider.unmount();
});

test('15-second deadline waits for native cancellation cleanup and ignores late native success', async () => {
  const timers = manualClock();
  const connection = deferred();
  const cleanup = deferred();
  const mount = mountPrinter({ storage: savedStorage(), timers, connect: () => connection.promise, disconnect: () => cleanup.promise });
  await initialize(mount);
  timers.fire(15000);
  await mount.provider.flush();
  assert.deepEqual(mount.disconnects, [savedPrinter.address]);
  assert.equal(mount.context().isConnecting, true);
  assert.equal(mount.service.isConnected(), false);
  assert.ok(mount.service.pendingConnection);
  cleanup.resolve();
  await mount.provider.flush();
  assert.equal(mount.context().isConnecting, false);
  assert.match(mount.context().connectionError, /timed out/);
  assert.equal(mount.service.pendingConnection, null);
  assert.equal(timers.size(), 0);
  mount.setConnection(async () => {});
  await mount.context().reconnectPrinter();
  connection.resolve();
  await mount.provider.flush();
  assert.equal(mount.context().isConnected, true);
  assert.equal(mount.disconnects.length, 1);
  assert.equal(mount.calls.prints + mount.calls.audits, 0);
  mount.provider.unmount();
});

test('connection deadline includes the transient retry and clears its delay on cancellation', async () => {
  for (const cancelDuringDelay of [false, true]) {
    const timers = manualClock();
    let attempt = 0;
    const mount = mountPrinter({ storage: savedStorage(), timers, connect: async () => {
      attempt += 1;
      if (attempt === 1) throw Object.assign(new Error('Unable to connect'), { code: 'EVENT_UNABLE_CONNECT' });
      return new Promise(() => {});
    } });
    await initialize(mount);
    assert.equal(attempt, 1);
    assert.equal(timers.size(), 2);
    if (!cancelDuringDelay) {
      timers.fire(500);
      await mount.provider.flush();
      assert.equal(attempt, 2);
    }
    timers.fire(15000);
    await mount.provider.flush();
    assert.equal(mount.context().isConnecting, false);
    assert.equal(mount.context().isConnected, false);
    assert.equal(timers.size(), 0);
    assert.deepEqual(mount.disconnects, [savedPrinter.address]);
    mount.provider.unmount();
  }
});

test('background, logout, unmount, and Forget invalidate pending connections and remove owned listeners/timers', async () => {
  for (const action of ['background', 'logout', 'unmount', 'forget', 'disconnect']) {
    const timers = manualClock();
    const connection = deferred();
    const mount = mountPrinter({ storage: savedStorage(), timers, connect: () => connection.promise });
    await initialize(mount);
    assert.equal(mount.context().isConnecting, true);
    if (action === 'background') await mount.appState('background');
    if (action === 'logout') await mount.setUser(null);
    if (action === 'unmount') { mount.provider.unmount(); await mount.provider.flush(); }
    if (action === 'forget') await mount.context().forgetPrinter();
    if (action === 'disconnect') await mount.context().disconnectPrinter();
    connection.resolve();
    await mount.provider.flush();
    assert.equal(mount.service.isConnected(), false, action);
    assert.equal(mount.service.pendingConnection, null, action);
    assert.equal(timers.size(), 0, action);
    if (action === 'forget') assert.equal(mount.storage.has(printerKey), false);
    else assert.equal(mount.storage.has(printerKey), true);
    if (action === 'disconnect') assert.equal(mount.storage.get(eligibilityKey), 'false');
    if (action === 'background' || action === 'logout' || action === 'unmount') assert.equal(mount.storage.has(eligibilityKey), false);
    if (action === 'logout') await assert.rejects(mount.context().reconnectPrinter(), /Sign in/);
    mount.provider.unmount();
    assert.deepEqual(mount.listenerCounts(), [0, 0]);
    assert.equal(mount.calls.prints + mount.calls.audits, 0);
  }
});

test('account change cancels old work and obsolete success cannot replace the new session connection', async () => {
  const previous = deferred();
  const current = deferred();
  const mount = mountPrinter({ storage: savedStorage(), connect: () => previous.promise });
  await initialize(mount);
  mount.setConnection(() => current.promise);
  await mount.setUser({ userId: 'SECOND' });
  assert.equal(mount.calls.connections.length, 2);
  current.resolve();
  await mount.provider.flush();
  const connectedAt = mount.context().connectedDevice.connectedAt;
  previous.resolve();
  await mount.provider.flush();
  assert.equal(mount.context().isConnected, true);
  assert.equal(mount.context().connectedDevice.connectedAt, connectedAt);
  assert.equal(mount.calls.prints + mount.calls.audits, 0);
  mount.provider.unmount();
});

test('inactive and signed-out startup do not reconnect, and permission checks cannot start native work after backgrounding', async () => {
  for (const options of [{ appState: 'background' }, { user: null }]) {
    const mount = mountPrinter({ storage: savedStorage(), ...options });
    await initialize(mount);
    assert.equal(mount.calls.connections.length, 0);
    if (options.user === null) await mount.setUser({ userId: 'TEST' });
    else await mount.appState('active');
    assert.equal(mount.calls.connections.length, 1);
    mount.provider.unmount();
  }
  const permission = deferred();
  const mount = mountPrinter({ storage: savedStorage(), checkPermission: () => permission.promise });
  await initialize(mount);
  await mount.appState('background');
  permission.resolve(true);
  await mount.provider.flush();
  assert.equal(mount.calls.connections.length, 0);
  assert.equal(mount.context().isConnecting, false);
  mount.provider.unmount();
});

test('printing blocks replacement, Disconnect, Forget, discovery, and automatic reconnect until a later foreground', async () => {
  const transmission = deferred();
  const mount = mountPrinter({ storage: savedStorage(), print: () => transmission.promise });
  await initialize(mount);
  mount.setScan(async () => ({ paired: [{ ...paired, address: '11:22:33:44:55:66' }], found: [] }));
  await mount.context().scanDevices();
  const print = mount.context().printParcelLabels({ shipmentId: 'SHIPMENT', units: [{ trackingId: 'TRACKING' }] }, null, { auditMode: 'NONE' });
  await mount.provider.flush();
  assert.equal(mount.context().isPrinting, true);
  for (const label of ['Connect', 'Disconnect', 'Forget printer', 'Scan']) assert.equal(button(mount.screen(), label).props.disabled, true, label);
  await assert.rejects(mount.context().connectPrinter(paired), { code: 'PRINT_IN_PROGRESS' });
  await assert.rejects(mount.context().disconnectPrinter(), { code: 'PRINT_IN_PROGRESS' });
  await assert.rejects(mount.context().forgetPrinter(), { code: 'PRINT_IN_PROGRESS' });
  await assert.rejects(mount.context().scanDevices(), { code: 'PRINT_IN_PROGRESS' });
  await mount.loseConnection();
  await mount.appState('background');
  await mount.appState('active');
  assert.equal(mount.calls.connections.length, 1);
  transmission.resolve();
  await print;
  await mount.appState('active');
  assert.equal(mount.calls.connections.length, 1);
  await mount.appState('background');
  await mount.appState('active');
  assert.equal(mount.calls.connections.length, 2);
  assert.equal(mount.calls.prints, 1);
  assert.equal(mount.calls.audits, 0);
  mount.provider.unmount();
});


test('native success awaiting preference storage is still cancelled at the deadline and cannot re-enable automation', async () => {
  const timers = manualClock();
  const write = deferred();
  const storage = savedStorage('false');
  const mount = mountPrinter({ storage, timers, writeStorage: (key) => key === printerKey ? write.promise : undefined });
  await initialize(mount);
  const reconnect = mount.context().reconnectPrinter();
  const rejection = assert.rejects(reconnect, { code: 'CONNECTION_TIMEOUT' });
  await mount.provider.flush();
  timers.fire(15000);
  await rejection;
  assert.equal(mount.context().isConnected, false);
  assert.deepEqual(mount.disconnects, [savedPrinter.address]);
  write.resolve();
  await mount.provider.flush();
  assert.equal(storage.get(eligibilityKey), 'false');
  assert.equal(mount.service.pendingConnection, null);
  assert.equal(timers.size(), 0);
  mount.provider.unmount();
});

test('Forget serializes preference removal after an obsolete save and native cleanup failure blocks replacement', async () => {
  const write = deferred();
  const mount = mountPrinter({ storage: savedStorage('false'), writeStorage: (key) => key === printerKey ? write.promise : undefined });
  await initialize(mount);
  const reconnect = mount.context().reconnectPrinter();
  await mount.provider.flush();
  const forget = mount.context().forgetPrinter();
  write.resolve();
  await Promise.allSettled([reconnect, forget]);
  assert.equal(mount.storage.has(printerKey), false);
  assert.equal(mount.storage.has(eligibilityKey), false);
  assert.equal(mount.service.isConnected(), false);
  mount.provider.unmount();

  const timers = manualClock();
  let shouldFailCleanup = true;
  const failed = mountPrinter({ storage: savedStorage(), timers, connect: () => new Promise(() => {}), disconnect: async () => {
    if (shouldFailCleanup) throw new Error('Native disconnect failed');
  } });
  await initialize(failed);
  timers.fire(15000);
  await failed.provider.flush();
  assert.equal(failed.context().isConnecting, false);
  await assert.rejects(failed.context().reconnectPrinter(), { code: 'CONNECTION_IN_PROGRESS' });
  assert.equal(failed.calls.connections.length, 1);
  shouldFailCleanup = false;
  await failed.context().disconnectPrinter();
  failed.setConnection(async () => {});
  await failed.context().reconnectPrinter();
  assert.equal(failed.context().isConnected, true);
  failed.provider.unmount();
});

test('reconnecting does not resume an uncertain print or audit untransmitted parcels', async () => {
  let transmissions = 0;
  const mount = mountPrinter({ storage: savedStorage(), print: async () => {
    transmissions += 1;
    if (transmissions === 2) throw Object.assign(new Error('Socket closed during write'), { code: 'PRINT_FAILED' });
  } });
  await initialize(mount);
  const result = await mount.context().printParcelLabels({ shipmentId: 'SHIPMENT', units: [
    { trackingId: 'FIRST' }, { trackingId: 'UNCERTAIN' }, { trackingId: 'NOT-ATTEMPTED' },
  ] });
  assert.deepEqual(result.transmittedTrackingIds, ['FIRST']);
  assert.deepEqual(result.failedTrackingIds, ['UNCERTAIN']);
  assert.deepEqual(result.notAttemptedTrackingIds, ['NOT-ATTEMPTED']);
  assert.equal(result.success, false);
  assert.equal(result.failureReason, 'PRINT_FAILED');
  assert.equal(mount.calls.audits, 1);
  assert.equal(mount.auditEntries[0].ownerUserId, 'TEST');
  assert.deepEqual(mount.auditEntries[0].trackingIds, ['FIRST']);
  await mount.loseConnection();
  await mount.appState('background');
  await mount.appState('active');
  assert.equal(mount.context().isConnected, true);
  assert.equal(mount.calls.prints, 2);
  assert.equal(mount.calls.audits, 1);
  mount.provider.unmount();
});

test('existing audit outbox synchronization remains scoped to the authenticated owner during reconnect', async () => {
  const entry = { ownerUserId: 'TEST', printJobId: 'OLD', trackingIds: ['PRINTED'], status: 'PENDING' };
  const mount = mountPrinter({ storage: savedStorage(), pendingAudits: [entry, { ...entry, ownerUserId: 'OTHER' }] });
  await initialize(mount);
  assert.deepEqual(mount.auditEntries, [entry]);
  assert.equal(mount.calls.prints, 0);
  await mount.appState('background');
  await mount.appState('active');
  assert.deepEqual(mount.auditEntries, [entry, entry]);
  assert.equal(mount.calls.connections.length, 1);
  assert.equal(mount.calls.prints, 0);
  mount.provider.unmount();
});


test('connection-loss events invalidate native success while it is awaiting preference storage', async () => {
  const write = deferred();
  const mount = mountPrinter({ storage: savedStorage(), writeStorage: (key) => key === printerKey ? write.promise : undefined });
  await initialize(mount);
  assert.equal(mount.context().isConnecting, true);
  await mount.loseConnection();
  assert.equal(mount.context().isConnecting, false);
  assert.equal(mount.context().isConnected, false);
  write.resolve();
  await mount.provider.flush();
  assert.equal(mount.context().isConnected, false);
  assert.match(mount.context().connectionError, /connection lost/);
  assert.deepEqual(mount.disconnects, [savedPrinter.address]);
  assert.equal(mount.calls.prints + mount.calls.audits, 0);
  mount.provider.unmount();
});

test('automatic reconnect uses existing permission on API 30, 31, and 36 without requesting discovery permissions', async () => {
  for (const apiLevel of [30, 31, 36]) {
    const mount = mountPrinter({ storage: savedStorage(), apiLevel });
    await initialize(mount);
    assert.equal(mount.context().isConnected, true);
    assert.deepEqual(mount.permissionRequests, []);
    assert.equal(mount.calls.scans + mount.calls.prints + mount.calls.audits, 0);
    mount.provider.unmount();
  }
});


test('a retained user profile cannot reconnect while authentication is locked or being restored', async () => {
  const connection = deferred();
  const mount = mountPrinter({ storage: savedStorage(), isAuthenticated: false, connect: () => connection.promise });
  await initialize(mount);
  assert.equal(mount.calls.connections.length, 0);
  await mount.appState('background');
  await mount.appState('active');
  assert.equal(mount.calls.connections.length, 0);
  await assert.rejects(mount.context().reconnectPrinter(), /Sign in/);
  await mount.setAuthenticated(true);
  assert.equal(mount.calls.connections.length, 1);
  await mount.setAuthenticated(false);
  connection.resolve();
  await mount.provider.flush();
  assert.equal(mount.context().isConnected, false);
  assert.equal(mount.service.pendingConnection, null);
  assert.equal(mount.storage.has(eligibilityKey), false);
  mount.provider.unmount();
});


test('a bridge without native cancellation fails before connecting for manual and automatic requests', async () => {
  const mount = mountPrinter({ storage: savedStorage('false') });
  await initialize(mount);
  mount.service.bluetoothDriver.nativeModule.BluetoothManager.disconnect = undefined;
  await assert.rejects(mount.context().reconnectPrinter(), { code: 'TRANSPORT_UNAVAILABLE' });
  mount.service.autoReconnectEnabled = true;
  await mount.appState('background');
  await mount.appState('active');
  assert.match(mount.context().connectionError, /Bluetooth connection controls/);
  assert.equal(mount.calls.connections.length, 0);
  assert.equal(mount.calls.prints + mount.calls.audits, 0);
  mount.provider.unmount();
});

test('printing cannot start while a reconnect operation is unfinished', async () => {
  const connection = deferred();
  const mount = mountPrinter({ storage: savedStorage(), connect: () => connection.promise });
  await initialize(mount);
  await assert.rejects(mount.context().printParcelLabels({ shipmentId: 'SHIPMENT', units: [{ trackingId: 'TRACKING' }] }), /connection to finish/);
  assert.equal(mount.calls.prints + mount.calls.audits, 0);
  assert.equal(mount.context().isPrinting, false);
  connection.resolve();
  await mount.provider.flush();
  assert.equal(mount.context().isConnected, true);
  mount.provider.unmount();
});
