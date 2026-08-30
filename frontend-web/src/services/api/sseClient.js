import { ensureAuthenticated } from './client';
import { Platform } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

let globalEventSource = null;
const listeners = new Set();

export async function initRealtimeConnection() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return null;
  }

  if (globalEventSource && globalEventSource.readyState !== EventSource.CLOSED) {
    return globalEventSource;
  }

  const token = await ensureAuthenticated();
  const url = `${API_BASE_URL}/events/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;

  try {
    globalEventSource = new EventSource(url);

    globalEventSource.addEventListener('INIT', () => {
      // Handshake established
    });

    globalEventSource.addEventListener('STATUS_UPDATE', (e) => {
      try {
        const payload = JSON.parse(e.data);
        listeners.forEach((listener) => {
          try { listener({ type: 'STATUS_UPDATE', data: payload }); } catch (err) {}
        });
      } catch (err) {}
    });

    globalEventSource.addEventListener('SHIPMENT_CREATED', (e) => {
      try {
        const payload = JSON.parse(e.data);
        listeners.forEach((listener) => {
          try { listener({ type: 'SHIPMENT_CREATED', data: payload }); } catch (err) {}
        });
      } catch (err) {}
    });

    globalEventSource.addEventListener('LABEL_PRINTED', (e) => {
      try {
        const payload = JSON.parse(e.data);
        listeners.forEach((listener) => {
          try { listener({ type: 'LABEL_PRINTED', data: payload }); } catch (err) {}
        });
      } catch (err) {}
    });

    globalEventSource.addEventListener('PAYMENT_RECORDED', (e) => {
      try {
        const payload = JSON.parse(e.data);
        listeners.forEach((listener) => {
          try { listener({ type: 'PAYMENT_RECORDED', data: payload }); } catch (err) {}
        });
      } catch (err) {}
    });

    globalEventSource.addEventListener('SOA_GENERATED', (e) => {
      try {
        const payload = JSON.parse(e.data);
        listeners.forEach((listener) => {
          try { listener({ type: 'SOA_GENERATED', data: payload }); } catch (err) {}
        });
      } catch (err) {}
    });

    globalEventSource.onerror = () => {
      // Browser EventSource automatically reconnects per standard specification
    };

    return globalEventSource;
  } catch (err) {
    console.warn('Realtime SSE initialization failed:', err?.message);
    return null;
  }
}

/**
 * Subscribe to real-time events. Returns an unsubscribe cleanup function.
 */
export function subscribeRealtimeEvents(callback) {
  listeners.add(callback);
  initRealtimeConnection();

  return () => {
    listeners.delete(callback);
  };
}
