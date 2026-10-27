import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mountScreen, deferred, loadProductionModule } from './previewHarness.mjs';
import * as statementModel from '../src/features/collections/utils/statementPrintModel.mjs';
import {
  buildStatementPrintUrl,
  createStatementPrintSheetSequence,
  getStatementPrintBlockReason,
  hasUnsavedStatementAdjustments,
  paginateStatementItems,
  waitForImageReady,
} from '../src/features/collections/utils/statementPrintModel.mjs';
import {
  getSoaBankDetailsErrors,
  normalizeSoaBankDetails,
} from '../src/features/settings/utils/soaBankDetails.mjs';

const printableStatement = {
  isSaved: true,
  deductionAmount: 100,
  deductionNote: 'Approved adjustment',
  collectedBy: 'Admin User',
  soaBankName: 'Test Bank',
  soaAccountName: 'TNL Test Account',
  soaAccountNumber: '000000123456',
};

test('statement component labels every print sheet while leaving preview unlabeled', () => {
  const react = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }), useMemo: callback => callback(), useState: initial => [initial, () => {}], useEffect: () => {} };
  const native = { View: 'View', Text: 'Text', Image: 'Image', Platform: { OS: 'web', select: options => options.web }, StyleSheet: { create: styles => styles } };
  const themeValues = new Proxy({}, { get: () => 'sans-serif' });
  const component = loadProductionModule('../src/features/collections/components/StatementPaperCard.js', dependency => {
    if (dependency.endsWith('/api/client')) return { default: {} };
    if (dependency === 'react') return { __esModule: true, default: react, ...react };
    if (dependency === 'react-native') return native;
    if (dependency === '../../../theme') return { colors: themeValues, fonts: themeValues, spacing: themeValues, radius: themeValues };
    if (dependency.endsWith('collectionsUtils')) return { formatCurrency: value => String(value) };
    if (dependency.endsWith('statementPrintModel.mjs')) return statementModel;
    if (dependency.endsWith('.png')) return 'logo.png';
    throw new Error(`Unexpected import ${dependency}`);
  }).default;
  const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join(' ') : node?.children ? node.children.map(text).join(' ') : '';
  for (const count of [1, 12]) {
    const data = { ...printableStatement, items: Array.from({ length: count }, (_, index) => ({ shipmentId: `S${index}` })) };
    const preview = text(component({ data, showLogo: false }));
    assert.doesNotMatch(preview, /ORIGINAL COPY|CLIENT COPY/);
    const printed = text(component({ data, copies: 2, showCopyLabels: true, showLogo: false }));
    const pages = Math.ceil(count / 11);
    assert.deepEqual(printed.match(/ORIGINAL COPY|CLIENT COPY/g), [...Array(pages).fill('ORIGINAL COPY'), ...Array(pages).fill('CLIENT COPY')]);
    assert.equal((printed.match(/Page\s+1\s+of/g) || []).length, 2);
  }
  const archived = text(component({
    data: { ...printableStatement, activeVersion: 1, totalCharges: 200, totalPaid: 0, amountDue: 100,
      companyName: 'Saved Company', capturedByName: 'Saved Preparer', collectedBy: 'Saved Collector', items: [] },
    liveDeduction: 0, liveCollectedBy: 'Live Collector', currentUser: { name: 'Live Preparer' },
    companyBranding: { companyName: 'Live Company' }, showLogo: false,
  }));
  assert.match(archived, /SAVED COMPANY/);
  assert.match(archived, /Saved Preparer/);
  assert.match(archived, /Saved Collector/);
  assert.doesNotMatch(archived, /Live Company|Live Preparer|Live Collector/);
  assert.match(readFileSync(new URL('../src/app/statements/print.js', import.meta.url), 'utf8'), /copies=\{STATEMENT_PRINT_COPY_COUNT\}\s+showCopyLabels/);
});

