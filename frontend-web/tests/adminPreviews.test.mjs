import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mountScreen, deferred, loadProductionModule } from './previewHarness.mjs';
import * as cache from '../src/services/api/responseCache.mjs';
import * as sessionCore from '../src/services/api/sessionCore.mjs';

beforeEach(() => cache.clearAllCache());
const settle = async screen => { await screen.flush(); await new Promise(resolve => setTimeout(resolve, 330)); await screen.flush(); };
for (const [name, apiKey, table, slot] of [
  ['shipments/index', 'shipments', 'ShipmentsTable', cache.CACHE_SLOTS.SHIPMENTS],
  ['vehicles', 'vehicles', null, cache.CACHE_SLOTS.VEHICLES],
  ['clients/index', 'clients', null, cache.CACHE_SLOTS.CLIENTS],
  ['waybills/index', 'waybills', 'WaybillsTable', cache.CACHE_SLOTS.WAYBILLS],
  ['payments', 'payments', 'PaymentsTable', cache.CACHE_SLOTS.PAYMENTS],
]) {
  test(`${name}: verification, empty success, invalidation and failed refresh`, async () => {
    let reads = 0;
    const screen = mountScreen(name, { [apiKey]: async () => { if (++reads > 1) throw new Error('Offline fixture'); return apiKey === 'vehicles' || apiKey === 'clients' ? [] : { content: [] }; } }, { isVerified: false });
    await settle(screen); assert.equal(reads, 0);
    screen.changeSession({ isVerified: true }); await settle(screen); assert.equal(reads, 1);
    if (table) assert.equal(screen.props(table).loading, false);
    assert.ok(cache.getCacheEntry(slot, { userId: 'ADMIN-A', sessionGeneration: 1, queryParams: apiKey === 'vehicles' || apiKey === 'clients' ? { all: true } : { page: 0, size: 20 } }));
    cache.invalidateResources(apiKey === 'vehicles' ? 'vehicles' : apiKey === 'clients' ? 'clients' : 'shipments');
    await settle(screen);
    const statuses = screen.text(); assert.match(statuses, /stale|Offline fixture/);
    screen.unmount();
  });
  test(`${name}: retained effect replay and late account responses`, async () => {
    const old = deferred(); let reads = 0;
    const screen = mountScreen(name, { [apiKey]: () => ++reads === 1 ? old.promise : Promise.resolve(apiKey === 'vehicles' || apiKey === 'clients' ? [] : { content: [] }) });
    await settle(screen); screen.replayEffects(); await settle(screen);
    assert.equal(reads, 2);
    screen.changeSession({ userId: 'ADMIN-B', sessionGeneration: 2 }); await settle(screen);
    old.resolve([{ shipmentId: 'OBSOLETE' }]); await screen.flush();
    assert.doesNotMatch(screen.text(), /OBSOLETE/); screen.unmount();
  });
}

test('invalidation revisions reject reads started before a successful mutation', () => {
  const slot = cache.CACHE_SLOTS.PAYMENTS;
  const revision = cache.getCacheRevision(slot);
  cache.invalidateMutation({ method: 'post', url: '/payments' });
  assert.equal(cache.setCacheEntry(slot, { userId: 'A', sessionGeneration: 1, data: [], revision }), false);
});

test('Payments disables recording for a matching preview and after invalidation', async () => {
  cache.setCacheEntry(cache.CACHE_SLOTS.PAYMENTS, { userId: 'ADMIN-A', sessionGeneration: 1,
    queryParams: { page: 0, size: 20 }, data: { content: [{ shipmentId: 'S1', balance: 100 }] } });
  const response = deferred();
  const screen = mountScreen('payments', { payments: () => response.promise });
  await settle(screen);
  assert.equal(screen.props('PaymentsTable').canRecordPayment, false);
  screen.props('PaymentsTable').onRecordPayment({ shipmentId: 'S1' }); await screen.flush();
  assert.equal(screen.props('RecordPaymentModal').visible, false);
  response.resolve({ content: [{ shipmentId: 'S1', balance: 75 }] }); await screen.flush();
  assert.equal(screen.props('PaymentsTable').canRecordPayment, true);
  cache.invalidateResources('payments'); await screen.flush();
  assert.equal(screen.props('PaymentsTable').canRecordPayment, false);
  screen.unmount();
});

