import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAYBILL_OPTION_PAGE_SIZE,
  WAYBILL_RECOMMENDATION_SIZE,
  appendUniqueWaybillOptions,
  buildWaybillOptionParams,
  createWaybillOptionRequestCoordinator,
  hasNextWaybillOptionPage,
  normalizeWaybillSearch
} from '../src/features/waybills/waybillOptionsFlow.mjs';

describe('Returned waybill option pagination', () => {
  it('defaults to 20 sent waybills and bounds pagination input', () => {
    assert.equal(WAYBILL_OPTION_PAGE_SIZE, 20);
    assert.deepEqual(buildWaybillOptionParams(), {
      page: 0,
      size: 20,
      status: 'SENT_TO_HAULER'
    });
    assert.deepEqual(buildWaybillOptionParams({ page: -1, size: 500, status: null }), {
      page: 0,
      size: 100
    });
  });

  it('normalizes typed waybill numbers and caps recommendations at eight', () => {
    assert.equal(normalizeWaybillSearch('  wyb-2026-0001  '), 'WYB-2026-0001');
    assert.deepEqual(
      buildWaybillOptionParams({ search: ' wyb-2026 ', size: WAYBILL_RECOMMENDATION_SIZE }),
      { page: 0, size: 8, search: 'WYB-2026', status: 'SENT_TO_HAULER' }
    );
  });

  it('merges pages without duplicate waybill numbers', () => {
    const merged = appendUniqueWaybillOptions(
      [{ waybillId: 'WYB-3' }, { waybillId: 'WYB-2' }],
      [{ waybillId: 'WYB-2' }, { waybillId: 'WYB-1' }, null]
    );
    assert.deepEqual(merged.map((option) => option.waybillId), ['WYB-3', 'WYB-2', 'WYB-1']);
  });

  it('detects whether another Spring page exists', () => {
    assert.equal(hasNextWaybillOptionPage({ number: 0, totalPages: 2, last: false, empty: false }), true);
    assert.equal(hasNextWaybillOptionPage({ number: 1, totalPages: 2, last: true, empty: false }), false);
    assert.equal(hasNextWaybillOptionPage({ empty: true }), false);
  });
});

describe('Returned waybill request coordination', () => {
  it('blocks duplicate pagination and ignores stale searches', () => {
    const coordinator = createWaybillOptionRequestCoordinator();
    const pagination = coordinator.beginNextPage();
    assert.equal(coordinator.beginNextPage(), null);
    assert.equal(coordinator.finish(pagination), true);

    const stale = coordinator.beginRecommendation('wy');
    const current = coordinator.beginRecommendation('wyb');
    assert.equal(stale.signal.aborted, true);
    assert.equal(coordinator.isCurrent(stale), false);
    assert.equal(coordinator.isCurrent(current), true);
  });

  it('cancelAll aborts recent and recommendation requests', () => {
    const coordinator = createWaybillOptionRequestCoordinator();
    const recent = coordinator.beginFirstPage();
    const recommendation = coordinator.beginRecommendation('WYB');
    coordinator.cancelAll();
    assert.equal(recent.signal.aborted, true);
    assert.equal(recommendation.signal.aborted, true);
  });
});
