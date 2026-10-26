import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  REPORT_PAGE_CONTENT_UNITS,
  buildReportPrintUrl,
  createPrintableReportModel,
  normalizeReportPrintParams,
  normalizeReportBranding,
} from '../src/features/reports/utils/reportPrintModel.mjs';

function createClientRow(index) {
  return {
    clientId: `CL-${String(index).padStart(3, '0')}`,
    clientName: `Client ${index}`,
    totalShipments: index,
    totalBilled: index * 500,
    totalPaid: index * 100,
    balance: index * 400,
  };
}

function createCollectionRow(index) {
  return {
    clientId: `COL-${String(index).padStart(3, '0')}`,
    clientName: `Collection Client ${index}`,
    shipmentsCount: index,
    currentCharges: index * 300,
    balance: index * 200,
  };
}

test('buildReportPrintUrl creates the protected report print route', () => {
  assert.equal(
    buildReportPrintUrl('2026-09-01', '2026-09-30'),
    '/reports/print?startDate=2026-09-01&endDate=2026-09-30',
  );
});

test('normalizeReportPrintParams accepts valid dates and rejects invalid ranges', () => {
  assert.deepEqual(
    normalizeReportPrintParams({ startDate: '2026-09-01', endDate: '2026-09-30' }),
    {
      isValid: true,
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    },
  );

  assert.equal(
    normalizeReportPrintParams({ startDate: '2026-09-31', endDate: '2026-10-01' }).isValid,
    false,
  );
  assert.equal(
    normalizeReportPrintParams({ startDate: '2026-10-01', endDate: '2026-09-01' }).isValid,
    false,
  );
});

test('createPrintableReportModel keeps the prototype-sized report on one A4 page', () => {
  const model = createPrintableReportModel({
    kpis: { totalShipments: 12, totalParcels: 23 },
    clientRevenue: [1, 2, 3, 4].map(createClientRow),
    collectionSummary: { items: [createCollectionRow(1)] },
  }, '2026-09-01', '2026-09-30');

  assert.equal(model.pages.length, 1);
  assert.equal(model.pages[0].showExecutiveSummary, true);
  assert.equal(model.pages[0].showSignatures, true);
  assert.deepEqual(
    model.pages[0].tableBlocks.map((block) => block.section),
    ['CLIENT_REVENUE', 'WEEKLY_COLLECTIONS'],
  );
});

test('createPrintableReportModel preserves every row across bounded A4 pages', () => {
  const clients = Array.from({ length: 48 }, (_, index) => createClientRow(index + 1));
  const collections = Array.from({ length: 19 }, (_, index) => createCollectionRow(index + 1));
  const model = createPrintableReportModel({
    clientRevenue: clients,
    collectionSummary: { items: collections },
  }, '2026-01-01', '2026-12-31');

  const printedClients = model.pages
    .flatMap((page) => page.tableBlocks)
    .filter((block) => block.section === 'CLIENT_REVENUE')
    .flatMap((block) => block.rows);
  const printedCollections = model.pages
    .flatMap((page) => page.tableBlocks)
    .filter((block) => block.section === 'WEEKLY_COLLECTIONS')
    .flatMap((block) => block.rows);

  assert.ok(model.pages.length > 1);
  assert.deepEqual(printedClients.map((row) => row.clientId), clients.map((row) => row.clientId));
  assert.deepEqual(printedCollections.map((row) => row.clientId), collections.map((row) => row.clientId));
  assert.equal(model.pages[0].showExecutiveSummary, true);
  assert.equal(model.pages.slice(1).every((page) => !page.showExecutiveSummary), true);
  assert.equal(model.pages.at(-1).showSignatures, true);
  assert.equal(model.pages.slice(0, -1).every((page) => !page.showSignatures), true);
  assert.equal(model.pages.every((page) => page.usedUnits <= REPORT_PAGE_CONTENT_UNITS), true);
});

test('createPrintableReportModel renders an explicit client empty state', () => {
  const model = createPrintableReportModel({
    clientRevenue: [],
    collectionSummary: { items: [] },
  }, '2026-09-01', '2026-09-30');

  assert.equal(model.pages.length, 1);
  assert.equal(model.pages[0].tableBlocks.length, 1);
  assert.equal(model.pages[0].tableBlocks[0].section, 'CLIENT_REVENUE');
  assert.equal(model.pages[0].tableBlocks[0].rows[0].isEmpty, true);
  assert.equal(model.pages[0].showSignatures, true);
});

