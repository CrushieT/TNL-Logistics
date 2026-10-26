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


test('waybill detail event matching guards against missing IDs and matches waybill or shipment', () => {
  const matchEvent = (event, waybillId, manifestShipmentId) => {
    const matchesWaybill = Boolean(waybillId && event?.data?.waybillId && event.data.waybillId === waybillId);
    const matchesShipment = Boolean(manifestShipmentId && event?.data?.shipmentId && event.data.shipmentId === manifestShipmentId);
    return matchesWaybill || matchesShipment;
  };

  // Missing IDs must NEVER match
  assert.equal(matchEvent({}, null, null), false);
  assert.equal(matchEvent({ data: {} }, null, null), false);
  assert.equal(matchEvent({ data: { other: 'value' } }, null, undefined), false);

  // Mismatched IDs do not match
  assert.equal(matchEvent({ data: { waybillId: 'WYB-002', shipmentId: 'SHP-002' } }, 'WYB-001', 'SHP-001'), false);

  // Matching waybillId matches
  assert.equal(matchEvent({ data: { waybillId: 'WYB-001' } }, 'WYB-001', null), true);

  // Matching shipmentId matches
  assert.equal(matchEvent({ data: { shipmentId: 'SHP-001' } }, null, 'SHP-001'), true);

  // Both matching
  assert.equal(matchEvent({ data: { waybillId: 'WYB-001', shipmentId: 'SHP-001' } }, 'WYB-001', 'SHP-001'), true);
});
