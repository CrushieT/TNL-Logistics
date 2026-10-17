import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  CACHE_SLOTS,
  getCacheEntry,
  setCacheEntry,
  clearAllCache,
  getCacheStats,
  isResponseAcceptable,
} from '../src/services/api/responseCache.mjs';
import {
  SessionCoordinator,
  decodeJwtPayload,
} from '../src/services/api/sessionCore.mjs';

function createMockJwt({ sub = 'admin1', uid = 101, role = 'ADMIN', exp = 9999999, authTime = 1000, ver = 1 } = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub,
      uid,
      role,
      ver,
      auth_time: authTime,
      exp,
    })
  ).toString('base64url');
  return `${header}.${payload}.sig`;
}

function createMockStorage() {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) || null,
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

describe('Response Cache - Session Core Unit Checks', () => {
  let session;

  beforeEach(() => {
    clearAllCache();
    session = new SessionCoordinator(createMockStorage());
    // Register cache clearing hook with session coordinator
    session.onSessionInvalidated(clearAllCache);
  });

  it('reports correct identity and session generation', () => {
    session.setCurrentUser({ userId: 99, username: 'admin1', role: 'ADMIN' });
    assert.equal(session.getCurrentUser().userId, 99);
    assert.equal(session.getSessionGeneration(), 0);
  });

  it('clears all cached entries when session invalidation occurs', () => {
    session.setCurrentUser({ userId: 101, username: 'admin1', role: 'ADMIN' });
    const initialGen = session.getSessionGeneration();

    setCacheEntry(CACHE_SLOTS.DASHBOARD, {
      userId: 101,
      sessionGeneration: initialGen,
      queryParams: { cycle: '2026-10-15' },
      data: { shipmentCount: 42 },
    });
    setCacheEntry(CACHE_SLOTS.COLLECTION_CYCLES, {
      userId: 101,
      sessionGeneration: initialGen,
      queryParams: {},
      data: [{ isoDate: '2026-10-15' }],
    });

    assert.equal(getCacheStats().entryCount, 2);

    // Trigger session invalidation (e.g. 401 or explicit logout)
    session.invalidateSession();

    // Cache must be wiped
    assert.equal(getCacheStats().entryCount, 0);

    // Generation must have incremented
    assert.equal(session.getSessionGeneration(), initialGen + 1);
  });

  it('preserves cached entries across sliding token renewal for the same verified session', () => {
    session.setCurrentUser({ userId: 101, username: 'admin1', role: 'ADMIN' });
    const gen = session.getSessionGeneration();

    const nowSec = Math.floor(Date.now() / 1000);
    const activeToken = createMockJwt({ exp: nowSec + 1200, authTime: nowSec });
    session.setToken(activeToken);

    setCacheEntry(CACHE_SLOTS.DASHBOARD, {
      userId: 101,
      sessionGeneration: gen,
      queryParams: { cycle: '2026-10-15' },
      data: { shipmentCount: 42 },
    });

    assert.equal(getCacheStats().entryCount, 1);

    // Monotonic sliding token renewal: extended expiry, matching identity & auth_time
    const renewedToken = createMockJwt({ exp: nowSec + 1800, authTime: nowSec });
    const renewed = session.handleSlidingTokenRenewal(renewedToken, activeToken, gen);
    assert.equal(renewed, true);

    // Cache must remain untouched
    assert.equal(getCacheStats().entryCount, 1);
    const hit = getCacheEntry(CACHE_SLOTS.DASHBOARD, {
      userId: 101,
      sessionGeneration: gen,
      queryParams: { cycle: '2026-10-15' },
    });
    assert.ok(hit);
    assert.equal(hit.data.shipmentCount, 42);
  });

  it('prevents deferred / late responses from overwriting memory after session invalidation using production acceptance logic', () => {
    session.setCurrentUser({ userId: 101, username: 'admin1', role: 'ADMIN' });
    const initialGen = session.getSessionGeneration();

    // Request captures auth context and query at start
    const requestAuth = {
      isAuthenticated: true, isVerified: true,
      userId: 101,
      sessionGeneration: initialGen,
    };
    const requestQuery = { cycle: '2026-10-15' };

    // Session invalidation occurs while request is in flight
    session.invalidateSession();

    // Late response arrives from the server; evaluate using production acceptance logic
    const currentUser = session.getCurrentUser();
    const currentAuth = {
      isAuthenticated: Boolean(currentUser),
      userId: currentUser?.userId || null,
      sessionGeneration: session.getSessionGeneration(),
    };
    const activeQuery = { cycle: '2026-10-15' };

    const acceptable = isResponseAcceptable({
      requestAuth,
      requestQuery,
      currentAuth,
      activeQuery,
    });
    assert.equal(acceptable, false);

    if (acceptable) {
      setCacheEntry(CACHE_SLOTS.DASHBOARD, {
        userId: requestAuth.userId,
        sessionGeneration: requestAuth.sessionGeneration,
        queryParams: requestQuery,
        data: { shipmentCount: 999 },
      });
    }

    // Cache remains empty
    assert.equal(getCacheStats().entryCount, 0);
  });

  it('isolates cache between different user accounts', () => {
    const gen = session.getSessionGeneration();

    // User A caches dashboard data
    setCacheEntry(CACHE_SLOTS.DASHBOARD, {
      userId: 101,
      sessionGeneration: gen,
      queryParams: { cycle: '2026-10-15' },
      data: { shipmentCount: 10 },
    });

    // User B tries to read it
    const userBRead = getCacheEntry(CACHE_SLOTS.DASHBOARD, {
      userId: 202,
      sessionGeneration: gen,
      queryParams: { cycle: '2026-10-15' },
    });
    assert.equal(userBRead, null);
  });
});