const statementApi = overrides => ({
  searchParams: { clientId: 'C1', cycle: '2026-10-22' },
  collections: async () => ({ items: [{ clientId: 'C1', clientName: 'Fixture client', statementId: 'SOA1', status: 'SOA_GENERATED' }] }),
  statements: async () => ({ items: [{ shipmentId: 'S1' }], totalCharges: 100, totalPaid: 0, deductionAmount: 0, deductionNote: '', collectedBy: '' }),
  ...overrides,
});

test('Statements preserves dirty drafts and requires persisted-value review before saving', async () => {
  let charges = 100;
  const screen = mountScreen('statements', statementApi({ statements: async () => ({ items: [], totalCharges: charges, totalPaid: 0, deductionAmount: 0, deductionNote: '', collectedBy: '' }) }));
  await settle(screen);
  screen.props('DeductionsInputCard').onDeductionAmountChange('25');
  screen.props('DeductionsInputCard').onDeductionNoteChange('Keep this draft'); await screen.flush();
  charges = 20; cache.invalidateResources('payments'); await settle(screen);
  assert.equal(screen.props('DeductionsInputCard').deductionAmount, '25');
  assert.equal(screen.props('DeductionsInputCard').deductionNote, 'Keep this draft');
  assert.match(screen.text(), /Persisted statement values changed/);
  assert.equal(screen.props('DeductionsInputCard').saveDisabled, true);
  screen.allProps('default').find(props => props.label === 'Keep my adjustments').onPress(); await screen.flush();
  assert.equal(screen.props('DeductionsInputCard').saveDisabled, true);
  screen.props('DeductionsInputCard').onDeductionAmountChange('10'); await screen.flush();
  assert.equal(screen.props('DeductionsInputCard').saveDisabled, false);
  assert.equal(cache.getCacheEntry(cache.CACHE_SLOTS.STATEMENTS, { userId: 'ADMIN-A', sessionGeneration: 1,
    queryParams: { clientId: 'C1', targetDate: '2026-10-22' } }).data.deductionAmount, 0);
  screen.unmount();
});

test('Statements metadata failures stay unavailable instead of becoming an empty client list', async () => {
  const screen = mountScreen('statements', statementApi({ collections: async () => { throw new Error('Metadata unavailable'); } }));
  await settle(screen);
  assert.equal(screen.props('DeductionsInputCard').saveDisabled, true);
  assert.match(screen.props('SearchableClientDropdown').placeholder, /unavailable/);
  assert.doesNotMatch(screen.text(), /No Statements Generated for this Cycle/);
  screen.unmount();
});

test('payment modal waits for a fresh summary and preserves the amount after a changed balance', async () => {
  let balance = 100;
  const screen = mountScreen('features/payments/components/RecordPaymentModal.js', {
    props: { visible: true, shipment: { shipmentId: 'S1', balance: 100 }, onClose() {}, onSubmitPayment: async () => {} },
    paymentSummary: async () => ({ collectibleBalance: balance }),
  });
  await screen.flush();
  assert.equal(screen.allProps('Pressable').at(-1).disabled, true);
  await settle(screen);
  assert.equal(screen.allProps('Pressable').at(-1).disabled, false);
  balance = 50; cache.invalidateResources('payments'); await settle(screen);
  assert.equal(screen.props('TextInput').value, '100');
  assert.match(screen.text(), /Balance changed from/);
  assert.equal(screen.allProps('Pressable').at(-1).disabled, true);
  screen.allProps('Pressable').find(props => JSON.stringify(props.children).includes('Review current balance')).onPress();
  await screen.flush();
  assert.equal(screen.allProps('Pressable').at(-1).disabled, true);
  screen.props('TextInput').onChangeText('40'); await screen.flush();
  assert.equal(screen.allProps('Pressable').at(-1).disabled, false);
  screen.unmount();
});

