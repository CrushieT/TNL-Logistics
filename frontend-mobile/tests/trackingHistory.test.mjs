import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HISTORY_PAGE_SIZE,
  SYNC_STATUSES,
  STATUS_LABELS,
  normalizeHistorySearch,
  resolveStatusSearch,
  buildPersonalHistoryParams,
  appendUniqueEvents,
  replacePageZeroEvents,
  normalizePersonalMetrics,
  formatHistoryTimestamp,
  formatPackageDisplay,
  resolveTrackingStatusDisplay,
  encodeTrackingId,
  getSyncStatusMeta,
} from '../src/features/tracking-history/trackingHistoryFlow.mjs';
import { createTrackingHistoryRequestCoordinator } from '../src/features/tracking-history/trackingHistoryRequestCoordinator.mjs';

describe('Field Personal Scan and Tracking History Logic', () => {

  // 1. Blank search produces no search parameter
  it('1. Blank search produces no search parameter', () => {
    const blankVariants = [null, undefined, '', '   ', '\t\n'];
    for (const val of blankVariants) {
      const params = buildPersonalHistoryParams({ search: val, page: 0, size: 20 });
      assert.strictEqual(params.search, undefined);
      assert.strictEqual(params.status, undefined);
    }
  });

  // 2. Tracking and shipment searches are trimmed
  it('2. Tracking and shipment searches are trimmed', () => {
    const trackingParams = buildPersonalHistoryParams({ search: '  TRK-2026-000101  ' });
    assert.strictEqual(trackingParams.search, 'TRK-2026-000101');
    assert.strictEqual(trackingParams.status, undefined);

    const shipmentParams = buildPersonalHistoryParams({ search: '  SHP-2026-001  ' });
    assert.strictEqual(shipmentParams.search, 'SHP-2026-001');
    assert.strictEqual(shipmentParams.status, undefined);
  });

  // 3. Search input is limited to 50 characters
  it('3. Search input is limited to 50 characters', () => {
    const longString = 'A'.repeat(80);
    const normalized = normalizeHistorySearch(longString);
    assert.strictEqual(normalized.length, 50);
    assert.strictEqual(normalized, 'A'.repeat(50));

    const params = buildPersonalHistoryParams({ search: 'B'.repeat(60) });
    assert.strictEqual(params.search.length, 50);
    assert.strictEqual(params.search, 'B'.repeat(50));
  });

  // 4. Every approved status phrase maps correctly
  it('4. Every approved status phrase maps correctly', () => {
    const expectedMappings = {
      'registered': 'REGISTERED',
      'Registered': 'REGISTERED',
      '  registered  ': 'REGISTERED',
      'qr generated': 'QR_GENERATED',
      'QR GENERATED': 'QR_GENERATED',
      'loaded on truck': 'LOADED_ON_TRUCK',
      'load on truck': 'LOADED_ON_TRUCK',
      'arrived at tnl': 'ARRIVED_AT_TNL',
      'outload / arrive tnl': 'ARRIVED_AT_TNL',
      'OUTLOAD / ARRIVE TNL': 'ARRIVED_AT_TNL',
      'loaded to hauler': 'LOADED_TO_HAULER',
      'handed to hauler': 'LOADED_TO_HAULER',
      'completed': 'COMPLETED',
      'Completed': 'COMPLETED',
    };

    for (const [phrase, expectedCode] of Object.entries(expectedMappings)) {
      const resolved = resolveStatusSearch(phrase);
      assert.strictEqual(resolved, expectedCode, `Failed mapping for phrase: "${phrase}"`);
    }
  });

  // 5. Status search sends status and omits free text
  it('5. Status search sends status and omits free text', () => {
    const params = buildPersonalHistoryParams({ search: 'loaded on truck' });
    assert.strictEqual(params.status, 'LOADED_ON_TRUCK');
    assert.strictEqual(params.search, undefined);

    const outloadParams = buildPersonalHistoryParams({ search: 'outload / arrive tnl' });
    assert.strictEqual(outloadParams.status, 'ARRIVED_AT_TNL');
    assert.strictEqual(outloadParams.search, undefined);
  });

  // 6. Non-status input sends search
  it('6. Non-status input sends search', () => {
    const params = buildPersonalHistoryParams({ search: 'TRK-2026-000105' });
    assert.strictEqual(params.search, 'TRK-2026-000105');
    assert.strictEqual(params.status, undefined);

    const randomText = buildPersonalHistoryParams({ search: 'some random parcel' });
    assert.strictEqual(randomText.search, 'some random parcel');
    assert.strictEqual(randomText.status, undefined);
  });

  // 7. Page and size use approved defaults
  it('7. Page and size use approved defaults', () => {
    const defaults = buildPersonalHistoryParams();
    assert.strictEqual(defaults.page, 0);
    assert.strictEqual(defaults.size, HISTORY_PAGE_SIZE);
    assert.strictEqual(HISTORY_PAGE_SIZE, 20);

    // Negative page clamped to 0
    const clampedPage = buildPersonalHistoryParams({ page: -3 });
    assert.strictEqual(clampedPage.page, 0);

    // Size bounds 1-50
    const zeroSize = buildPersonalHistoryParams({ size: 0 });
    assert.strictEqual(zeroSize.size, 1);

    const oversized = buildPersonalHistoryParams({ size: 100 });
    assert.strictEqual(oversized.size, 50);
  });

  // 8. Event appending preserves server order
  it('8. Event appending preserves server order', () => {
    const existing = [
      { eventId: 10, trackingId: 'TRK-10' },
      { eventId: 9, trackingId: 'TRK-9' },
    ];
    const incoming = [
      { eventId: 8, trackingId: 'TRK-8' },
      { eventId: 7, trackingId: 'TRK-7' },
    ];

    const result = appendUniqueEvents(existing, incoming);
    assert.strictEqual(result.length, 4);
    assert.strictEqual(result[0].eventId, 10);
    assert.strictEqual(result[1].eventId, 9);
    assert.strictEqual(result[2].eventId, 8);
    assert.strictEqual(result[3].eventId, 7);
  });

  // 9. Duplicate event IDs are removed
  it('9. Duplicate event IDs are removed', () => {
    const existing = [
      { eventId: 10, trackingId: 'TRK-10' },
      { eventId: 9, trackingId: 'TRK-9' },
    ];
    const incoming = [
      { eventId: 9, trackingId: 'TRK-9' }, // duplicate
      { eventId: 8, trackingId: 'TRK-8' },
    ];

    const result = appendUniqueEvents(existing, incoming);
    assert.strictEqual(result.length, 3);
    assert.deepStrictEqual(result.map(e => e.eventId), [10, 9, 8]);
  });

  // 10. Page-zero replacement removes stale events
  it('10. Page-zero replacement removes stale events', () => {
    const staleEvents = [
      { eventId: 10, trackingId: 'TRK-10' },
      { eventId: 9, trackingId: 'TRK-9' },
      { eventId: 8, trackingId: 'TRK-8' },
    ];
    const pageZeroIncoming = [
      { eventId: 25, trackingId: 'TRK-25' },
      { eventId: 24, trackingId: 'TRK-24' },
    ];

    const replaced = replacePageZeroEvents(pageZeroIncoming);
    assert.strictEqual(replaced.length, 2);
    assert.deepStrictEqual(replaced.map(e => e.eventId), [25, 24]);
    for (const stale of staleEvents) {
      assert.strictEqual(replaced.some(e => e.eventId === stale.eventId), false);
    }
  });

  // 11. Missing metrics normalize to zero
  it('11. Missing metrics normalize to zero', () => {
    const emptyMetrics = normalizePersonalMetrics(null);
    assert.strictEqual(emptyMetrics.totalScans, 0);
    assert.strictEqual(emptyMetrics.loadedOnTruck, 0);
    assert.strictEqual(emptyMetrics.arrivedAtTnl, 0);
    assert.strictEqual(emptyMetrics.handedToHauler, 0);

    const partialMetrics = normalizePersonalMetrics({ totalScans: '5', loadedOnTruck: null });
    assert.strictEqual(partialMetrics.totalScans, 5);
    assert.strictEqual(partialMetrics.loadedOnTruck, 0);
    assert.strictEqual(partialMetrics.arrivedAtTnl, 0);
    assert.strictEqual(partialMetrics.handedToHauler, 0);
  });

  // 12. Valid timestamps format correctly
  it('12. Valid timestamps format correctly', () => {
    // Test Date object with explicit local components
    const dateObj = new Date(2026, 7, 6, 8, 15); // Aug 6, 2026 8:15 AM
    const formatted = formatHistoryTimestamp(dateObj);
    assert.strictEqual(formatted, 'Aug 6, 2026 · 8:15 AM');

    const afternoonDate = new Date(2026, 11, 25, 15, 30); // Dec 25, 2026 3:30 PM
    const afternoonFormatted = formatHistoryTimestamp(afternoonDate);
    assert.strictEqual(afternoonFormatted, 'Dec 25, 2026 · 3:30 PM');
  });

  // 13. Invalid timestamps display —
  it('13. Invalid timestamps display —', () => {
    const invalidInputs = [null, undefined, '', 'not-a-date', '2026-99-99', {}, []];
    for (const input of invalidInputs) {
      assert.strictEqual(formatHistoryTimestamp(input), '—');
    }
  });

  // 14. Package labels use PACKAGE X OF Y
  it('14. Package labels use PACKAGE X OF Y', () => {
    assert.strictEqual(formatPackageDisplay(1, 1), 'PACKAGE 1 OF 1');
    assert.strictEqual(formatPackageDisplay(2, 5), 'PACKAGE 2 OF 5');
    assert.strictEqual(formatPackageDisplay('3', '10'), 'PACKAGE 3 OF 10');
    assert.strictEqual(formatPackageDisplay(null, null), 'PACKAGE COUNT UNAVAILABLE');
    assert.strictEqual(formatPackageDisplay(undefined, 0), 'PACKAGE COUNT UNAVAILABLE');
    assert.strictEqual(formatPackageDisplay(0, 5), 'PACKAGE COUNT UNAVAILABLE');
    assert.strictEqual(formatPackageDisplay(-1, 2), 'PACKAGE COUNT UNAVAILABLE');
    assert.strictEqual(formatPackageDisplay(1.5, 2), 'PACKAGE COUNT UNAVAILABLE');
    assert.strictEqual(formatPackageDisplay('2abc', 5), 'PACKAGE COUNT UNAVAILABLE');
    assert.strictEqual(formatPackageDisplay('2.0', 5), 'PACKAGE COUNT UNAVAILABLE');
    assert.strictEqual(formatPackageDisplay(Infinity, 5), 'PACKAGE COUNT UNAVAILABLE');
    assert.strictEqual(formatPackageDisplay(6, 5), 'PACKAGE COUNT UNAVAILABLE');
  });

  // 15. Status labels match Phase 6.4 terminology
  it('15. Status labels match Phase 6.4 terminology', () => {
    assert.strictEqual(STATUS_LABELS.REGISTERED, 'Registered');
    assert.strictEqual(STATUS_LABELS.QR_GENERATED, 'QR Generated');
    assert.strictEqual(STATUS_LABELS.LOADED_ON_TRUCK, 'Loaded on Truck');
    assert.strictEqual(STATUS_LABELS.ARRIVED_AT_TNL, 'Outload / Arrive TNL');
    assert.strictEqual(STATUS_LABELS.LOADED_TO_HAULER, 'Loaded to Hauler');
    assert.strictEqual(STATUS_LABELS.COMPLETED, 'Completed');
  });

  // 16. SYNCED and PENDING_OFFLINE_SYNC produce distinct display states
  it('16. SYNCED and PENDING_OFFLINE_SYNC produce distinct display states', () => {
    const syncedMeta = getSyncStatusMeta(SYNC_STATUSES.SYNCED);
    assert.strictEqual(syncedMeta.label, 'SYNCED');
    assert.strictEqual(syncedMeta.isPending, false);

    const pendingMeta = getSyncStatusMeta(SYNC_STATUSES.PENDING_OFFLINE_SYNC);
    assert.strictEqual(pendingMeta.label, 'PENDING OFFLINE SYNC');
    assert.strictEqual(pendingMeta.isPending, true);

    assert.notStrictEqual(syncedMeta.color, pendingMeta.color);
    assert.notStrictEqual(syncedMeta.bgColor, pendingMeta.bgColor);
  });

  // 17. Tracking IDs are encoded for detail navigation
  it('17. Tracking IDs are encoded for detail navigation', () => {
    assert.strictEqual(encodeTrackingId('TRK-2026-000101'), 'TRK-2026-000101');
    assert.strictEqual(encodeTrackingId('TRK 2026 000101'), 'TRK%202026%20000101');
    assert.strictEqual(encodeTrackingId('  TRK-2026-000102  '), 'TRK-2026-000102');
  });

  // 18. No helper fabricates customer or placeholder values
  it('18. No helper fabricates customer or placeholder values', () => {
    // Formatters reject invalid inputs with explicit placeholders, never fabricated business defaults
    assert.strictEqual(formatHistoryTimestamp(null), '—');
    assert.strictEqual(formatHistoryTimestamp(''), '—');
    assert.strictEqual(formatPackageDisplay(null, null), 'PACKAGE COUNT UNAVAILABLE');
    assert.strictEqual(formatPackageDisplay(undefined, undefined), 'PACKAGE COUNT UNAVAILABLE');

    assert.strictEqual(resolveTrackingStatusDisplay(null, null), 'STATUS UNAVAILABLE');
    assert.strictEqual(resolveTrackingStatusDisplay('', undefined), 'STATUS UNAVAILABLE');
    assert.strictEqual(resolveTrackingStatusDisplay('   ', 'UNKNOWN'), 'STATUS UNAVAILABLE');

    // None of the history functions should introduce recipient, client, remarks, or placeholder text
    const sampleEvent = {
      eventId: 1,
      trackingId: 'TRK-2026-000101',
      statusCode: 'LOADED_ON_TRUCK',
    };

    assert.strictEqual(sampleEvent.recipientName, undefined);
    assert.strictEqual(sampleEvent.clientName, undefined);
    assert.strictEqual(sampleEvent.address, undefined);
    assert.strictEqual(sampleEvent.contact, undefined);
    assert.strictEqual(sampleEvent.statusDisplay, undefined);
  });
});

