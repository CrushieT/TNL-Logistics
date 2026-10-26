import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHIPMENT_OPTION_PAGE_SIZE,
  SHIPMENT_RECOMMENDATION_SIZE,
  appendUniqueShipmentOptions,
  buildShipmentOptionParams,
  createShipmentOptionRequestCoordinator,
  hasNextShipmentOptionPage,
  normalizeShipmentSearch
} from '../src/features/waybills/shipmentOptionsFlow.mjs';

describe('Waybill shipment option pagination', () => {
  it('uses the 20-item page default and bounds invalid pagination input', () => {
    assert.equal(SHIPMENT_OPTION_PAGE_SIZE, 20);
    assert.deepEqual(buildShipmentOptionParams(), { page: 0, size: 20 });
    assert.deepEqual(buildShipmentOptionParams({ page: -2, size: 500 }), { page: 0, size: 100 });
    assert.deepEqual(buildShipmentOptionParams({ page: 2, size: 0 }), { page: 2, size: 1 });
  });

  it('normalizes shipment searches and includes only non-empty queries', () => {
    assert.equal(normalizeShipmentSearch('  shp-2026-001  '), 'SHP-2026-001');
    assert.equal(normalizeShipmentSearch('   '), '');
    assert.deepEqual(
      buildShipmentOptionParams({ search: '  shp-2026  ', size: SHIPMENT_RECOMMENDATION_SIZE }),
      { page: 0, size: 8, search: 'SHP-2026' }
    );
  });

  it('appends pages without duplicate shipment IDs and preserves server order', () => {
    const merged = appendUniqueShipmentOptions(
      [{ shipmentId: 'SHP-3' }, { shipmentId: 'SHP-2' }],
      [{ shipmentId: 'SHP-2' }, { shipmentId: 'SHP-1' }, null]
    );
    assert.deepEqual(merged.map((option) => option.shipmentId), ['SHP-3', 'SHP-2', 'SHP-1']);
  });

  it('detects the final page from Spring page metadata', () => {
    assert.equal(hasNextShipmentOptionPage({ number: 0, totalPages: 2, last: false, empty: false }), true);
    assert.equal(hasNextShipmentOptionPage({ number: 1, totalPages: 2, last: true, empty: false }), false);
    assert.equal(hasNextShipmentOptionPage({ number: 0, totalPages: 0, empty: true }), false);
  });
});

describe('Waybill shipment option request coordination', () => {
  it('blocks concurrent end-of-list requests until the active request finishes', () => {
    const coordinator = createShipmentOptionRequestCoordinator();
    const nextPage = coordinator.beginNextPage();
    assert.equal(coordinator.beginNextPage(), null);
    assert.equal(coordinator.finish(nextPage), true);
    assert.notEqual(coordinator.beginNextPage(), null);
  });

  it('invalidates stale recommendation responses when the query changes', () => {
    const coordinator = createShipmentOptionRequestCoordinator();
    const stale = coordinator.beginRecommendation('sh');
    const current = coordinator.beginRecommendation('shp');

    assert.equal(stale.signal.aborted, true);
    assert.equal(coordinator.isCurrent(stale), false);
    assert.equal(coordinator.isCurrent(current), true);
    assert.equal(current.query, 'SHP');
  });

  it('starting a first page cancels pagination and cancelAll invalidates every request', () => {
    const coordinator = createShipmentOptionRequestCoordinator();
    const pagination = coordinator.beginNextPage();
    const firstPage = coordinator.beginFirstPage();
    const recommendation = coordinator.beginRecommendation('SHP');

    assert.equal(pagination.signal.aborted, true);
    assert.equal(coordinator.isCurrent(firstPage), true);
    coordinator.cancelAll();
    assert.equal(firstPage.signal.aborted, true);
    assert.equal(recommendation.signal.aborted, true);
    assert.equal(coordinator.isCurrent(firstPage), false);
    assert.equal(coordinator.isCurrent(recommendation), false);
  });
});