test('printed copies hide version numbers while preserving capture date, copy labels, and staff preview details', () => {
  const react = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }), useMemo: callback => callback(), useState: initial => [initial, () => {}], useEffect: () => {} };
  const native = { View: 'View', Text: 'Text', Image: 'Image', Platform: { OS: 'web', select: options => options.web }, StyleSheet: { create: styles => styles } };
  const themeValues = new Proxy({}, { get: () => 'sans-serif' });
  const component = loadProductionModule('../src/features/collections/components/StatementPaperCard.js', dependency => {
    if (dependency.endsWith('/api/client')) return { default: {} };
    if (dependency === 'react') return { __esModule: true, default: react, ...react };
    if (dependency === 'react-native') return native;
    if (dependency === '../../../theme') return { colors: themeValues, fonts: themeValues, spacing: themeValues, radius: themeValues };
    if (dependency.endsWith('collectionsUtils')) return { formatCurrency: value => String(value) };
    if (dependency.endsWith('statementPrintModel.mjs')) return statementModel;
    if (dependency.endsWith('.png')) return 'logo.png';
    throw new Error(`Unexpected import ${dependency}`);
  }).default;
  const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join(' ') : node?.children ? node.children.map(text).join(' ') : '';

  const versionedData = {
    ...printableStatement,
    soaNo: 'SOA-2026-CL01-W43',
    activeVersion: 2,
    versionNumber: 2,
    capturedAt: 'Oct 27, 2026, 3:30 PM',
    isLive: false,
    items: Array.from({ length: 15 }, (_, index) => ({ shipmentId: `SHP-${index}` })),
  };

  // 1. Staff preview (on screen): version badge and details remain visible
  const preview = text(component({ data: versionedData, showLogo: false }));
  assert.match(preview, /VERSION\s+2/);
  assert.match(preview, /Version:\s+V\s*2/);
  assert.match(preview, /Oct 27, 2026, 3:30 PM/);
  assert.match(preview, /SOA-2026-CL01-W43/);
  assert.doesNotMatch(preview, /ORIGINAL COPY|CLIENT COPY/);

  // 2. Printed copies (ORIGINAL COPY and CLIENT COPY): version labels hidden, capture date and copy labels preserved
  const printed = text(component({ data: versionedData, copies: 2, showCopyLabels: true, isPrint: true, showLogo: false }));
  assert.doesNotMatch(printed, /VERSION 2|VERSION 1|VERSION/);
  assert.doesNotMatch(printed, /\bV2\b|\bV1\b/);
  assert.doesNotMatch(printed, /Version:/);
  assert.match(printed, /Captured:\s+Oct 27, 2026, 3:30 PM/);
  assert.match(printed, /SOA-2026-CL01-W43/);
  assert.deepEqual(printed.match(/ORIGINAL COPY|CLIENT COPY/g), ['ORIGINAL COPY', 'ORIGINAL COPY', 'CLIENT COPY', 'CLIENT COPY']);

  // 3. Live document on printed copies: live warning preserved, no version label
  const livePrintData = {
    ...printableStatement,
    soaNo: 'SOA-2026-CL01-W43',
    isLive: true,
    items: [{ shipmentId: 'SHP-0' }],
  };
  const livePrinted = text(component({ data: livePrintData, copies: 2, showCopyLabels: true, isPrint: true, showLogo: false }));
  assert.match(livePrinted, /LIVE SOA — MAY CHANGE/);
  assert.doesNotMatch(livePrinted, /VERSION/);
  assert.doesNotMatch(livePrinted, /\bV\d+\b/);
});

test('SOA bank details normalize values and preserve leading zeroes', () => {
  assert.deepEqual(normalizeSoaBankDetails({
    soaBankName: '  Test Bank  ',
    soaAccountName: '  TNL Test Account ',
    soaAccountNumber: ' 000000123456 ',
  }), {
    soaBankName: 'Test Bank',
    soaAccountName: 'TNL Test Account',
    soaAccountNumber: '000000123456',
  });
});

test('SOA bank validation rejects blank, multiline, control, oversized, and non-digit values', () => {
  assert.ok(getSoaBankDetailsErrors({}).soaBankName);
  assert.ok(getSoaBankDetailsErrors({
    ...printableStatement,
    soaBankName: 'Bank\nInjected',
  }).soaBankName);
  assert.ok(getSoaBankDetailsErrors({
    ...printableStatement,
    soaAccountName: `Account${String.fromCharCode(7)}Name`,
  }).soaAccountName);
  assert.ok(getSoaBankDetailsErrors({
    ...printableStatement,
    soaAccountName: 'A'.repeat(151),
  }).soaAccountName);
  assert.ok(getSoaBankDetailsErrors({
    ...printableStatement,
    soaAccountNumber: '1234-5678',
  }).soaAccountNumber);
});

test('statement print URL includes selectors only and cannot carry financial overrides', () => {
  const url = buildStatementPrintUrl('CL-001', '2026-10-01');
  assert.equal(url, '/statements/print?clientId=CL-001&cycle=2026-10-01');
  assert.equal(url.includes('deduction'), false);
  assert.equal(url.includes('note'), false);
  assert.equal(url.includes('collector'), false);
});

