import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeJwtPayload,
  isEligibleAdminToken,
  isTokenExpired,
  shouldAdvanceTokenMonotonically,
  shouldSuppressStale401,
  evaluateSessionValidationOutcome,
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

test('isEligibleAdminToken requires an unexpired administrator role claim', () => {
  const now = Math.floor(Date.now() / 1000);
  const nowMs = now * 1000;
  const adminToken = createMockJwt({ role: 'ADMIN', exp: now + 1800 });
  const officeToken = createMockJwt({ role: 'OFFICE_STAFF', exp: now + 1800 });
  const expiredAdminToken = createMockJwt({ role: 'ADMIN', exp: now + 10 });

  assert.equal(isEligibleAdminToken(adminToken, nowMs), true);
  assert.equal(isEligibleAdminToken(officeToken, nowMs), false);
  assert.equal(isEligibleAdminToken(expiredAdminToken, nowMs), false);
  assert.equal(isEligibleAdminToken('malformed-token', nowMs), false);
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

test('SessionCoordinator evicts a stored staff token and user record', () => {
  const storage = createMockStorage();
  const coordinator = new SessionCoordinator(storage);
  const now = Math.floor(Date.now() / 1000);
  const officeToken = createMockJwt({ role: 'OFFICE_STAFF', exp: now + 1800 });

  storage.setItem('tnl_admin_token', officeToken);
  storage.setItem('tnl_user_info', JSON.stringify({ role: 'OFFICE_STAFF' }));

  assert.equal(coordinator.getToken(), null);
  assert.equal(coordinator.getCurrentUser(), null);
  assert.equal(storage.getItem('tnl_admin_token'), null);
  assert.equal(storage.getItem('tnl_user_info'), null);
});

test('evaluateSessionValidationOutcome handles generation mismatches, token renewals, and current token 401s', () => {
  const now = Math.floor(Date.now() / 1000);
  const tokenA = createMockJwt({ sub: 'USR-1', exp: now + 1800 });
  const tokenB = createMockJwt({ sub: 'USR-2', exp: now + 1800 });
  const expiredToken = createMockJwt({ sub: 'USR-1', exp: now - 10 });

  // 1. Older-generation success after new login -> IGNORE
  assert.equal(
    evaluateSessionValidationOutcome({
      requestGeneration: 1,
      currentGeneration: 2,
      requestToken: tokenA,
      activeToken: tokenB,
      isSuccess: true,
      is401: false,
    }),
    'IGNORE'
  );

  // 2. Older-generation failure (401) after new login -> IGNORE
  assert.equal(
    evaluateSessionValidationOutcome({
      requestGeneration: 1,
      currentGeneration: 2,
      requestToken: tokenA,
      activeToken: tokenB,
      isSuccess: false,
      is401: true,
    }),
    'IGNORE'
  );

  // 3. Same-generation failure (401) after sliding renewal -> RETRY
  assert.equal(
    evaluateSessionValidationOutcome({
      requestGeneration: 1,
      currentGeneration: 1,
      requestToken: tokenA,
      activeToken: tokenB,
      isSuccess: false,
      is401: true,
      isRetry: false,
    }),
    'RETRY'
  );

  // 4. Same-generation failure after sliding renewal when already retrying -> IGNORE
  assert.equal(
    evaluateSessionValidationOutcome({
      requestGeneration: 1,
      currentGeneration: 1,
      requestToken: tokenA,
      activeToken: tokenB,
      isSuccess: false,
      is401: true,
      isRetry: true,
    }),
    'IGNORE'
  );

  // 5. Genuine current-token 401 -> INVALIDATE
  assert.equal(
    evaluateSessionValidationOutcome({
      requestGeneration: 1,
      currentGeneration: 1,
      requestToken: tokenA,
      activeToken: tokenA,
      isSuccess: false,
      is401: true,
      isRetry: false,
    }),
    'INVALIDATE'
  );

  // 6. Current valid token success -> APPLY
  assert.equal(
    evaluateSessionValidationOutcome({
      requestGeneration: 1,
      currentGeneration: 1,
      requestToken: tokenA,
      activeToken: tokenA,
      isSuccess: true,
      is401: false,
    }),
    'APPLY'
  );

  // 7. Success with expired active token -> INVALIDATE
  assert.equal(
    evaluateSessionValidationOutcome({
      requestGeneration: 1,
      currentGeneration: 1,
      requestToken: expiredToken,
      activeToken: expiredToken,
      isSuccess: true,
      is401: false,
    }),
    'INVALIDATE'
  );

  // 8. Network failure (non-401) for current token -> IGNORE
  assert.equal(
    evaluateSessionValidationOutcome({
      requestGeneration: 1,
      currentGeneration: 1,
      requestToken: tokenA,
      activeToken: tokenA,
      isSuccess: false,
      is401: false,
    }),
    'IGNORE'
  );
});

test('evaluateSessionValidationOutcome invalidates a non-admin auth-me result', () => {
  const now = Math.floor(Date.now() / 1000);
  const token = createMockJwt({ sub: 'USR-ADMIN', role: 'ADMIN', exp: now + 1800 });

  assert.equal(
    evaluateSessionValidationOutcome({
      requestGeneration: 1,
      currentGeneration: 1,
      requestToken: token,
      activeToken: token,
      isSuccess: true,
      isAuthorized: false,
      is401: false,
    }),
    'INVALIDATE'
  );
});

test('web race simulation: login flow preserves new user state against late older-generation responses', () => {
  const storage = createMockStorage();
  const coordinator = new SessionCoordinator(storage);
  const now = Math.floor(Date.now() / 1000);

  const user1Token = createMockJwt({ sub: 'USR-1', role: 'ADMIN', exp: now + 1800 });
  const user2Token = createMockJwt({ sub: 'USR-2', role: 'ADMIN', exp: now + 1800 });

  // User 1 logs in (generation 0)
  coordinator.setToken(user1Token);
  coordinator.setCurrentUser({ userId: 'USR-1', username: 'user1' });

  // In-flight validateSession started for User 1
  const inFlightGen = coordinator.getSessionGeneration();
  const inFlightToken = coordinator.getToken();

  // User 2 logs in before in-flight /auth/me returns (generation increments to 1)
  coordinator.incrementSessionGeneration();
  coordinator.setToken(user2Token);
  coordinator.setCurrentUser({ userId: 'USR-2', username: 'user2' });

  // 1. User 1's late success arrives
  const successOutcome = coordinator.evaluateValidationOutcome(
    inFlightGen,
    inFlightToken,
    true, // isSuccess
    false // is401
  );
  assert.equal(successOutcome, 'IGNORE', 'Late success from User 1 must be ignored');
  if (successOutcome === 'APPLY') {
    coordinator.setCurrentUser({ userId: 'USR-1', username: 'user1' });
  }
  assert.equal(coordinator.getCurrentUser().userId, 'USR-2', 'User 2 currentUser must not be overwritten');

  // 2. User 1's late failure (401) arrives
  const failureOutcome = coordinator.evaluateValidationOutcome(
    inFlightGen,
    inFlightToken,
    false, // isSuccess
    true   // is401
  );
  assert.equal(failureOutcome, 'IGNORE', 'Late 401 from User 1 must be ignored');
  if (failureOutcome === 'INVALIDATE') {
    coordinator.invalidateSession();
  }
  assert.equal(coordinator.getToken(), user2Token, 'User 2 token must remain active and valid');
  assert.equal(coordinator.getSessionGeneration(), 1, 'Generation must not have been invalidated');
});

test('web race simulation: password-change flow prevents stale 401 from tearing down rotated session', () => {
  const storage = createMockStorage();
  const coordinator = new SessionCoordinator(storage);
  const now = Math.floor(Date.now() / 1000);

  const preRotationToken = createMockJwt({ sub: 'USR-ADMIN', role: 'ADMIN', exp: now + 1800, ver: 1 });
  const postRotationToken = createMockJwt({ sub: 'USR-ADMIN', role: 'ADMIN', exp: now + 1800, ver: 2 });

  coordinator.setToken(preRotationToken);
  coordinator.setCurrentUser({ userId: 'USR-ADMIN', username: 'admin', mustChangePassword: true });

  // Routine validateSession initiated with pre-rotation token
  const reqGen = coordinator.getSessionGeneration();
  const reqToken = coordinator.getToken();

  // Password change completes: increments generation and updates token
  coordinator.incrementSessionGeneration();
  coordinator.setToken(postRotationToken);
  coordinator.setCurrentUser({ userId: 'USR-ADMIN', username: 'admin', mustChangePassword: false });

  // Backend returned 401 for the pre-rotation token because its token version (1) was revoked
  const outcome = coordinator.evaluateValidationOutcome(reqGen, reqToken, false, true);
  assert.equal(outcome, 'IGNORE', 'Stale 401 from pre-rotation token must not invalidate post-rotation session');

  if (outcome === 'INVALIDATE') {
    coordinator.invalidateSession();
  }

  assert.equal(coordinator.getToken(), postRotationToken);
  assert.equal(coordinator.getCurrentUser().mustChangePassword, false);
});

test('web race simulation: sliding token renewal triggers single retry and succeeds without invalidation', () => {
  const storage = createMockStorage();
  const coordinator = new SessionCoordinator(storage);
  const now = Math.floor(Date.now() / 1000);

  const initialToken = createMockJwt({ sub: 'USR-ADMIN', uid: 'USR-ADMIN', role: 'ADMIN', ver: 1, exp: now + 1800, auth_time: now });
  const renewedToken = createMockJwt({ sub: 'USR-ADMIN', uid: 'USR-ADMIN', role: 'ADMIN', ver: 1, exp: now + 1900, auth_time: now });

  coordinator.setToken(initialToken);
  const reqGen = coordinator.getSessionGeneration();
  const reqToken = coordinator.getToken();

  // Sliding token renewal occurs mid-flight in the same session generation
  coordinator.handleSlidingTokenRenewal(renewedToken, initialToken, reqGen);
  assert.equal(coordinator.getToken(), renewedToken);

  // Initial request returns 401 (initial token expired at boundary)
  const initialOutcome = coordinator.evaluateValidationOutcome(reqGen, reqToken, false, true, false);
  assert.equal(initialOutcome, 'RETRY', 'Superseded token failure must prompt retry using current token');

  // Retry with active renewed token
  const retryOutcome = coordinator.evaluateValidationOutcome(
    coordinator.getSessionGeneration(),
    coordinator.getToken(),
    true,
    false,
    true
  );
  assert.equal(retryOutcome, 'APPLY', 'Retry using active renewed token must apply user state');
});

test('web race simulation: genuine 401 for current token immediately invalidates session', () => {
  const storage = createMockStorage();
  const coordinator = new SessionCoordinator(storage);
  const now = Math.floor(Date.now() / 1000);

  const activeToken = createMockJwt({ sub: 'USR-ADMIN', role: 'ADMIN', exp: now + 1800 });
  coordinator.setToken(activeToken);

  let invalidated = false;
  coordinator.onSessionInvalidated(() => {
    invalidated = true;
  });

  const outcome = coordinator.evaluateValidationOutcome(
    coordinator.getSessionGeneration(),
    coordinator.getToken(),
    false,
    true
  );

  assert.equal(outcome, 'INVALIDATE');
  if (outcome === 'INVALIDATE') {
    coordinator.invalidateSession();
  }

  assert.equal(invalidated, true);
  assert.equal(coordinator.getToken(), null);
  assert.equal(coordinator.getCurrentUser(), null);
});
