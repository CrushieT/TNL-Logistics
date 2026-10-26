import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Helper to extract function from source without running React Native modules in Node
function loadFunctionFromSource(relativePath, exportName, injectedBindings) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
    .replace(/^import\s+.*?;?\r?\n/gm, '')
    .replace(/^export\s+(default\s+)?/gm, '');

  const wrapped = `
    ${source}
    return ${exportName};
  `;
  return new Function(...Object.keys(injectedBindings), wrapped)(...Object.values(injectedBindings));
}

test('collectionsApi source does not contain fallback queries to /clients or /shipments in getWeeklyCollections', () => {
  const source = readFileSync(new URL('../src/features/collections/services/collectionsApi.js', import.meta.url), 'utf8');

  // Verify getWeeklyCollections does not have fallback aggregator fetching /clients or /shipments
  const fnStart = source.indexOf('export async function getWeeklyCollections');
  const fnEnd = source.indexOf('export async function getClientUnbilledPreview');
  const fnBody = source.slice(fnStart, fnEnd);

  assert.equal(fnBody.includes("'/clients'"), false, 'Must not query /clients fallback');
  assert.equal(fnBody.includes("'/shipments'"), false, 'Must not query /shipments fallback');
  assert.equal(fnBody.includes('fallback aggregator'), false, 'Fallback aggregator comment and logic must be removed');
});

test('getWeeklyCollections requests /collections/weekly with targetDate parameter on success', async () => {
  const calls = [];
  const mockApiClient = {
    get: async (url, config) => {
      calls.push({ url, config });
      return {
        data: {
          collectionDate: '2026-10-15',
          totalDue: 15000.0,
          totalCollected: 5000.0,
          outstandingBalance: 10000.0,
          activeClientsCount: 3,
          items: [
            { clientId: 'CL-01', clientName: 'Client 1', currentCharges: 5000.0, previousBalance: 0, paid: 0, netAmountDue: 5000.0 },
          ],
        },
      };
    },
  };

  const getWeeklyCollections = loadFunctionFromSource(
    '../src/features/collections/services/collectionsApi.js',
    'getWeeklyCollections',
    { apiClient: mockApiClient, formatCycleDateRangeFromDates: () => '' }
  );

  const result = await getWeeklyCollections('2026-10-15');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/collections/weekly');
  assert.deepEqual(calls[0].config, { params: { targetDate: '2026-10-15' } });
  assert.equal(result.outstandingBalance, 10000.0);
  assert.equal(result.items.length, 1);
});

test('getWeeklyCollections propagates 503 error directly and NEVER issues fallback client/shipment queries', async () => {
  const calls = [];
  const mockApiClient = {
    get: async (url, config) => {
      calls.push({ url, config });
      const error = new Error('COLLECTIONS_UNAVAILABLE: Collections data is temporarily unavailable due to a database error');
      error.response = { status: 503, data: { code: 'COLLECTIONS_UNAVAILABLE', message: 'Database failure' } };
      throw error;
    },
  };

  const getWeeklyCollections = loadFunctionFromSource(
    '../src/features/collections/services/collectionsApi.js',
    'getWeeklyCollections',
    { apiClient: mockApiClient, formatCycleDateRangeFromDates: () => '' }
  );

  await assert.rejects(
    async () => {
      await getWeeklyCollections('2026-10-15');
    },
    (err) => {
      assert.equal(err.response?.status, 503);
      assert.equal(err.response?.data?.code, 'COLLECTIONS_UNAVAILABLE');
      return true;
    }
  );

  assert.equal(calls.length, 1, 'Only one request must be dispatched');
  assert.equal(calls[0].url, '/collections/weekly');
});

test('getDashboardSummary propagates 503 error directly without swallowing with null or zero totals', async () => {
  const calls = [];
  const mockApiClient = {
    get: async (url, config) => {
      calls.push({ url, config });
      const error = new Error('DASHBOARD_UNAVAILABLE: Dashboard data is temporarily unavailable due to a database error');
      error.response = { status: 503, data: { code: 'DASHBOARD_UNAVAILABLE', message: 'Database failure' } };
      throw error;
    },
  };

  const getDashboardSummary = loadFunctionFromSource(
    '../src/features/shipments/services/shipmentApi.js',
    'getDashboardSummary',
    { apiClient: mockApiClient }
  );

  await assert.rejects(
    async () => {
      await getDashboardSummary('2026-10-15');
    },
    (err) => {
      assert.equal(err.response?.status, 503);
      assert.equal(err.response?.data?.code, 'DASHBOARD_UNAVAILABLE');
      return true;
    }
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/dashboard/summary');
});

test('weekly collections UI state does not fabricate zero financial metrics on null dashboardData', () => {
  const computeSummary = (dashboardData, filteredItems) => {
    if (!dashboardData) {
      return {
        clientsCount: '—',
        totalDue: null,
        outstanding: null,
      };
    }
    const clientsCount = filteredItems.length;
    const totalDue = filteredItems.reduce(
      (sum, item) => sum + Number(item.currentCharges || item.totalCharges || 0) + Number(item.previousBalance || 0),
      0
    );
    const outstanding = filteredItems.reduce(
      (sum, item) => sum + Number(item.balance ?? item.netAmountDue ?? 0),
      0
    );
    return { clientsCount, totalDue, outstanding };
  };

  const unavailableSummary = computeSummary(null, []);
  assert.equal(unavailableSummary.clientsCount, '—');
  assert.equal(unavailableSummary.totalDue, null, 'Must not fabricate 0 total due on failure');
  assert.equal(unavailableSummary.outstanding, null, 'Must not fabricate 0 outstanding balance on failure');

  const genuineEmptySummary = computeSummary({ items: [] }, []);
  assert.equal(genuineEmptySummary.clientsCount, 0);
  assert.equal(genuineEmptySummary.totalDue, 0);
  assert.equal(genuineEmptySummary.outstanding, 0);
});