test('printing is blocked for unsaved statements or invalid bank configuration', () => {
  assert.match(getStatementPrintBlockReason({ ...printableStatement, isSaved: false }), /Save/);
  assert.match(getStatementPrintBlockReason({ ...printableStatement, soaAccountNumber: '' }), /System Settings/);
  assert.equal(getStatementPrintBlockReason(printableStatement), null);
});

test('unsaved adjustment detection compares persisted normalized values', () => {
  assert.equal(hasUnsavedStatementAdjustments(printableStatement, {
    deductionAmount: '100.00',
    deductionNote: ' Approved adjustment ',
    collectedBy: 'Admin User',
  }), false);
  assert.equal(hasUnsavedStatementAdjustments(printableStatement, {
    deductionAmount: '101.00',
    deductionNote: 'Approved adjustment',
    collectedBy: 'Admin User',
  }), true);
});

test('two-copy multi-page sequence repeats every sheet and restarts page numbering', () => {
  const items = Array.from({ length: 41 }, (_, index) => ({ shipmentId: `SHP-${index + 1}` }));
  const pages = paginateStatementItems(items);
  const sheets = createStatementPrintSheetSequence(pages, 2);

  assert.ok(pages.length > 1);
  assert.equal(sheets.length, pages.length * 2);
  assert.deepEqual(
    sheets.filter((sheet) => sheet.copyIndex === 0).map((sheet) => sheet.pageNumber),
    Array.from({ length: pages.length }, (_, index) => index + 1),
  );
  assert.deepEqual(
    sheets.filter((sheet) => sheet.copyIndex === 1).map((sheet) => sheet.pageNumber),
    Array.from({ length: pages.length }, (_, index) => index + 1),
  );
  assert.deepEqual(
    sheets.filter((sheet) => sheet.copyIndex === 1).flatMap((sheet) => sheet.pageItems),
    items,
  );
  assert.ok(pages.at(-1).length <= 11);
});

test('paginateStatementItems uniformly chunks up to 11 shipments per page', () => {
  // Empty
  assert.deepEqual(paginateStatementItems([]).map((p) => p.length), [0]);

  // Single-page: 1 to 11 shipments
  assert.deepEqual(paginateStatementItems(Array.from({ length: 5 })).map((p) => p.length), [5]);
  assert.deepEqual(paginateStatementItems(Array.from({ length: 11 })).map((p) => p.length), [11]);

  // 2 pages: 12 shipments (Sunrise Hardware: 11 on Page 1, 1 on Page 2)
  assert.deepEqual(paginateStatementItems(Array.from({ length: 12 })).map((p) => p.length), [11, 1]);

  // 2 pages: 18 shipments (Northbridge Trading: 11 on Page 1, 7 on Page 2)
  assert.deepEqual(paginateStatementItems(Array.from({ length: 18 })).map((p) => p.length), [11, 7]);

  // 2 pages: 20 shipments (11 on Page 1, 9 on Page 2)
  assert.deepEqual(paginateStatementItems(Array.from({ length: 20 })).map((p) => p.length), [11, 9]);

  // 2 pages: 22 shipments (11 on Page 1, 11 on Page 2)
  assert.deepEqual(paginateStatementItems(Array.from({ length: 22 })).map((p) => p.length), [11, 11]);

  // 3 pages: 23 shipments (11 on Page 1, 11 on Page 2, 1 on Page 3)
  assert.deepEqual(paginateStatementItems(Array.from({ length: 23 })).map((p) => p.length), [11, 11, 1]);

  // 4 pages: 41 shipments (11, 11, 11, 8)
  assert.deepEqual(paginateStatementItems(Array.from({ length: 41 })).map((p) => p.length), [11, 11, 11, 8]);

  // Invariant across all counts 1..100: every non-final page has exactly 11 items, final page has 1..11
  for (let count = 1; count <= 100; count++) {
    const pages = paginateStatementItems(Array.from({ length: count }));
    for (let i = 0; i < pages.length - 1; i++) {
      assert.equal(pages[i].length, 11, `Non-final page ${i + 1} must have exactly 11 items for count ${count}`);
    }
    assert.ok(pages.at(-1).length >= 1 && pages.at(-1).length <= 11);
  }
});

