import { getToken, getSessionAuthContext, onSessionChanged, onSessionInvalidated } from './client';
import { Platform } from 'react-native';
import { createSseStreamParser, calculateBackoffDelay, isAuthFailureStatus } from './sseClientCore.mjs';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

let activeConnection = null;
let reconnectTimer = null;
let reconnectAuth = null;
let reconnectAttempt = 0;
let blockedAuth = null;
const listeners = new Set();

if (typeof onSessionInvalidated === 'function') {
  onSessionInvalidated(() => {
    blockedAuth = null;
    reconnectAttempt = 0;
    closeRealtimeConnection();
  });
}

onSessionChanged(synchronizeSession);

function getConnectionAuth() {
  return { ...getSessionAuthContext(), token: getToken() };
}

function matchesAuth(left, right) {
  return left && right.isAuthenticated && right.isVerified
    && left.userId === right.userId
    && left.sessionGeneration === right.sessionGeneration
    && left.token === right.token;
}

function isCurrentConnection(connection) {
  return activeConnection === connection && !connection.controller.signal.aborted
    && matchesAuth(connection.auth, getConnectionAuth());
}

function synchronizeSession() {
  const auth = getConnectionAuth();
  if (!auth.isAuthenticated || !auth.isVerified) {
    blockedAuth = null;
    closeRealtimeConnection();
    return;
  }
  if (blockedAuth && !matchesAuth(blockedAuth, auth)) {
    blockedAuth = null;
    reconnectAttempt = 0;
  }
  if (activeConnection && !matchesAuth(activeConnection.auth, auth)) {
    closeRealtimeConnection();
    reconnectAttempt = 0;
  }
  if (reconnectTimer && !matchesAuth(reconnectAuth, auth)) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    reconnectAuth = null;
    reconnectAttempt = 0;
  }
  if (!activeConnection && !reconnectTimer) initRealtimeConnection();
}

function dispatchEvent(type, data) {
  listeners.forEach((listener) => {
    try {
      listener({ type, data });
    } catch (err) {
      // Ignore subscriber execution errors
    }
  });
}

export async function initRealtimeConnection() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof fetch === 'undefined') {
    return null;
  }

  const auth = getConnectionAuth();
  if (listeners.size === 0 || !auth.isAuthenticated || !auth.isVerified || matchesAuth(blockedAuth, auth)) {
    return null;
  }

  if (activeConnection) {
    if (!matchesAuth(activeConnection.auth, auth)) synchronizeSession();
    return activeConnection?.controller || null;
  }

  const abortController = new AbortController();
  const connection = { controller: abortController, auth };
  activeConnection = connection;

  const token = auth.token;
  const url = `${API_BASE_URL}/events/stream`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      signal: abortController.signal,
    });

    if (!isCurrentConnection(connection)) {
      if (activeConnection === connection) synchronizeSession();
      return null;
    }

    if (!response.ok || !response.body) {
      if (isAuthFailureStatus(response.status)) {
        blockedAuth = auth;
      }
      throw new Error(`SSE connection failed with HTTP status ${response.status}`);
    }

    // Reset backoff schedule immediately upon successful connection
    reconnectAttempt = 0;
    blockedAuth = null;

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const parser = createSseStreamParser((eventName, eventData) => {
      if (isCurrentConnection(connection)) dispatchEvent(eventName, eventData);
    });

    while (!abortController.signal.aborted) {
      const { done, value } = await reader.read();
      if (!isCurrentConnection(connection)) {
        if (activeConnection === connection) synchronizeSession();
        return null;
      }
      if (done) {
        break;
      }

      parser.feed(decoder.decode(value, { stream: true }));
    }
  } catch (err) {
    if (!isCurrentConnection(connection)) {
      if (activeConnection === connection) synchronizeSession();
      return null;
    }
    console.warn('Realtime SSE stream interrupted:', err?.message);
  } finally {
    if (activeConnection === connection) {
      if (!isCurrentConnection(connection)) {
        synchronizeSession();
      } else {
        activeConnection = null;
        if (!matchesAuth(blockedAuth, getConnectionAuth()) && listeners.size > 0 && !reconnectTimer) {
          const delay = calculateBackoffDelay(reconnectAttempt);
          reconnectAttempt += 1;
          const timer = setTimeout(() => {
            if (reconnectTimer !== timer) return;
            reconnectTimer = null;
            reconnectAuth = null;
            synchronizeSession();
          }, delay);
          reconnectTimer = timer;
          reconnectAuth = auth;
        }
      }
    }
  }

  return activeConnection?.controller || null;
}

export function closeRealtimeConnection() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAuth = null;
  if (activeConnection) {
    const connection = activeConnection;
    activeConnection = null;
    connection.controller.abort();
  }
}

/**
 * Subscribe to real-time events. Returns an unsubscribe cleanup function.
 */
export function subscribeRealtimeEvents(callback) {
  listeners.add(callback);
  if (listeners.size === 1) {
    blockedAuth = null;
    reconnectAttempt = 0;
  }
  initRealtimeConnection();

  return () => {
    listeners.delete(callback);
    if (listeners.size === 0) {
      closeRealtimeConnection();
    }
  };
}
