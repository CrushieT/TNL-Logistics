import axios from 'axios';
import Constants from 'expo-constants';
import { getToken } from '../storage/secureStore';
import {
  buildSessionRetryConfig,
  classifySessionFailure,
  sanitizeSensitiveError,
} from './sessionHandling.mjs';

function resolveBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:8080/api/v1`;
  }
  return 'http://localhost:8080/api/v1';
}

function assertSecureProductionBaseUrl(baseUrl) {
  const isProductionBuild =
    (typeof __DEV__ !== 'undefined' && !__DEV__) || process.env.NODE_ENV === 'production';

  if (isProductionBuild && !baseUrl.startsWith('https://')) {
    throw new Error('Production builds require an HTTPS EXPO_PUBLIC_API_URL');
  }

  return baseUrl;
}

export const apiClient = axios.create({
  baseURL: assertSecureProductionBaseUrl(resolveBaseUrl()),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

apiClient.interceptors.request.use(
  async (config) => {
    if (config.skipAuth === true) {
      if (config.headers) delete config.headers.Authorization;
      return config;
    }
    try {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      // Non-blocking token retrieval failure
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let onSessionEventCallback = null;

export function setSessionEventCallback(callback) {
  onSessionEventCallback = callback;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    let currentToken = null;
    try {
      currentToken = await getToken();
    } catch {
      currentToken = null;
    }
    const sessionFailure = classifySessionFailure(error, currentToken);

    if (sessionFailure.action === 'retry') {
      return apiClient.request(buildSessionRetryConfig(error.config, currentToken));
    }

    if (sessionFailure.action === 'reauthenticate' && typeof onSessionEventCallback === 'function') {
      await onSessionEventCallback({ type: 'SESSION_REAUTH_REQUIRED' });
    } else if (sessionFailure.action === 'clear-device' && typeof onSessionEventCallback === 'function') {
      await onSessionEventCallback({ type: 'INVALID_DEVICE_CREDENTIALS' });
    }

    if (error.config?.sensitivePayload === true) {
      return Promise.reject(sanitizeSensitiveError(error));
    }

    return Promise.reject(error);
  }
);

export function setSessionRevokedCallback(callback) {
  setSessionEventCallback(async (event) => {
    if (event.type === 'SESSION_REAUTH_REQUIRED') {
      await callback(event);
    }
  });
}