const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');

function mountPrintComponent(path, overrides = {}) {
  const slots = [];
  let cursor = 0;
  let dirty = true;
  let effects = [];
  let tree;
  const sameDeps = (left, right) => left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
  const hooks = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, next => {
        const value = typeof next === 'function' ? next(slots[index].value) : next;
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; }
      }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial }; },
    useMemo(factory, deps) {
      const index = cursor++;
      if (!slots[index] || !sameDeps(slots[index].deps, deps)) slots[index] = { deps, value: factory() };
      return slots[index].value;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || !sameDeps(slots[index].deps, deps)) {
        const previous = slots[index];
        slots[index] = { deps, cleanup: previous?.cleanup };
        effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect(); });
      }
    },
  };
  const react = { __esModule: true, default: hooks, ...hooks };
  const native = { View: 'View', Text: 'Text', Image: 'Image', TouchableOpacity: 'TouchableOpacity', Modal: 'Modal', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value }, Platform: { OS: 'web' } };
  const module = { exports: {} };
  const filename = new URL(path, import.meta.url);
  const { code } = transformSync(readFileSync(filename, 'utf8'), { filename: filename.pathname, configFile: false, babelrc: false, plugins: [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')] });
  new Function('require', 'module', 'exports', code)(dependency => {
    if (dependency === 'react') return react;
    if (dependency === 'react-native') return native;
    if (dependency === 'expo-router') return { useLocalSearchParams: () => ({ startDate: '2026-09-01', endDate: '2026-09-30' }), useRouter: () => ({ replace() {} }) };
    if (dependency.endsWith('/theme')) return { colors: {}, fonts: {}, spacing: {}, radius: {} };
    if (dependency.endsWith('/settingsApi')) return { getCompanyBranding: overrides.getCompanyBranding || (async () => ({ companyName: 'Configured Logistics' })) };
    if (dependency.endsWith('/reportPrintModel.mjs')) return { buildReportPrintUrl, createPrintableReportModel, normalizeReportPrintParams, normalizeReportBranding };
    if (dependency.endsWith('/reports')) return { getReportSummary: async () => ({ kpis: {} }), PrintableReportDocument: 'PrintableReportDocument' };
    if (dependency.endsWith('/PrintableReportDocument')) return { __esModule: true, default: 'PrintableReportDocument' };
    if (dependency.endsWith('/tracking-logo.png')) return 'tracking-logo.png';
    throw new Error(`Unexpected import ${dependency}`);
  }, module, module.exports);
  let props = overrides.props || {};
  function render() { cursor = 0; dirty = false; tree = module.exports.default(props); }
  function nodes(node = tree) {
    if (Array.isArray(node)) return node.flatMap(item => nodes(item));
    if (!node || typeof node !== 'object') return [];
    return [node, ...nodes(node.props?.children)];
  }
  return {
    async flush() {
      for (let iteration = 0; iteration < 12; iteration++) {
        if (dirty) render();
        const pending = effects; effects = []; pending.forEach(effect => effect());
        await new Promise(resolve => setImmediate(resolve));
        if (!dirty && effects.length === 0) return;
      }
      throw new Error('Print component did not settle');
    },
    nodes,
    text: () => JSON.stringify(tree),
    update(next) { props = { ...props, ...next }; dirty = true; },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test('report branding requires a real business name and omits unconfigured contact details', () => {
  for (const value of [null, {}, { companyName: '  ' }]) assert.throws(() => normalizeReportBranding(value), /business name/);
  assert.deepEqual(normalizeReportBranding({ companyName: '  Actual Business ', companyContact: ' 0123 ' }), {
    companyName: 'Actual Business', companyAddress: '', companyContact: '0123', billingEmail: '',
  });
});

test('actual report document repeats the configured logo and letterhead on every page', async () => {
  let logoReady = 0;
  const document = mountPrintComponent('../src/features/reports/components/PrintableReportDocument.js', { props: {
    reportData: { clientRevenue: Array.from({ length: 48 }, (_, index) => createClientRow(index + 1)) },
    startDate: '2026-09-01', endDate: '2026-09-30',
    branding: normalizeReportBranding({ companyName: 'Actual Business', companyAddress: 'Warehouse 1', companyContact: '0123', billingEmail: 'billing@example.test' }),
    onLogoReady: () => logoReady++,
  } });
  await document.flush();
  const pages = document.nodes().filter(node => node.props.nativeID?.startsWith('report-print-page-'));
  const logos = document.nodes().filter(node => node.type === 'Image');
  assert.ok(pages.length > 1);
  assert.equal(logos.length, pages.length);
  assert.equal(document.nodes().filter(node => node.props.children?.includes('ACTUAL BUSINESS')).length, pages.length);
  assert.equal(document.nodes().filter(node => node.props.children?.includes('Warehouse 1 | 0123 | billing@example.test')).length, pages.length);
  assert.doesNotMatch(document.text(), /TNL LOGISTICS EXPRESS|0917-555|Manila Central Hub/);
  logos[0].props.onError(); await document.flush();
  assert.equal(logoReady, 1);
  assert.equal(document.nodes().filter(node => node.type === 'Image').length, 0);
  assert.match(document.text(), /LOGISTICS/);
  document.unmount();
});

for (const path of ['../src/features/reports/components/PrintableReportModal.js', '../src/app/reports/print.js']) {
  test(`${path}: branding failure blocks print and Retry supplies the actual business header`, async () => {
    let attempts = 0;
    const screen = mountPrintComponent(path, {
      props: { visible: true, reportData: { kpis: {} }, startDate: '2026-09-01', endDate: '2026-09-30' },
      getCompanyBranding: async forceRefresh => {
        assert.equal(forceRefresh, true);
        if (++attempts === 1) throw new Error('Branding unavailable');
        return { companyName: 'Actual Business', companyAddress: 'Warehouse 1' };
      },
    });
    await screen.flush();
    const printButton = () => screen.nodes().find(node => node.type === 'TouchableOpacity' && node.props.disabled !== undefined);
    assert.equal(printButton().props.disabled, true);
    assert.match(screen.text(), /Branding unavailable/);
    assert.equal(screen.nodes().some(node => node.type === 'PrintableReportDocument'), false);
    const retry = screen.nodes().find(node => node.type === 'TouchableOpacity' && JSON.stringify(node.props.children).includes('Retry'));
    retry.props.onPress(); await screen.flush();
    const document = screen.nodes().find(node => node.type === 'PrintableReportDocument');
    assert.equal(document.props.branding.companyName, 'Actual Business');
    assert.equal(printButton().props.disabled, true);
    document.props.onLogoReady(); await screen.flush();
    assert.equal(printButton().props.disabled, false);
    screen.unmount();
  });
}

test('print page waits for current branding, logo readiness, and fonts before auto-printing', async context => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  let prints = 0;
  let resolveBranding;
  let resolveFonts;
  const timers = [];
  const brandingResponse = new Promise(resolve => { resolveBranding = resolve; });
  globalThis.document = { title: 'Original title', fonts: { ready: new Promise(resolve => { resolveFonts = resolve; }) } };
  globalThis.window = {
    print: () => prints++,
    requestAnimationFrame: callback => { callback(); return 1; },
    cancelAnimationFrame() {},
    setTimeout: callback => { timers.push(callback); return timers.length; },
    clearTimeout() {},
  };
  const screen = mountPrintComponent('../src/app/reports/print.js', { getCompanyBranding: () => brandingResponse });
  context.after(() => {
    screen.unmount();
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  });
  await screen.flush();
  assert.equal(prints, 0);
  assert.equal(screen.nodes().some(node => node.type === 'PrintableReportDocument'), false);
  resolveBranding({ companyName: 'Actual Business' }); await screen.flush();
  assert.equal(timers.length, 0);
  assert.equal(globalThis.document.title, 'Actual Business Report 2026-09-01 to 2026-09-30');
  screen.nodes().find(node => node.type === 'PrintableReportDocument').props.onLogoReady(); await screen.flush();
  assert.equal(timers.length, 0);
  resolveFonts(); await screen.flush();
  assert.equal(timers.length, 1);
  timers[0]();
  assert.equal(prints, 1);
});