test('Shipments invalidation during a read rejects the old success and coalesces event bursts', async () => {
  const old = deferred(); let reads = 0;
  const screen = mountScreen('shipments/index', { shipments: () => ++reads === 1 ? old.promise : Promise.resolve({ content: [{ shipmentId: 'CURRENT' }] }) });
  await settle(screen);
  for (let index = 0; index < 5; index++) screen.emit();
  old.resolve({ content: [{ shipmentId: 'OBSOLETE' }] }); await screen.flush();
  assert.doesNotMatch(screen.text(), /OBSOLETE/);
  await settle(screen); assert.equal(reads, 2);
  assert.equal(screen.props('ShipmentsTable').shipments[0].shipmentId, 'CURRENT');
  screen.unmount();
});

test('Shipments rapid search changes accept only the current query', async () => {
  const old = deferred(); const queries = [];
  const screen = mountScreen('shipments/index', { shipments: query => {
    queries.push(query); return queries.length === 1 ? old.promise : Promise.resolve({ content: [{ shipmentId: query.search }] });
  } });
  await settle(screen);
  // SearchFilterBar has a default export; identify it by its production props.
  const searchBar = () => screen.allProps('default').find(props => props.onSearchChange);
  searchBar().onSearchChange('first'); await screen.flush();
  searchBar().onSearchChange('second'); await settle(screen);
  old.reject(new Error('Old filter error')); await screen.flush();
  assert.equal(queries.length, 2); assert.equal(queries[1].search, 'second');
  assert.equal(screen.props('ShipmentsTable').shipments[0].shipmentId, 'second');
  assert.doesNotMatch(screen.text(), /Old filter error/); screen.unmount();
});

test('Shipments hidden refresh resumes once and malformed refresh retains matching stale rows with Retry', async () => {
  let reads = 0;
  const screen = mountScreen('shipments/index', { shipments: async () => ++reads === 1 ? { content: [{ shipmentId: 'S1' }] } : null });
  await settle(screen);
  const coordinator = screen.coordinators.get(cache.CACHE_SLOTS.SHIPMENTS);
  coordinator.setVisibility(false); screen.emit(); await settle(screen); assert.equal(reads, 1);
  await coordinator.setVisibility(true); await screen.flush(); assert.equal(reads, 2);
  assert.equal(screen.props('ShipmentsTable').shipments[0].shipmentId, 'S1');
  const status = screen.allProps('default').find(props => props.label === 'Shipments');
  assert.equal(status.resource.phase, 'stale'); assert.match(status.resource.error, /Invalid/);
  await status.resource.refresh(false); await screen.flush(); assert.equal(reads, 3);
  screen.unmount();
});

test('Shipments and Waybills reuse matching directory previews while reference requests remain pending', async () => {
  for (const [name, slot, key, data] of [
    ['shipments/index', cache.CACHE_SLOTS.VEHICLES, 'vehicles', [{ vehicleId: 'V1', plateNumber: 'TEST' }]],
    ['waybills/index', cache.CACHE_SLOTS.CLIENTS, 'clients', [{ clientId: 'C1', name: 'Fixture client' }]],
  ]) {
    cache.setCacheEntry(slot, { userId: 'ADMIN-A', sessionGeneration: 1, queryParams: { all: true }, data });
    const pending = deferred();
    const screen = mountScreen(name, { [key]: () => pending.promise }); await settle(screen);
    const filters = screen.allProps('default').find(props => props.onSearchChange).filters;
    assert.equal(filters.at(-1).options.length, 2);
    screen.unmount(); pending.resolve([]);
  }
});

