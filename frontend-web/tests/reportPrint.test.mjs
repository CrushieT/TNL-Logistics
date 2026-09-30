import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REPORT_PAGE_CONTENT_UNITS,
  buildReportPrintUrl,
  createPrintableReportModel,
  normalizeReportPrintParams,
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