test('logo readiness resolves for both successful and failed loads', async () => {
  function createImage(result) {
    return {
      set src(_value) {
        queueMicrotask(() => this[result]());
      },
    };
  }

  assert.equal(await waitForImageReady('/logo.png', () => createImage('onload')), 'loaded');
  assert.equal(await waitForImageReady('/logo.png', () => createImage('onerror')), 'failed');
});


test('version selectors reject objects, arrays and invalid numbers', () => {
  assert.match(buildStatementPrintUrl('C', '2026-10-01', 3), /version=3/);
  for (const version of [{ version: 1 }, [1], 'NaN', NaN, 0, -1, 1.5, '']) {
    assert.throws(() => buildStatementPrintUrl('C', '2026-10-01', version), /version/i);
  }
});

test('logo readiness waits for decode and rejects decode failures', async () => {
  let decoded = false;
  const result = await waitForImageReady('/archived.png', () => ({
    set src(value) { queueMicrotask(() => this.onload()); },
    async decode() { decoded = true; },
  }));
  assert.equal(result, 'loaded');
  assert.equal(decoded, true);
  assert.equal(await waitForImageReady('/broken.png', () => ({
    set src(value) { queueMicrotask(() => this.onload()); },
    async decode() { throw new Error('Corrupt image'); },
  })), 'failed');
});

const settleStatement = async screen => {
  await screen.flush();
  await new Promise(resolve => setTimeout(resolve, 330));
  await screen.flush();
};
const button = (screen, text) => screen.allProps('TouchableOpacity').find(props => JSON.stringify(props.children).includes(text));
const documentFixture = { ...printableStatement, soaNo: 'SOA1', clientId: 'C1', items: [{ shipmentId: 'S1' }],
  totalCharges: 1000, totalPaid: 0, deductionAmount: 100, financialRevision: 1,
  isCycleClosed: true, hasSnapshot: true, latestVersionNumber: 3, activeVersion: 3, logoHash: 'hash3' };
const statementApis = overrides => ({ searchParams: { clientId: 'C1', cycle: '2026-10-22' },
  collections: async () => ({ items: [{ clientId: 'C1', statementId: 'SOA1', status: 'SOA_GENERATED' }] }),
  listStatementVersions: async (clientId, cycle) => {
    assert.equal(clientId, 'C1');
    assert.equal(cycle, '2026-10-22');
    return [{ versionNumber: 1 }, { versionNumber: 3 }];
  },
  statements: async (_client, _cycle, options) => ({ ...documentFixture, activeVersion: options?.version || null }),
  ...overrides });

function installPrintBrowser(context) {
  const previous = globalThis.window;
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  const images = [], urls = [], revoked = [], opened = [], printed = [];
  globalThis.window = { addEventListener() {}, removeEventListener() {}, history: { length: 1 },
    print: () => printed.push(true), open: url => opened.push(url),
    Image: class {
      constructor() { images.push(this); }
      async decode() {}
      set src(uri) { this.uri = uri; }
    } };
  URL.createObjectURL = () => { const uri = 'blob:statement-' + urls.length; urls.push(uri); return uri; };
  URL.revokeObjectURL = uri => revoked.push(uri);
  context.after(() => { globalThis.window = previous; URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; });
  return { images, urls, revoked, opened, printed };
}

test('actual Print button uses the version Ensure-V1 returns', async context => {
  const browser = installPrintBrowser(context);
  const screen = mountScreen('statements', statementApis({
    statements: async () => ({ ...documentFixture, activeVersion: null, hasSnapshot: false }),
    ensureV1Snapshot: async () => ({ ...documentFixture, activeVersion: 4 }),
  }));
  context.after(() => screen.unmount());
  await settleStatement(screen);
  assert.equal(button(screen, 'Print / Export PDF').disabled, false);
  await button(screen, 'Print / Export PDF').onPress();
  assert.equal(new URL(browser.opened[0], 'https://fixture.test').searchParams.get('version'), '4');
});