test('Statements confirms discard and can explicitly use updated server adjustments', async () => {
  const previousWindow = globalThis.window; let permitsDiscard = false; let confirmations = 0;
  globalThis.window = { addEventListener() {}, removeEventListener() {}, confirm() { confirmations++; return permitsDiscard; } };
  let deduction = 0;
  const screen = mountScreen('statements', statementApi({ statements: async () => ({ items: [], totalCharges: 100, totalPaid: 0, deductionAmount: deduction }) }));
  try {
    await settle(screen);
    screen.props('DeductionsInputCard').onDeductionAmountChange('10'); await screen.flush();
    screen.props('CycleDropdown').onSelectCycle('2026-10-15'); await screen.flush();
    assert.equal(confirmations, 1); assert.equal(screen.props('CycleDropdown').selectedCycle, '2026-10-22');
    deduction = 5; cache.invalidateResources('soa'); await settle(screen);
    screen.allProps('default').find(props => props.label === 'Use server values').onPress(); await screen.flush();
    assert.equal(screen.props('DeductionsInputCard').deductionAmount, '5');
    assert.equal(screen.props('DeductionsInputCard').saveDisabled, false);
    screen.props('DeductionsInputCard').onDeductionNoteChange('draft'); await screen.flush();
    permitsDiscard = true; screen.props('CycleDropdown').onSelectCycle('2026-10-15'); await settle(screen);
    assert.equal(screen.props('CycleDropdown').selectedCycle, '2026-10-15');
    assert.equal(screen.props('DeductionsInputCard').deductionNote, '');
  } finally { screen.unmount(); globalThis.window = previousWindow; }
});

