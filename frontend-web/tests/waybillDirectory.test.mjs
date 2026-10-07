import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWaybillDetailRoute,
  buildWaybillListQuery,
  normalizeWaybillPage,
  updateWaybillListState,
} from '../src/features/waybills/waybillDirectory.mjs';

test('builds trimmed waybill directory queries and omits all filters', () => {
  assert.equal(
    buildWaybillListQuery({
      page: 2,
      size: 50,
      search: '  northern client  ',
      status: 'SENT_TO_HAULER',
      client: '  Northern Goods Co  ',
    }),
    'page=2&size=50&search=northern+client&status=SENT_TO_HAULER&client=Northern+Goods+Co'
  );
  assert.equal(buildWaybillListQuery({ status: 'ALL', client: 'ALL' }), 'page=0&size=20');
});

test('normalizes Spring page metadata for table pagination', () => {
  assert.deepEqual(normalizeWaybillPage({
    content: [{ waybillId: 'WYB-1' }],
    number: 3,
    size: 10,
    totalPages: 5,
    totalElements: 43,
  }), {
    content: [{ waybillId: 'WYB-1' }],
    page: 3,
    pageSize: 10,
    totalPages: 5,
    totalElements: 43,
  });
});

test('resets pagination when search, filters, or page size change', () => {
  const initialState = { page: 4, pageSize: 20, search: '', status: 'ALL', client: 'ALL' };
  assert.equal(updateWaybillListState(initialState, { search: 'abc' }).page, 0);
  assert.equal(updateWaybillListState(initialState, { status: 'GENERATED' }).page, 0);
  assert.equal(updateWaybillListState(initialState, { client: 'Northern Goods Co' }).page, 0);
  assert.equal(updateWaybillListState(initialState, { pageSize: 50 }).page, 0);
  assert.equal(updateWaybillListState(initialState, { page: 2 }).page, 2);
});

test('encodes waybill identifiers in detail routes', () => {
  assert.equal(buildWaybillDetailRoute('WYB/2026 001'), '/waybills/WYB%2F2026%20001');
});
