import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');
const plugins = [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')];

function loadModule(path, resolveImport) {
  const { code } = transformSync(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    configFile: false, babelrc: false, plugins,
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', '__DEV__', code)(resolveImport, module, module.exports, true);
  return module.exports;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

// Execute production hooks and JSX; native rendering and layout require device acceptance.
function mountPrinter() {
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
        return [slots[index].value, (value) => { slots[index].value = value; }];
      },
      useRef(initial) {
        const index = cursor++;
        slots[index] ??= { current: initial };
        return slots[index];
      },
      useCallback(callback) { cursor += 1; return callback; },
      useEffect(effect) {
        const index = cursor++;
        if (!slots[index]) { slots[index] = {}; effects.push(effect); }
      },
    };
    return {
      render() { activeRender = hooks; cursor = 0; return component(); },
      async initialize() { for (const effect of effects.splice(0)) effect(); await this.flush(); },
      async flush() { for (let index = 0; index < 12; index += 1) await Promise.resolve(); },
    };
  }
  let nextScan = async () => ({ paired: [], found: [], discoveryStarted: true });
  let nextConnection = async () => {};
  const calls = { scans: 0, connections: [], prints: 0, audits: 0 };
  const native = {
    BluetoothManager: {
      scanDevices: () => { calls.scans += 1; return nextScan(); },
      connect: (address) => { calls.connections.push(address); return nextConnection(); },
      disconnect: async () => {},
    },
    BluetoothTscPrinter: { printLabel: async () => { calls.prints += 1; } },
  };
  const serviceModule = loadModule('../src/features/printer/services/bluetoothPrinterService.js', (dependency) => {
    if (dependency === 'react-native') return {
      Platform: { OS: 'android', Version: 36 },
      PermissionsAndroid: {
        PERMISSIONS: { BLUETOOTH_SCAN: 'SCAN', BLUETOOTH_CONNECT: 'CONNECT' },
        RESULTS: { GRANTED: 'granted' },
        requestMultiple: async (permissions) => Object.fromEntries(permissions.map((permission) => [permission, 'granted'])),
      },
    };
    if (dependency.endsWith('secureStore')) return { getItem: async () => null, setItem: async () => {} };
    if (dependency === 'react-native-bluetooth-escpos-printer') return native;
    throw new Error(`Unexpected service dependency: ${dependency}`);
  });
  const contextModule = loadModule('../src/features/printer/context/PrinterContext.js', (dependency) => {
    if (dependency === 'react') return react;
    if (dependency === 'react-native') return { AppState: { addEventListener: () => ({ remove() {} }) } };
    if (dependency.endsWith('bluetoothPrinterService')) return serviceModule;
    if (dependency.endsWith('AuthContext')) return { useAuth: () => ({ user: { userId: 'TEST' } }) };
    if (dependency.endsWith('/client')) return { apiClient: { get: async () => ({ data: { companyName: 'TNL' } }) } };
    if (dependency.endsWith('printAuditOutbox')) return {
      getPendingPrintAudits: async () => [], getPendingCount: async () => 0,
      syncPrintAuditEntry: async () => { calls.audits += 1; },
    };
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
    provider, context, calls,
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