test('archived revision uses fresh reviewed live revision and keeps its retry ID', async context => {
  installPrintBrowser(context);
  const payloads = [];
  let shouldFail = true;
  const screen = mountScreen('statements', statementApis({
    statements: async (_client, _cycle, options) => ({ ...documentFixture,
      activeVersion: options?.version || null, financialRevision: options?.version ? 1 : 9,
      totalPaid: options?.version ? 0 : 200 }),
    saveStatementVersion: async payload => {
      payloads.push(payload);
      if (shouldFail) throw new Error('Lost response');
      return { ...documentFixture, activeVersion: 4 };
    },
  }));
  context.after(() => screen.unmount());
  await settleStatement(screen); await settleStatement(screen);
  assert.equal(screen.props('DeductionsInputCard').disabled, true);
  await button(screen, 'Prepare New Version').onPress(); await screen.flush();
  screen.props('DeductionsInputCard').onDeductionAmountChange('150'); await screen.flush();
  const preview = screen.props('StatementPaperCard');
  assert.equal(preview.data.totalPaid, 0);
  assert.equal(preview.liveDeduction, undefined);
  await screen.props('DeductionsInputCard').onSave(); await screen.flush();
  shouldFail = false;
  await screen.props('DeductionsInputCard').onSave();
  assert.equal(payloads.length, 2);
  assert.equal(payloads[0].expectedFinancialRevision, 9);
  assert.equal(payloads[0].requestId, payloads[1].requestId);
});

test('print route waits for archived logo decode, retries and cleans URLs', async context => {
  const browser = installPrintBrowser(context);
  let reads = 0;
  const screen = mountScreen('statements/print', {
    searchParams: { clientId: 'C1', cycle: '2026-10-22', version: '3' },
    getStatementPreview: async () => documentFixture,
    clientGet: async () => { reads++; return { data: new Blob(['archived']) }; },
  });
  context.after(() => screen.unmount());
  await screen.flush();
  const print = () => button(screen, 'Print / Save as PDF');
  assert.equal(reads, 1);
  assert.equal(print().disabled, true);
  print().onPress(); assert.equal(browser.printed.length, 0);
  browser.images[0].onerror(); await screen.flush();
  assert.equal(print().disabled, true);
  button(screen, 'Retry').onPress(); await screen.flush();
  assert.deepEqual(browser.revoked, [browser.urls[0]]);
  const decode = deferred(); browser.images[1].decode = () => decode.promise;
  browser.images[1].onload(); await screen.flush();
  assert.equal(print().disabled, true);
  await new Promise(resolve => setTimeout(resolve, 450));
  assert.equal(browser.printed.length, 0);
  decode.resolve(); await screen.flush();
  assert.equal(print().disabled, false);
  assert.equal(screen.props('StatementPaperCard').resolvedLogo.uri, browser.urls[1]);
  await new Promise(resolve => setTimeout(resolve, 450));
  assert.equal(browser.printed.length, 1);
  print().onPress(); assert.equal(browser.printed.length, 2);
  assert.equal(reads, 2);
  screen.unmount();
  assert.deepEqual(browser.revoked, browser.urls);
});

test('print route rejects obsolete version and logo responses', async context => {
  const browser = installPrintBrowser(context);
  const first = deferred(), logo = deferred();
  const versions = [];
  const screen = mountScreen('statements/print', {
    searchParams: { clientId: 'C1', cycle: '2026-10-22', version: '1' },
    getStatementPreview: async (_client, _cycle, options) => {
      versions.push(options.version);
      if (options.version === 1) return first.promise;
      return { ...documentFixture, activeVersion: options.version, logoHash: 'hash' + options.version };
    },
    clientGet: async () => logo.promise,
  });
  context.after(() => screen.unmount());
  await screen.flush();
  screen.changeRoute({ clientId: 'C1', cycle: '2026-10-22', version: '3' }); await screen.flush();
  first.resolve({ ...documentFixture, activeVersion: 1 }); await screen.flush();
  assert.equal(screen.props('StatementPaperCard').data.activeVersion, 3);
  screen.changeRoute({ clientId: 'C1', cycle: '2026-10-22', version: '2' }); await screen.flush();
  logo.resolve({ data: new Blob(['logo']) }); await screen.flush();
  assert.equal(browser.urls.length, 1);
  browser.images[0].onload(); await screen.flush();
  assert.equal(screen.props('StatementPaperCard').data.activeVersion, 2);
  assert.deepEqual(versions, [1, 3, 2]);
});


test('invalid route versions are rejected before API reads', async context => {
  installPrintBrowser(context);
  let reads = 0;
  const screen = mountScreen('statements/print', {
    searchParams: { clientId: 'C1', cycle: '2026-10-22', version: '[object Object]' },
    getStatementPreview: async () => { reads++; return documentFixture; },
  });
  context.after(() => screen.unmount());
  await screen.flush();
  assert.equal(reads, 0);
  assert.match(screen.text(), /Invalid statement version/);
  assert.equal(button(screen, 'Print / Save as PDF').disabled, true);
});

