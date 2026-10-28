import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const plugins = [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')];

function mount(path, initialProps, exportsName = 'default') {
  const slots = [], timers = new Map(), haptics = [];
  let cursor = 0, dirty = true, effects = [], props = initialProps, tree, timerId = 0;
  const react = {
    createElement: (type, attributes, ...children) => ({ type, props: { ...attributes, children } }),
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: initial };
      return [slots[index].value, (value) => { slots[index].value = value; dirty = true; }];
    },
    useRef(initial) { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
    useEffect(effect, dependencies) {
      const index = cursor++, previous = slots[index];
      if (!previous || dependencies.some((value, position) => previous.dependencies[position] !== value)) {
        slots[index] = { dependencies, cleanup: previous?.cleanup };
        effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect(); });
      }
    }
  };
  const { code } = require('@babel/core').transformSync(readFileSync(new URL(path, import.meta.url), 'utf8'), { configFile: false, babelrc: false, plugins });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', code)((dependency) => {
    if (dependency === 'react') return react;
    if (dependency === 'react-native') return { View: 'View', Text: 'Text', TouchableOpacity: 'Button', ActivityIndicator: 'Spinner', TextInput: 'Input', Modal: 'Modal', StyleSheet: { create: (styles) => styles } };
    if (dependency === 'expo-camera') return { CameraView: 'Camera', useCameraPermissions: () => [{ granted: true }, () => {}] };
    if (dependency.endsWith('ScanFeedbackBanner')) return { __esModule: true, default: 'Feedback' };
    if (dependency.endsWith('/haptics')) return { safeHaptics: Object.fromEntries(['selection', 'error'].map((kind) => [kind, () => haptics.push(kind)])) };
    if (dependency.endsWith('/theme')) return { colors: {}, spacing: {}, radius: {}, typography: {} };
    return { Icon: 'Icon', SafeAreaView: 'SafeAreaView' };
  }, module, module.exports, (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; }, (id) => timers.delete(id));
  return {
    timers, haptics,
    render(nextProps) {
      if (nextProps) { props = nextProps; dirty = true; }
      for (let iteration = 0; dirty; iteration += 1) {
        assert.ok(iteration < 20);
        cursor = 0; dirty = false; tree = module.exports[exportsName](props);
        for (const effect of effects.splice(0)) effect();
      }
      return tree;
    },
    unmount() { for (const slot of slots) slot?.cleanup?.(); }
  };
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}

test('feedback expires success after three seconds, preserves errors, and cancels obsolete timers', () => {
  let dismissed = 0;
  const banner = mount('../src/features/scanner/components/ScanFeedbackBanner.js', { kind: 'success', message: 'Parcel added. 1 queued.', onDismiss: () => { dismissed += 1; } });
  assert.equal(banner.render().props.accessibilityLiveRegion, 'polite');
  assert.equal([...banner.timers.values()][0].delay, 3000);
  banner.render({ kind: 'error', message: 'Wrong status.', onDismiss: () => { dismissed += 1; } });
  assert.equal(banner.timers.size, 0);
  assert.equal(dismissed, 0);
  banner.render({ kind: 'loading', message: 'Checking parcel...' });
  assert.equal(banner.timers.size, 0);
  assert.ok(nodes(banner.render()).some((node) => node.type === 'Spinner'));
  banner.render({ kind: 'success', message: 'Parcel added. 2 queued.', onDismiss: () => { dismissed += 1; } });
  [...banner.timers.values()][0].callback();
  assert.equal(dismissed, 1);
  banner.unmount();
  assert.equal(banner.timers.size, 0);
});

test('barcode modal reports pending/read/error outcomes and resets its scan lock when reopened', async () => {
  let resolve, reject, calls = 0;
  let pending = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  const props = { visible: true, onClose() {}, onScan: () => { calls += 1; return pending; } };
  const screen = mount('../src/features/shipments/components/BarcodeScannerModal.js', props, 'BarcodeScannerModal');
  const camera = () => nodes(screen.render()).find((node) => node.type === 'Camera');
  const feedback = () => nodes(screen.render()).find((node) => node.type === 'Feedback').props;
  const handler = camera().props.onBarcodeScanned;
  const first = handler({ data: 'TRK-2026-000001' });
  await handler({ data: 'TRK-2026-000001' });
  assert.equal(calls, 1);
  assert.equal(feedback().kind, 'loading');
  reject(new Error('Missing parcel')); await first;
  assert.equal(feedback().message, 'Missing parcel');
  assert.equal(typeof camera().props.onBarcodeScanned, 'function');
  pending = Promise.resolve();
  await camera().props.onBarcodeScanned({ data: 'TRK-2026-000002' });
  assert.equal(feedback().kind, 'success');
  assert.match(feedback().message, /Code read/);
  assert.deepEqual(screen.haptics, ['error', 'selection']);
  screen.render({ ...props, visible: false });
  screen.render(props);
  assert.equal(typeof camera().props.onBarcodeScanned, 'function');
  pending = new Promise((accept) => { resolve = accept; });
  const obsolete = camera().props.onBarcodeScanned({ data: 'TRK-2026-000003' });
  screen.render({ ...props, visible: false });
  resolve(); await obsolete;
  screen.render(props);
  assert.equal(feedback().message, undefined);
  assert.deepEqual(screen.haptics, ['error', 'selection']);
});
