/**
 * Pure session core logic for web administration.
 * Provides JWT decoding, expiration checking, generation-based concurrency tracking,
 * monotonic renewal updates, and stale-401 race-condition suppression with zero framework dependencies.
 */

export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    return null;
  }
}

export function isTokenExpired(token, currentTimeMs = Date.now()) {
  const parsed = decodeJwtPayload(token);
  if (!parsed || !parsed.exp) return true;
  return currentTimeMs >= (parsed.exp * 1000 - 30000);
}

export function isEligibleAdminToken(token, currentTimeMs = Date.now()) {
  const parsed = decodeJwtPayload(token);
  return Boolean(parsed && parsed.role === 'ADMIN' && !isTokenExpired(token, currentTimeMs));
}

export function shouldAdvanceTokenMonotonically(renewedToken, activeToken, requestToken) {
  if (!renewedToken || !activeToken) return false;
  const activePayload = decodeJwtPayload(activeToken);
  const renewedPayload = decodeJwtPayload(renewedToken);
  const requestPayload = requestToken ? decodeJwtPayload(requestToken) : null;

  if (!activePayload || !renewedPayload || !renewedPayload.exp) {
    return false;
  }

  // Identity and auth_time must match active session
  if (
    renewedPayload.sub !== activePayload.sub ||
    renewedPayload.uid !== activePayload.uid ||
    renewedPayload.role !== activePayload.role ||
    renewedPayload.ver !== activePayload.ver ||
    (requestPayload && renewedPayload.auth_time !== requestPayload.auth_time)
  ) {
    return false;
  }

  return renewedPayload.exp > activePayload.exp;
}

export function shouldSuppressStale401(requestGeneration, currentGeneration, requestToken, activeToken) {
  if (requestGeneration !== undefined && requestGeneration !== currentGeneration) {
    return true;
  }
  if (requestToken && activeToken && requestToken !== activeToken && !isTokenExpired(activeToken)) {
    return true;
  }
  return false;
}

export function evaluateSessionValidationOutcome(
  optionsOrReqGen,
  currentGeneration,
  requestToken,
  activeToken,
  isSuccess,
  is401 = false,
  isRetry = false
) {
  let opts;
  if (typeof optionsOrReqGen === 'object' && optionsOrReqGen !== null) {
    opts = optionsOrReqGen;
  } else {
    opts = {
      requestGeneration: optionsOrReqGen,
      currentGeneration,
      requestToken,
      activeToken,
      isSuccess,
      is401,
      isRetry,
    };
  }

  const {
    requestGeneration,
    currentGeneration: curGen,
    requestToken: reqTok,
    activeToken: actTok,
    isSuccess: success,
    is401: unauthorized = false,
    isRetry: retry = false,
    isAuthorized: authorized = true,
  } = opts;

  // Generation mismatch: request belongs to an older session generation.
  // Must never mutate active session or invalidate it.
  if (
    requestGeneration !== undefined &&
    curGen !== undefined &&
    requestGeneration !== curGen
  ) {
    return 'IGNORE';
  }

  // Token superseded in same generation by a newer valid token (e.g. sliding window renewal)
  const isSuperseded = Boolean(
    reqTok &&
    actTok &&
    reqTok !== actTok &&
    !isTokenExpired(actTok)
  );

  if (isSuperseded) {
    if (retry) {
      return 'IGNORE';
    }
    return 'RETRY';
  }

  // Success outcome
  if (success) {
    if (!authorized) {
      return 'INVALIDATE';
    }
    if (!actTok || isTokenExpired(actTok)) {
      return 'INVALIDATE';
    }
    return 'APPLY';
  }

  // Failure outcome: genuine 401 for current token must invalidate
  if (unauthorized) {
    return 'INVALIDATE';
  }

  // Non-401 failures (e.g. network glitches) do not invalidate active session
  return 'IGNORE';
}

export class SessionCoordinator {
  constructor(storageAdapter = null) {
    this.storage = storageAdapter;
    this.memoryToken = null;
    this.memoryUser = null;
    this.sessionGeneration = 0;
    this.invalidationListeners = new Set();
  }

  getSessionGeneration() {
    return this.sessionGeneration;
  }

  incrementSessionGeneration() {
    this.sessionGeneration += 1;
    return this.sessionGeneration;
  }

  onSessionInvalidated(callback) {
    this.invalidationListeners.add(callback);
    return () => this.invalidationListeners.delete(callback);
  }

  notifySessionInvalidated() {
    this.invalidationListeners.forEach((callback) => {
      try {
        callback();
      } catch (err) {
        // Ignore subscriber execution error
      }
    });
  }

  getToken() {
    if (this.memoryToken) {
      if (isEligibleAdminToken(this.memoryToken)) {
        return this.memoryToken;
      }
      this.clearToken();
      this.clearCurrentUser();
      return null;
    }
    if (this.storage) {
      const stored = this.storage.getItem('tnl_admin_token');
      if (stored) {
        if (isEligibleAdminToken(stored)) {
          this.memoryToken = stored;
          return stored;
        }
        this.clearToken();
        this.clearCurrentUser();
        return null;
      }
    }
    return null;
  }

  setToken(token) {
    this.memoryToken = token;
    if (this.storage) {
      if (token) {
        this.storage.setItem('tnl_admin_token', token);
      } else {
        this.storage.removeItem('tnl_admin_token');
      }
    }
  }

  clearToken() {
    this.memoryToken = null;
    if (this.storage) {
      this.storage.removeItem('tnl_admin_token');
    }
  }

  getCurrentUser() {
    if (this.memoryUser) {
      return this.memoryUser;
    }
    if (this.storage) {
      const raw = this.storage.getItem('tnl_user_info');
      if (!raw) return null;
      try {
        this.memoryUser = JSON.parse(raw);
        return this.memoryUser;
      } catch {
        return null;
      }
    }
    return null;
  }

  setCurrentUser(user) {
    this.memoryUser = user;
    if (this.storage) {
      if (user) {
        this.storage.setItem('tnl_user_info', JSON.stringify(user));
      } else {
        this.storage.removeItem('tnl_user_info');
      }
    }
  }

  clearCurrentUser() {
    this.memoryUser = null;
    if (this.storage) {
      this.storage.removeItem('tnl_user_info');
    }
  }

  invalidateSession() {
    this.incrementSessionGeneration();
    this.clearToken();
    this.clearCurrentUser();
    this.notifySessionInvalidated();
  }

  handleSlidingTokenRenewal(renewedToken, requestToken, requestGeneration) {
    if (!renewedToken || requestGeneration !== this.sessionGeneration) {
      return false;
    }
    const activeToken = this.getToken();
    if (!activeToken) {
      return false;
    }
    if (shouldAdvanceTokenMonotonically(renewedToken, activeToken, requestToken)) {
      this.setToken(renewedToken);
      return true;
    }
    return false;
  }

  evaluateValidationOutcome(requestGeneration, requestToken, isSuccess, is401 = false, isRetry = false) {
    return evaluateSessionValidationOutcome({
      requestGeneration,
      currentGeneration: this.sessionGeneration,
      requestToken,
      activeToken: this.getToken(),
      isSuccess,
      is401,
      isRetry,
    });
  }
}
