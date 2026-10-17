import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  CACHE_SLOTS,
  MAX_ENTRY_BYTES,
  MAX_TOTAL_BYTES,
  CACHE_TTL_MS,
  canonicalizeQueryParams,
  calculatePayloadBytes,
  getCacheEntry,
  setCacheEntry,
  clearAllCache,
  clearCacheSlot,
  getCacheStats,
  getTotalCacheBytes,
} from '../src/services/api/responseCache.mjs';

describe('Response Cache - Pure In-Memory Module', () => {
  beforeEach(() => {
    clearAllCache();
  });

  it('exposes exactly the 6 required resource slots', () => {
    const slotKeys = Object.keys(CACHE_SLOTS);
    assert.equal(slotKeys.length, 6);
    assert.deepEqual(Object.values(CACHE_SLOTS).sort(), [
      'collection_cycles',
      'dashboard_summary',
      'reports_summary',
      'tracking_logs_metrics',
      'tracking_logs_page',
      'weekly_collections',
    ]);
  });

  it('canonicalizes query parameters safely avoiding delimiter collisions', () => {
    // Parameter ordering does not affect canonical key
    const q1 = { page: 0, size: 25, search: 'TNL-100' };
    const q2 = { search: 'TNL-100', size: 25, page: 0 };
    assert.equal(canonicalizeQueryParams(q1), canonicalizeQueryParams(q2));

    // Special characters like & and = are preserved without colliding
    const special1 = { query: 'alpha&beta=1' };
    const special2 = { alpha: '', 'beta=1': '' }; // different structure
    assert.notEqual(canonicalizeQueryParams(special1), canonicalizeQueryParams(special2));

    // Empty and null values are omitted
    const withEmpty = { page: 1, search: '', filter: null, active: undefined };
    assert.equal(canonicalizeQueryParams(withEmpty), JSON.stringify([['page', '1']]));

    // Non-object input returns empty array representation
    assert.equal(canonicalizeQueryParams(null), '[]');
    assert.equal(canonicalizeQueryParams(undefined), '[]');
  });

  it('stores and retrieves a successful cache entry for exact matching criteria', () => {
    const slot = CACHE_SLOTS.DASHBOARD;
    const auth = { userId: 42, sessionGeneration: 1 };
    const query = { cycle: '2026-10-15' };
    const payload = { shipmentCount: 150, forCollection: { amount: 25000 } };
    const now = 1000000;

    const stored = setCacheEntry(slot, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: query,
      data: payload,
      now,
    });
    assert.equal(stored, true);

    const hit = getCacheEntry(slot, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: query,
      now: now + 60000, // 1 minute later
    });

    assert.ok(hit);
    assert.deepEqual(hit.data, payload);
    assert.equal(hit.timestamp, now);
  });

  it('preserves genuine empty responses in cache', () => {
    const slot = CACHE_SLOTS.WEEKLY_COLLECTIONS;
    const auth = { userId: 42, sessionGeneration: 1 };
    const query = { cycle: '2026-10-22' };
    const emptyPayload = { items: [], summary: { totalDue: 0 } };

    setCacheEntry(slot, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: query,
      data: emptyPayload,
    });

    const hit = getCacheEntry(slot, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: query,
    });

    assert.ok(hit);
    assert.deepEqual(hit.data, emptyPayload);
    assert.equal(hit.data.items.length, 0);
  });

  it('returns null when entry exceeds 5-minute TTL', () => {
    const slot = CACHE_SLOTS.REPORTS;
    const auth = { userId: 10, sessionGeneration: 3 };
    const query = { startDate: '2026-10-01', endDate: '2026-10-15' };
    const payload = { totalRevenue: 98000 };
    const initialTime = 1000000;

    setCacheEntry(slot, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: query,
      data: payload,
      now: initialTime,
    });

    // 4 minutes 59 seconds: valid
    const validHit = getCacheEntry(slot, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: query,
      now: initialTime + (CACHE_TTL_MS - 1000),
    });
    assert.ok(validHit);

    // Exactly 5 minutes + 1 ms: expired
    const expiredHit = getCacheEntry(slot, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: query,
      now: initialTime + CACHE_TTL_MS + 1,
    });
    assert.equal(expiredHit, null);

    // Slot is now cleaned up
    assert.equal(getCacheStats().entryCount, 0);
  });

  it('rejects cache reads on session generation mismatch', () => {
    const slot = CACHE_SLOTS.DASHBOARD;
    const query = { cycle: '2026-10-15' };
    const payload = { shipmentCount: 50 };

    setCacheEntry(slot, {
      userId: 5,
      sessionGeneration: 1,
      queryParams: query,
      data: payload,
    });

    // Same user, newer session generation (e.g. after password change or re-auth)
    const result = getCacheEntry(slot, {
      userId: 5,
      sessionGeneration: 2,
      queryParams: query,
    });
    assert.equal(result, null);
  });

  it('rejects cache reads on user ID mismatch', () => {
    const slot = CACHE_SLOTS.DASHBOARD;
    const query = { cycle: '2026-10-15' };
    const payload = { shipmentCount: 50 };

    setCacheEntry(slot, {
      userId: 5,
      sessionGeneration: 1,
      queryParams: query,
      data: payload,
    });

    // Different user ID
    const result = getCacheEntry(slot, {
      userId: 6,
      sessionGeneration: 1,
      queryParams: query,
    });
    assert.equal(result, null);
  });

  it('rejects cache reads on query parameter mismatch', () => {
    const slot = CACHE_SLOTS.TRACKING_LOGS_PAGE;
    const payload = { content: [{ eventId: 101 }] };

    setCacheEntry(slot, {
      userId: 1,
      sessionGeneration: 1,
      queryParams: { page: 0, size: 25, search: 'ABC' },
      data: payload,
    });

    // Different search term
    const result = getCacheEntry(slot, {
      userId: 1,
      sessionGeneration: 1,
      queryParams: { page: 0, size: 25, search: 'XYZ' },
    });
    assert.equal(result, null);

    // Different page
    const pageResult = getCacheEntry(slot, {
      userId: 1,
      sessionGeneration: 1,
      queryParams: { page: 1, size: 25, search: 'ABC' },
    });
    assert.equal(pageResult, null);
  });

  it('replaces existing entry in slot when a new query is stored (max 1 per slot)', () => {
    const slot = CACHE_SLOTS.DASHBOARD;
    const auth = { userId: 1, sessionGeneration: 1 };

    setCacheEntry(slot, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: { cycle: '2026-10-08' },
      data: { shipmentCount: 10 },
      now: 1000,
    });
    assert.equal(getCacheStats().entryCount, 1);

    // Set new cycle in same slot
    setCacheEntry(slot, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: { cycle: '2026-10-15' },
      data: { shipmentCount: 20 },
      now: 2000,
    });
    assert.equal(getCacheStats().entryCount, 1);

    // Old cycle should be gone
    const oldHit = getCacheEntry(slot, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: { cycle: '2026-10-08' },
      now: 2000,
    });
    assert.equal(oldHit, null);

    // New cycle is present
    const newHit = getCacheEntry(slot, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: { cycle: '2026-10-15' },
      now: 2000,
    });
    assert.ok(newHit);
    assert.equal(newHit.data.shipmentCount, 20);
  });

  it('skips caching payloads exceeding the 1 MiB limit without throwing', () => {
    const slot = CACHE_SLOTS.REPORTS;
    const auth = { userId: 1, sessionGeneration: 1 };

    // Generate large payload (> 1 MiB)
    const largeString = 'X'.repeat(MAX_ENTRY_BYTES + 50);
    const oversizedPayload = { data: largeString };

    const stored = setCacheEntry(slot, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: { test: 1 },
      data: oversizedPayload,
    });

    assert.equal(stored, false);
    assert.equal(getCacheStats().entryCount, 0);
  });

  it('evicts oldest entries when total cache size exceeds 4 MiB', () => {
    const auth = { userId: 1, sessionGeneration: 1 };

    // Create a ~850 KiB payload
    const chunk = 'A'.repeat(850 * 1024);

    // Store in slot 1 at t=1000 (~850 KiB)
    setCacheEntry(CACHE_SLOTS.DASHBOARD, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: { q: 1 },
      data: { chunk },
      now: 1000,
    });

    // Store in slot 2 at t=2000 (~1.7 MiB total)
    setCacheEntry(CACHE_SLOTS.REPORTS, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: { q: 2 },
      data: { chunk },
      now: 2000,
    });

    // Store in slot 3 at t=3000 (~2.55 MiB total)
    setCacheEntry(CACHE_SLOTS.WEEKLY_COLLECTIONS, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: { q: 3 },
      data: { chunk },
      now: 3000,
    });

    // Store in slot 4 at t=4000 (~3.4 MiB total)
    setCacheEntry(CACHE_SLOTS.TRACKING_LOGS_PAGE, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: { q: 4 },
      data: { chunk },
      now: 4000,
    });

    assert.equal(getCacheStats().entryCount, 4);
    assert.ok(getTotalCacheBytes() <= MAX_TOTAL_BYTES);

    // Storing 5th entry at t=5000 would bring total to ~4.25 MiB > 4 MiB
    // Oldest entry (DASHBOARD at t=1000) must be evicted!
    setCacheEntry(CACHE_SLOTS.TRACKING_LOGS_METRICS, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: { q: 5 },
      data: { chunk },
      now: 5000,
    });

    assert.ok(getTotalCacheBytes() <= MAX_TOTAL_BYTES);

    // DASHBOARD was oldest (t=1000), must be evicted
    const evicted = getCacheEntry(CACHE_SLOTS.DASHBOARD, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: { q: 1 },
      now: 5000,
    });
    assert.equal(evicted, null);

    // Newer entries remain
    const retained = getCacheEntry(CACHE_SLOTS.TRACKING_LOGS_METRICS, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: { q: 5 },
      now: 5000,
    });
    assert.ok(retained);
  });

  it('clears all slots upon clearAllCache()', () => {
    const auth = { userId: 1, sessionGeneration: 1 };

    setCacheEntry(CACHE_SLOTS.DASHBOARD, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: { cycle: '2026-10-15' },
      data: { shipmentCount: 10 },
    });
    setCacheEntry(CACHE_SLOTS.COLLECTION_CYCLES, {
      userId: auth.userId,
      sessionGeneration: auth.sessionGeneration,
      queryParams: {},
      data: [{ isoDate: '2026-10-15' }],
    });

    assert.equal(getCacheStats().entryCount, 2);
    clearAllCache();
    assert.equal(getCacheStats().entryCount, 0);
    assert.equal(getTotalCacheBytes(), 0);
  });

  it('rejects unknown slots and missing auth parameters', () => {
    assert.equal(setCacheEntry('unsupported_slot', { userId: 1, sessionGeneration: 1, data: {} }), false);
    assert.equal(setCacheEntry(CACHE_SLOTS.DASHBOARD, { userId: null, sessionGeneration: 1, data: {} }), false);
    assert.equal(setCacheEntry(CACHE_SLOTS.DASHBOARD, { userId: 1, sessionGeneration: undefined, data: {} }), false);
  });
});