const versionButton = (screen, version) => screen.allProps('TouchableOpacity').find(props =>
  JSON.stringify(props.children).includes('"V",' + version + ','));

test('saving V2 refreshes history and V1 remains selected for archived preview and print', async context => {
  const browser = installPrintBrowser(context);
  let latestVersion = 1;
  let historyReads = 0;
  let shouldFailHistory = false;
  const screen = mountScreen('statements', statementApis({
    statements: async (_client, _cycle, options) => ({ ...documentFixture, latestVersionNumber: latestVersion,
      activeVersion: options?.version || null, totalPaid: options?.version === 1 ? 25 : 200 }),
    listStatementVersions: async (clientId, cycle) => {
      assert.equal(clientId, 'C1'); assert.equal(cycle, '2026-10-22'); historyReads++;
      if (shouldFailHistory) throw new Error('History unavailable');
      return Array.from({ length: latestVersion }, (_, index) => ({ versionNumber: index + 1 }));
    },
    saveStatementVersion: async () => {
      latestVersion = 2; shouldFailHistory = true;
      return { ...documentFixture, latestVersionNumber: 2, activeVersion: 2 };
    },
  }));
  context.after(() => screen.unmount());
  await settleStatement(screen); await settleStatement(screen);
  assert.ok(versionButton(screen, 1));
  await button(screen, 'Prepare New Version').onPress(); await screen.flush();
  await screen.props('DeductionsInputCard').onSave(); await settleStatement(screen);
  assert.match(screen.text(), /Could not load statement versions/);
  assert.ok(versionButton(screen, 1), 'failed refresh retains V1');
  shouldFailHistory = false;
  button(screen, 'Retry').onPress(); await screen.flush();
  assert.ok(versionButton(screen, 1)); assert.ok(versionButton(screen, 2));
  assert.doesNotMatch(screen.text(), /Could not load statement versions/);
  versionButton(screen, 1).onPress(); await settleStatement(screen); await screen.flush();
  assert.equal(screen.props('StatementPaperCard').data.activeVersion, 1);
  assert.equal(screen.props('StatementPaperCard').data.totalPaid, 25);
  await button(screen, 'Print / Export PDF').onPress();
  assert.match(browser.opened[0], /version=1/);
  assert.ok(historyReads >= 3);
});

test('Print captures V1 and refreshes initially empty history with retry support', async context => {
  installPrintBrowser(context);
  let captured = false, shouldFail = true;
  const screen = mountScreen('statements', statementApis({
    statements: async (_client, _cycle, options) => ({ ...documentFixture, hasSnapshot: captured,
      latestVersionNumber: captured ? 1 : null, activeVersion: options?.version || null }),
    listStatementVersions: async () => {
      if (shouldFail) throw new Error('Offline');
      return captured ? [{ versionNumber: 1 }] : [];
    },
    ensureV1Snapshot: async () => { captured = true; return { ...documentFixture, activeVersion: 1 }; },
  }));
  context.after(() => screen.unmount());
  await settleStatement(screen);
  assert.match(screen.text(), /Could not load statement versions/);
  shouldFail = false; button(screen, 'Retry').onPress(); await screen.flush();
  assert.doesNotMatch(screen.text(), /Could not load statement versions/);
  assert.equal(versionButton(screen, 1), undefined);
  await button(screen, 'Print / Export PDF').onPress(); await settleStatement(screen);
  assert.ok(versionButton(screen, 1));
});

for (const change of ['client', 'cycle', 'session', 'unmount']) {
  test(`history cancels and ignores delayed responses after ${change} changes`, async context => {
    const pending = deferred();
    let requestSignal;
    const screen = mountScreen('statements', statementApis({
      listStatementVersions: async (_client, _cycle, options) => {
        requestSignal = options.signal;
        return pending.promise;
      },
    }));
    context.after(() => screen.unmount());
    await settleStatement(screen); await settleStatement(screen);
    const oldSignal = requestSignal;
    assert.ok(oldSignal);
    if (change === 'client') screen.changeRoute({ clientId: 'C2', cycle: '2026-10-22' });
    if (change === 'cycle') screen.changeRoute({ clientId: 'C1', cycle: '2026-10-15' });
    if (change === 'session') screen.invalidate();
    if (change === 'unmount') screen.unmount();
    await screen.flush();
    assert.equal(oldSignal.aborted, true);
    pending.resolve([{ versionNumber: 99 }]); await screen.flush();
    assert.equal(versionButton(screen, 99), undefined);
  });
}
