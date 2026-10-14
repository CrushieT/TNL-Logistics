import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  VEHICLE_OPTION_PAGE_SIZE,
  VEHICLE_RECOMMENDATION_SIZE,
  appendUniqueVehicleOptions,
  buildVehicleOptionParams,
  createVehicleOptionRequestCoordinator,
  hasNextVehicleOptionPage,
  normalizeVehicleSearch
} from '../src/features/scanner/vehicleOptionsFlow.mjs';

describe('Courier vehicle option pagination', () => {
  it('uses the 20-item page default and bounds invalid pagination input', () => {
    assert.equal(VEHICLE_OPTION_PAGE_SIZE, 20);
    assert.deepEqual(buildVehicleOptionParams(), { page: 0, size: 20 });
    assert.deepEqual(buildVehicleOptionParams({ page: -2, size: 500 }), { page: 0, size: 100 });
    assert.deepEqual(buildVehicleOptionParams({ page: 2, size: 0 }), { page: 2, size: 1 });
  });

  it('normalizes vehicle searches and includes only non-empty queries', () => {
    assert.equal(normalizeVehicleSearch('  abc-1234  '), 'ABC-1234');
    assert.equal(normalizeVehicleSearch('   '), '');
    assert.deepEqual(
      buildVehicleOptionParams({ search: '  vh-001  ', size: VEHICLE_RECOMMENDATION_SIZE }),
      { page: 0, size: 8, search: 'VH-001' }
    );
  });

  it('appends pages without duplicate vehicle IDs and preserves server order', () => {
    const merged = appendUniqueVehicleOptions(
      [{ vehicleId: 'VH-003', plateNumber: 'CCC' }, { vehicleId: 'VH-002', plateNumber: 'BBB' }],
      [{ vehicleId: 'VH-002', plateNumber: 'BBB' }, { vehicleId: 'VH-001', plateNumber: 'AAA' }, null]
    );
    assert.deepEqual(merged.map((option) => option.vehicleId), ['VH-003', 'VH-002', 'VH-001']);
  });

  it('detects the final page from Spring page metadata', () => {
    assert.equal(hasNextVehicleOptionPage({ number: 0, totalPages: 2, last: false, empty: false }), true);
    assert.equal(hasNextVehicleOptionPage({ number: 1, totalPages: 2, last: true, empty: false }), false);
    assert.equal(hasNextVehicleOptionPage({ number: 0, totalPages: 0, empty: true }), false);
  });
});

describe('Courier vehicle option request coordination', () => {
  it('blocks concurrent end-of-list requests until the active request finishes', () => {
    const coordinator = createVehicleOptionRequestCoordinator();
    const nextPage = coordinator.beginNextPage();
    assert.equal(coordinator.beginNextPage(), null);
    assert.equal(coordinator.finish(nextPage), true);
    assert.notEqual(coordinator.beginNextPage(), null);
  });

  it('invalidates stale recommendation responses when the query changes', () => {
    const coordinator = createVehicleOptionRequestCoordinator();
    const stale = coordinator.beginRecommendation('ab');
    const current = coordinator.beginRecommendation('abc');

    assert.equal(stale.signal.aborted, true);
    assert.equal(coordinator.isCurrent(stale), false);
    assert.equal(coordinator.isCurrent(current), true);
    assert.equal(current.query, 'ABC');
  });

  it('starting a first page cancels pagination and cancelAll invalidates every request', () => {
    const coordinator = createVehicleOptionRequestCoordinator();
    const pagination = coordinator.beginNextPage();
    const firstPage = coordinator.beginFirstPage();
    const recommendation = coordinator.beginRecommendation('VH-001');

    assert.equal(pagination.signal.aborted, true);
    assert.equal(coordinator.isCurrent(firstPage), true);
    coordinator.cancelAll();
    assert.equal(firstPage.signal.aborted, true);
    assert.equal(recommendation.signal.aborted, true);
    assert.equal(coordinator.isCurrent(firstPage), false);
    assert.equal(coordinator.isCurrent(recommendation), false);
  });
});