test('actual shared API adapter invalidates successful mutations but retains data after failures', async () => {
  let requestInterceptor; let responseInterceptor; let shouldFail = false;
  const now = Math.floor(Date.now() / 1000);
  const token = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'fixture', uid: 'A', role: 'ADMIN', exp: now + 1200 })).toString('base64url')}.fixture`;
  const transport = {
    interceptors: { request: { use(callback) { requestInterceptor = callback; } }, response: { use(callback) { responseInterceptor = callback; } } },
    async post(url, payload) {
      const config = requestInterceptor({ method: 'post', url });
      if (shouldFail) throw new Error('Fixture rejected');
      return responseInterceptor({ config, data: payload, headers: {} });
    },
  };
  const client = loadProductionModule('../src/services/api/client.js', dependency => {
    if (dependency === 'axios') return { create: () => transport, post: async () => ({ data: { token, userId: 'A', role: 'ADMIN' } }) };
    if (dependency === 'react-native') return { Platform: { OS: 'test' } };
    return dependency.endsWith('/sessionCore.mjs') ? sessionCore : cache;
  });
  await client.login('fixture', 'fixture-only');
  const payments = loadProductionModule('../src/features/payments/services/paymentApi.js', () => client);
  const auth = client.getSessionAuthContext();
  cache.setCacheEntry(cache.CACHE_SLOTS.PAYMENTS, { ...auth, data: [] });
  const revision = cache.getCacheRevision(cache.CACHE_SLOTS.PAYMENTS);
  shouldFail = true; await assert.rejects(payments.recordPayment({ shipmentId: 'fixture' }));
  assert.equal(cache.getCacheRevision(cache.CACHE_SLOTS.PAYMENTS), revision); assert.equal(cache.getCacheStats().entryCount, 1);
  shouldFail = false; await payments.recordPayment({ shipmentId: 'fixture' });
  assert.equal(cache.getCacheRevision(cache.CACHE_SLOTS.PAYMENTS), revision + 1); assert.equal(cache.getCacheStats().entryCount, 0);
});

test('Statements stored-session verification, replay and logout reject old previews and drafts', async () => {
  const old = deferred(); let reads = 0;
  const screen = mountScreen('statements', statementApi({ statements: () => ++reads === 1 ? old.promise : Promise.resolve({ items: [], totalCharges: 100, deductionAmount: 0 }) }), { isVerified: false });
  await settle(screen); assert.equal(reads, 0);
  screen.changeSession({ isVerified: true }); await settle(screen); assert.equal(reads, 1);
  screen.replayEffects(); await settle(screen); assert.equal(reads, 2);
  screen.props('DeductionsInputCard').onDeductionNoteChange('Private draft'); await screen.flush();
  screen.invalidate(); await screen.flush(); old.resolve({ items: [], totalCharges: 999, deductionNote: 'Obsolete draft' }); await screen.flush();
  assert.equal(screen.props('DeductionsInputCard').deductionNote, '');
  assert.equal(screen.props('DeductionsInputCard').saveDisabled, true);
  assert.doesNotMatch(screen.text(), /Private draft|Obsolete draft|999/);
  assert.equal(cache.getCacheStats().entryCount, 0); screen.unmount();
});

test('Statements printing is enabled only for a fresh persisted preview with no draft', async () => {
  const screen = mountScreen('statements', statementApi({ statements: async () => ({ items: [{ shipmentId: 'S1' }], totalCharges: 100, totalPaid: 0,
    deductionAmount: 0, isSaved: true, soaBankName: 'Fixture Bank', soaAccountName: 'Fixture Account', soaAccountNumber: '001234567890' }) }));
  await settle(screen);
  const print = () => screen.allProps('TouchableOpacity').find(props => JSON.stringify(props.children).includes('Print / Export PDF'));
  assert.equal(print().disabled, false);
  screen.props('DeductionsInputCard').onDeductionNoteChange('Draft'); await screen.flush(); assert.equal(print().disabled, true);
  screen.props('DeductionsInputCard').onDeductionNoteChange(''); await screen.flush(); assert.equal(print().disabled, false);
  cache.invalidateResources('soa'); await screen.flush(); assert.equal(print().disabled, true);
  screen.unmount();
});

const cycleSelector = screen => screen.props('CycleDropdown') || screen.allProps('default').find(props => Array.isArray(props.cycles));

for (const page of ['index', 'weekly-collections']) {
  test(`${page}: invalidation during initial cycle discovery schedules one replacement after a burst`, async context => {
    const obsolete = deferred();
    let cycleReads = 0;
    let obsoleteSignal;
    const summaryCycles = [];
    const screen = mountScreen(page, {
      cycles: options => {
        cycleReads++;
        if (cycleReads === 1) { obsoleteSignal = options.signal; return obsolete.promise; }
        return Promise.resolve([{ isoDate: '2026-10-22' }, { isoDate: '2026-10-15' }]);
      },
      [page === 'index' ? 'dashboard' : 'collections']: async cycle => { summaryCycles.push(cycle); return { items: [], shipmentCount: 7 }; },
    });
    context.after(() => screen.unmount());
    await settle(screen);
    assert.equal(cycleReads, 1);
    for (let event = 0; event < 5; event++) screen.emit();
    obsolete.resolve([{ isoDate: '1999-01-07' }]);
    await screen.flush();
    assert.doesNotMatch(screen.text(), /1999-01-07/);
    await settle(screen);
    assert.equal(cycleReads, 2);
    assert.equal(obsoleteSignal.aborted, true);
    assert.equal(cycleSelector(screen).selectedCycle, '2026-10-22');
    assert.deepEqual(summaryCycles, ['2026-10-22']);
  });

  test(`${page}: logout during invalidated cycle discovery prevents replacement and late writes`, async context => {
    const obsolete = deferred(); let cycleReads = 0; let signal; let summaries = 0;
    const screen = mountScreen(page, {
      cycles: options => { cycleReads++; signal = options.signal; return obsolete.promise; },
      [page === 'index' ? 'dashboard' : 'collections']: async () => { summaries++; return { items: [] }; },
    });
    context.after(() => screen.unmount());
    await settle(screen);
    screen.emit(); screen.invalidate(); await screen.flush();
    obsolete.resolve([{ isoDate: '1999-01-07' }]); await settle(screen);
    assert.equal(signal.aborted, true);
    assert.equal(cycleReads, 1); assert.equal(summaries, 0);
    assert.equal(cache.getCacheStats().entryCount, 0);
    assert.equal(cycleSelector(screen)?.cycles?.length || 0, 0);
    assert.doesNotMatch(screen.text(), /1999-01-07/);
  });

  test(`${page}: cycle previews preserve ordering and valid selection until fresh discovery`, async context => {
    const pending = deferred();
    const cachedCycles = [{ isoDate: '2026-10-15' }, { isoDate: '2026-10-08' }];
    const timestamp = Date.now() - 1000;
    cache.setCacheEntry(cache.CACHE_SLOTS.COLLECTION_CYCLES, { userId: 'ADMIN-A', sessionGeneration: 1, queryParams: {}, data: cachedCycles, now: timestamp });
    const screen = mountScreen(page, { cycles: () => pending.promise });
    context.after(() => screen.unmount());
    await screen.flush();
    assert.deepEqual(cycleSelector(screen).cycles, cachedCycles);
    assert.equal(cycleSelector(screen).selectedCycle, '2026-10-15');
    const preview = screen.allProps('default').find(props => props.label === 'Collection cycles').resource;
    assert.equal(preview.isFresh, false); assert.equal(preview.timestamp, timestamp);
    cycleSelector(screen).onSelectCycle('2026-10-08'); await screen.flush();
    pending.resolve([{ isoDate: '2026-10-22' }, { isoDate: '2026-10-08' }]); await screen.flush();
    assert.equal(cycleSelector(screen).selectedCycle, '2026-10-08');
    assert.deepEqual(cycleSelector(screen).cycles.map(cycle => cycle.isoDate), ['2026-10-22', '2026-10-08']);
    assert.equal(screen.allProps('default').find(props => props.label === 'Collection cycles').resource.isFresh, true);
  });

  test(`${page}: failed discovery stays retryable and a successful empty result retains its fallback cycle`, async context => {
    let reads = 0; const summaries = [];
    const screen = mountScreen(page, {
      cycles: async () => { if (++reads === 1) throw new Error('Cycle discovery unavailable'); return []; },
      [page === 'index' ? 'dashboard' : 'collections']: async cycle => { summaries.push(cycle); return { items: [], shipmentCount: 0 }; },
    });
    context.after(() => screen.unmount());
    await screen.flush();
    const failure = screen.allProps('default').find(props => props.label === 'Collection cycles').resource;
    assert.equal(failure.phase, 'error'); assert.match(failure.error, /Cycle discovery unavailable/);
    assert.deepEqual(summaries, []);
    await failure.refresh(false); await screen.flush();
    assert.equal(reads, 2);
    assert.equal(cycleSelector(screen).selectedCycle, '2026-10-22');
    assert.deepEqual(summaries, ['2026-10-22']);
    assert.deepEqual(cache.getCacheEntry(cache.CACHE_SLOTS.COLLECTION_CYCLES, { userId: 'ADMIN-A', sessionGeneration: 1, queryParams: {} }).data, []);
  });
}

function routeStatementApi(overrides = {}) {
  return statementApi({
    collections: async () => ({ items: ['C2', 'C1', 'C3'].map(clientId => ({ clientId, statementId: `SOA-${clientId}`, status: 'SOA_GENERATED' })) }),
    ...overrides,
  });
}

for (const clientId of ['C1', 'C3']) {
  test(`Statements route changes cycle and ${clientId === 'C1' ? 'retains the requested client' : 'client together'}`, async context => {
    const metadata = deferred(); const previews = [];
    const screen = mountScreen('statements', routeStatementApi({
      collections: async cycle => cycle === '2026-10-15' ? metadata.promise : { items: ['C2', 'C1', 'C3'].map(id => ({ clientId: id, statementId: `SOA-${id}`, status: 'SOA_GENERATED' })) },
      statements: async (id, cycle) => { previews.push({ clientId: id, cycle }); return { items: [], totalCharges: 100, deductionAmount: 0 }; },
    }));
    context.after(() => screen.unmount());
    await settle(screen);
    screen.changeRoute({ clientId, cycle: '2026-10-15' }); await settle(screen);
    assert.equal(screen.props('SearchableClientDropdown').selectedClientId, clientId);
    assert.equal(screen.props('CycleDropdown').selectedCycle, '2026-10-15');
    assert.equal(screen.props('DeductionsInputCard').saveDisabled, true);
    metadata.resolve({ items: ['C2', 'C1', 'C3'].map(id => ({ clientId: id, statementId: `SOA-${id}`, status: 'SOA_GENERATED' })) });
    await settle(screen);
    assert.equal(screen.props('SearchableClientDropdown').selectedClientId, clientId);
    assert.equal(screen.props('DeductionsInputCard').saveDisabled, false);
    assert.deepEqual(previews.at(-1), { clientId, cycle: '2026-10-15' });
    assert.equal(previews.some(request => request.clientId === 'C2'), false);
  });
}

test('Statements unavailable route client is explicit and never replaced by a default client', async context => {
  const previews = [];
  const screen = mountScreen('statements', routeStatementApi({
    collections: async cycle => ({ items: (cycle === '2026-10-15' ? ['C2'] : ['C1']).map(clientId => ({ clientId, statementId: `SOA-${clientId}`, status: 'SOA_GENERATED' })) }),
    statements: async (clientId, cycle) => { previews.push({ clientId, cycle }); return { items: [], totalCharges: 100, deductionAmount: 0 }; },
  }));
  context.after(() => screen.unmount());
  await settle(screen);
  screen.changeRoute({ clientId: 'C1', cycle: '2026-10-15' }); await settle(screen);
  assert.equal(screen.props('SearchableClientDropdown').selectedClientId, 'C1');
  assert.match(screen.allProps('Text').map(props => props.children.join('')).join('\n'), /Requested client C1 is unavailable for collection cycle 2026-10-15/);
  assert.equal(screen.props('DeductionsInputCard').saveDisabled, true);
  assert.equal(previews.some(request => request.clientId === 'C2'), false);
});

for (const acceptsDiscard of [false, true]) {
  test(`Statements dirty route change makes one discard decision and ${acceptsDiscard ? 'applies both parameters' : 'retains selection and draft'}`, async context => {
    const previousWindow = globalThis.window; let confirmations = 0;
    globalThis.window = { addEventListener() {}, removeEventListener() {}, confirm() { confirmations++; return acceptsDiscard; } };
    const screen = mountScreen('statements', routeStatementApi());
    context.after(() => { screen.unmount(); globalThis.window = previousWindow; });
    await settle(screen);
    screen.props('DeductionsInputCard').onDeductionAmountChange('10');
    screen.props('DeductionsInputCard').onDeductionNoteChange('Retain this draft'); await screen.flush();
    screen.changeRoute({ clientId: 'C3', cycle: '2026-10-15' }); await settle(screen);
    assert.equal(confirmations, 1);
    assert.equal(screen.props('SearchableClientDropdown').selectedClientId, acceptsDiscard ? 'C3' : 'C1');
    assert.equal(screen.props('CycleDropdown').selectedCycle, acceptsDiscard ? '2026-10-15' : '2026-10-22');
    assert.equal(screen.props('DeductionsInputCard').deductionAmount, acceptsDiscard ? '0' : '10');
    assert.equal(screen.props('DeductionsInputCard').deductionNote, acceptsDiscard ? '' : 'Retain this draft');
  });
}
