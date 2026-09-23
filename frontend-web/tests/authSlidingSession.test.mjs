import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeJwtPayload,
  isTokenExpired,
  shouldAdvanceTokenMonotonically,
  shouldSuppressStale401,
  SessionCoordinator,
} from '../src/services/api/sessionCore.mjs';

function createMockJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'mock-signature';
  return `${header}.${body}.${signature}`;
}

function createMockStorage() {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) || null,
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test('decodeJwtPayload extracts standard claims and custom auth_time', () => {
  const now = Math.floor(Date.now() / 1000);
  const token = createMockJwt({
    sub: 'USR-ADMIN',
    uid: 'USR-ADMIN',
    role: 'ADMIN',
    ver: 1,
    iat: now,
    exp: now + 1800,
    auth_time: now,
  });

  const payload = decodeJwtPayload(token);
  assert.equal(payload.sub, 'USR-ADMIN');
  assert.equal(payload.uid, 'USR-ADMIN');
  assert.equal(payload.role, 'ADMIN');
  assert.equal(payload.ver, 1);
  assert.equal(payload.iat, now);
  assert.equal(payload.exp, now + 1800);
  assert.equal(payload.auth_time, now);
});

test('isTokenExpired respects 30-second skew leeway for 30-minute tokens', () => {
  const now = Math.floor(Date.now() / 1000);
  const nowMs = now * 1000;

  // Fresh 30-minute token
  const freshToken = createMockJwt({ exp: now + 1800 });
  assert.equal(isTokenExpired(freshToken, nowMs), false);

  // Token expiring in 25 seconds (less than 30s threshold)
  const expiringSoon = createMockJwt({ exp: now + 25 });
  assert.equal(isTokenExpired(expiringSoon, nowMs), true);

  // Token already expired 10 seconds ago
  const expired = createMockJwt({ exp: now - 10 });
  assert.equal(isTokenExpired(expired, nowMs), true);
});

test('shouldAdvanceTokenMonotonically enforces monotonic expiration advance', () => {
  const now = Math.floor(Date.now() / 1000);

  const activeToken = createMockJwt({
    sub: 'USR-ADMIN',
    uid: 'USR-ADMIN',
    role: 'ADMIN',
    ver: 1,
    iat: now,
    exp: now + 1800,
    auth_time: now,
  });

  // Out-of-order response carrying older expiration
  const olderRenewed = createMockJwt({
    sub: 'USR-ADMIN',
    uid: 'USR-ADMIN',
    role: 'ADMIN',
    ver: 1,
    iat: now - 10,
    exp: now + 1750,
    auth_time: now,
  });
  assert.equal(
    shouldAdvanceTokenMonotonically(olderRenewed, activeToken, activeToken),
    false,
    'Older renewed token must not overwrite newer active token'
  );

  // Response with identical expiration (same epoch second)
  assert.equal(
    shouldAdvanceTokenMonotonically(activeToken, activeToken, activeToken),
    false,
    'Same-second token renewal must not thrash storage'
  );

  // Newer response carrying advanced expiration
  const newerRenewed = createMockJwt({
    sub: 'USR-ADMIN',
    uid: 'USR-ADMIN',
    role: 'ADMIN',
    ver: 1,
    iat: now + 60,
    exp: now + 1860,
    auth_time: now,
  });
  assert.equal(
    shouldAdvanceTokenMonotonically(newerRenewed, activeToken, activeToken),
    true,
    'Newer renewed token must advance active token'
  );
});

test('shouldAdvanceTokenMonotonically rejects mismatched identity or role', () => {
  const now = Math.floor(Date.now() / 1000);

  const activeToken = createMockJwt({
    sub: 'USR-ADMIN',
    uid: 'USR-ADMIN',
    role: 'ADMIN',
    ver: 1,
    iat: now,
    exp: now + 1800,
    auth_time: now,
  });

  // Mismatched role
  const rogueRole = createMockJwt({
    sub: 'USR-ADMIN',
    uid: 'USR-ADMIN',
    role: 'OFFICE_STAFF',
    ver: 1,
    iat: now + 60,
    exp: now + 1860,
    auth_time: now,
  });
  assert.equal(shouldAdvanceTokenMonotonically(rogueRole, activeToken, activeToken), false);

  // Mismatched user id
  const rogueUser = createMockJwt({
    sub: 'USR-OTHER',
    uid: 'USR-OTHER',
    role: 'ADMIN',
    ver: 1,
    iat: now + 60,
    exp: now + 1860,
    auth_time: now,
  });
  assert.equal(shouldAdvanceTokenMonotonically(rogueUser, activeToken, activeToken), false);

  // Mismatched auth_time
  const rogueAuthTime = createMockJwt({
    sub: 'USR-ADMIN',
    uid: 'USR-ADMIN',
    role: 'ADMIN',
    ver: 1,
    iat: now + 60,
    exp: now + 1860,
    auth_time: now - 3600,
  });
  assert.equal(shouldAdvanceTokenMonotonically(rogueAuthTime, activeToken, activeToken), false);
});

test('shouldSuppressStale401 correctly identifies superseding sessions', () => {
  const now = Math.floor(Date.now() / 1000);
  const activeValidToken = createMockJwt({
    sub: 'USR-ADMIN',
    exp: now + 1800,
  });
  const staleRequestToken = createMockJwt({
    sub: 'USR-ADMIN',
    exp: now - 10,
  });

  // 1. Generation mismatch: request belongs to previous generation -> suppress
  assert.equal(shouldSuppressStale401(1, 2, staleRequestToken, activeValidToken), true);

  // 2. Same generation, but request token was superseded by newer valid token -> suppress
  assert.equal(shouldSuppressStale401(1, 1, staleRequestToken, activeValidToken), true);

  // 3. Same generation, request token is the active token -> do NOT suppress (legitimate 401)
  assert.equal(shouldSuppressStale401(1, 1, activeValidToken, activeValidToken), false);

  // 4. Same generation, but active token is also expired -> do NOT suppress
  const expiredActiveToken = createMockJwt({
    sub: 'USR-ADMIN',
    exp: now - 5,
  });
  assert.equal(shouldSuppressStale401(1, 1, staleRequestToken, expiredActiveToken), false);
});

test('SessionCoordinator manages dual memory/localStorage and notifies invalidation', () => {
  const storage = createMockStorage();
  const coordinator = new SessionCoordinator(storage);

  let invalidationFired = false;
  const unsubscribe = coordinator.onSessionInvalidated(() => {
    invalidationFired = true;
  });

  const now = Math.floor(Date.now() / 1000);
  const token = createMockJwt({
    sub: 'USR-ADMIN',
    uid: 'USR-ADMIN',
    role: 'ADMIN',
    ver: 1,
    iat: now,
    exp: now + 1800,
    auth_time: now,
  });

  coordinator.setToken(token);
  assert.equal(coordinator.getToken(), token);
  assert.equal(storage.getItem('tnl_admin_token'), token);

  // Invalidate
  coordinator.invalidateSession();
  assert.equal(invalidationFired, true);
  assert.equal(coordinator.getToken(), null);
  assert.equal(storage.getItem('tnl_admin_token'), null);
  assert.equal(coordinator.getSessionGeneration(), 1);

  unsubscribe();
});