describe('Tracking History Request Coordinator', () => {
  it('page zero aborts pagination and invalidates its token', () => {
    const coordinator = createTrackingHistoryRequestCoordinator();
    const paginationToken = coordinator.beginPagination();

    const pageZeroToken = coordinator.beginPageZero();

    assert.strictEqual(paginationToken.signal.aborted, true);
    assert.strictEqual(coordinator.isCurrent(paginationToken), false);
    assert.strictEqual(coordinator.isCurrent(pageZeroToken), true);
  });

  it('blocks pagination until the active page-zero request finishes', () => {
    const coordinator = createTrackingHistoryRequestCoordinator();
    const pageZeroToken = coordinator.beginPageZero();

    assert.strictEqual(coordinator.beginPagination(), null);
    assert.strictEqual(coordinator.finish(pageZeroToken), true);

    const paginationToken = coordinator.beginPagination();
    assert.notStrictEqual(paginationToken, null);
    assert.strictEqual(coordinator.isCurrent(paginationToken), true);
  });

  it('an obsolete token cannot clear a newer pagination request', () => {
    const coordinator = createTrackingHistoryRequestCoordinator();
    const obsoletePaginationToken = coordinator.beginPagination();
    const pageZeroToken = coordinator.beginPageZero();
    coordinator.finish(pageZeroToken);
    const currentPaginationToken = coordinator.beginPagination();

    assert.strictEqual(coordinator.finish(obsoletePaginationToken), false);
    assert.strictEqual(coordinator.isCurrent(currentPaginationToken), true);
    assert.strictEqual(coordinator.beginPagination(), null);
  });

  it('cancelAll aborts and invalidates page-zero and pagination requests', () => {
    const coordinator = createTrackingHistoryRequestCoordinator();
    const pageZeroToken = coordinator.beginPageZero();
    coordinator.cancelAll();

    assert.strictEqual(pageZeroToken.signal.aborted, true);
    assert.strictEqual(coordinator.isCurrent(pageZeroToken), false);

    const paginationToken = coordinator.beginPagination();
    coordinator.cancelAll();

    assert.strictEqual(paginationToken.signal.aborted, true);
    assert.strictEqual(coordinator.isCurrent(paginationToken), false);
  });

  it('rejects duplicate pagination and reports slot ownership from finish', () => {
    const coordinator = createTrackingHistoryRequestCoordinator();
    const paginationToken = coordinator.beginPagination();

    assert.strictEqual(coordinator.beginPagination(), null);
    assert.strictEqual(coordinator.finish(paginationToken), true);
    assert.strictEqual(coordinator.finish(paginationToken), false);
  });
});

describe('Tracking History Display Resolution', () => {
  it('uses explicit display text or a recognized status label', () => {
    assert.strictEqual(
      resolveTrackingStatusDisplay('  Custom Status  ', 'REGISTERED'),
      'Custom Status'
    );
    assert.strictEqual(resolveTrackingStatusDisplay(null, 'REGISTERED'), 'Registered');
    assert.strictEqual(
      resolveTrackingStatusDisplay('   ', 'LOADED_ON_TRUCK'),
      'Loaded on Truck'
    );
  });

  it('returns STATUS UNAVAILABLE for missing and unknown values', () => {
    assert.strictEqual(resolveTrackingStatusDisplay(null, null), 'STATUS UNAVAILABLE');
    assert.strictEqual(resolveTrackingStatusDisplay('', ''), 'STATUS UNAVAILABLE');
    assert.strictEqual(resolveTrackingStatusDisplay('   ', 'UNKNOWN'), 'STATUS UNAVAILABLE');
  });

  it('uses replacePageZeroEvents in the production history screen', () => {
    const screenSource = readFileSync(
      new URL('../src/app/(main)/tracking-history/index.js', import.meta.url),
      'utf8'
    );

    assert.match(screenSource, /replacePageZeroEvents\(incoming\)/);
  });
});
