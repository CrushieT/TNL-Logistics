import { getToken, isAuthenticated, onSessionInvalidated } from './client';
import { Platform } from 'react-native';
import { createSseStreamParser } from './sseClientCore.mjs';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

let activeAbortController = null;
let isConnecting = false;
let reconnectTimer = null;
const listeners = new Set();

if (typeof onSessionInvalidated === 'function') {
  onSessionInvalidated(() => {
    closeRealtimeConnection();
  });
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

  if (!isAuthenticated()) {
    return null;
  }

  if (activeAbortController || isConnecting) {
    return activeAbortController;
  }

  isConnecting = true;
  const abortController = new AbortController();
  activeAbortController = abortController;

  const token = getToken();
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

    isConnecting = false;

    if (!response.ok || !response.body) {
      throw new Error(`SSE connection failed with HTTP status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const parser = createSseStreamParser((eventName, eventData) => {
      dispatchEvent(eventName, eventData);
    });

    while (!abortController.signal.aborted) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      parser.feed(decoder.decode(value, { stream: true }));
    }
  } catch (err) {
    if (abortController.signal.aborted) {
      return null;
    }
    console.warn('Realtime SSE stream interrupted:', err?.message);
  } finally {
    isConnecting = false;
    if (activeAbortController === abortController) {
      activeAbortController = null;
    }

    if (listeners.size > 0 && isAuthenticated() && !abortController.signal.aborted) {
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          if (listeners.size > 0 && isAuthenticated()) {
            initRealtimeConnection();
          }
        }, 5000);
      }
    }
  }

  return activeAbortController;
}

export function closeRealtimeConnection() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
  isConnecting = false;
}

/**
 * Subscribe to real-time events. Returns an unsubscribe cleanup function.
 */
export function subscribeRealtimeEvents(callback) {
  listeners.add(callback);
  initRealtimeConnection();

  return () => {
    listeners.delete(callback);
    if (listeners.size === 0) {
      closeRealtimeConnection();
    }
  };
}
