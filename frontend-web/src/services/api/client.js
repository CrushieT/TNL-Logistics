import axios from 'axios';
import { Platform } from 'react-native';
import { evaluateSessionValidationOutcome } from './sessionCore.mjs';

const TOKEN_KEY = 'tnl_admin_token';
const USER_KEY = 'tnl_user_info';
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

let memoryToken = null;
let memoryUser = null;
let sessionGeneration = 0;
const sessionInvalidationListeners = new Set();

export function getSessionGeneration() {
  return sessionGeneration;
}

export function incrementSessionGeneration() {
  sessionGeneration += 1;
  return sessionGeneration;
}

export function onSessionInvalidated(callback) {
  sessionInvalidationListeners.add(callback);
  return () => sessionInvalidationListeners.delete(callback);
}

function notifySessionInvalidated() {
  sessionInvalidationListeners.forEach((callback) => {
    try {
      callback();
    } catch (err) {
      // Ignore subscriber execution error
    }
  });
}

export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
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

export function isTokenExpired(token) {
  const parsed = decodeJwtPayload(token);
  if (!parsed || !parsed.exp) return true;
  return Date.now() >= (parsed.exp * 1000 - 30000);
}

export function getToken() {
  if (memoryToken) {
    if (!isTokenExpired(memoryToken)) {
      return memoryToken;
    }
    clearToken();
    clearCurrentUser();
    return null;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem(TOKEN_KEY);
    if (stored) {
      if (!isTokenExpired(stored)) {
        memoryToken = stored;
        return stored;
      }
      clearToken();
      clearCurrentUser();
      return null;
    }
  }
  return null;
}

export function setToken(token) {
  memoryToken = token;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    if (token) {
      window.localStorage.setItem(TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  }
}

export function clearToken() {
  memoryToken = null;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

export function getCurrentUser() {
  if (memoryUser) {
    return memoryUser;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      memoryUser = JSON.parse(raw);
      return memoryUser;
    } catch {
      return null;
    }
  }
  return null;
}

export function setCurrentUser(user) {
  memoryUser = user;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    if (user) {
      window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(USER_KEY);
    }
  }
}

export function clearCurrentUser() {
  memoryUser = null;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(USER_KEY);
  }
}

export function isAuthenticated() {
  const token = getToken();
  return Boolean(token && !isTokenExpired(token));
}

export async function ensureAuthenticated() {
  const token = getToken();
  if (!token || isTokenExpired(token)) {
    return null;
  }
  return token;
}

export function invalidateSession() {
  incrementSessionGeneration();
  clearToken();
  clearCurrentUser();
  notifySessionInvalidated();
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    if (!window.location.pathname.startsWith('/login')) {
      const redirectPath = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?redirect=${redirectPath}`;
    }
  }
}

export function logout() {
  invalidateSession();
}

export function handleSlidingTokenRenewal(renewedToken, requestToken, requestGeneration) {
  if (!renewedToken || requestGeneration !== sessionGeneration) {
    return;
  }
  const activeToken = getToken();
  if (!activeToken) {
    return;
  }
  const activePayload = decodeJwtPayload(activeToken);
  const renewedPayload = decodeJwtPayload(renewedToken);
  const requestPayload = decodeJwtPayload(requestToken);

  if (!activePayload || !renewedPayload || !renewedPayload.exp) {
    return;
  }

  // Ensure renewed token matches identity, version, and original auth_time of active session
  if (
    renewedPayload.sub !== activePayload.sub ||
    renewedPayload.uid !== activePayload.uid ||
    renewedPayload.role !== activePayload.role ||
    renewedPayload.ver !== activePayload.ver ||
    (requestPayload && renewedPayload.auth_time !== requestPayload.auth_time)
  ) {
    return;
  }

  // Monotonic expiration advance
  if (renewedPayload.exp > activePayload.exp) {
    setToken(renewedToken);
  }
}

export async function login(username, password) {
  const response = await axios.post(`${BASE_URL}/auth/login`, {
    username,
    password,
  });

  const { token, userId, role, mustChangePassword } = response.data;

  if (role === 'FIELD_STAFF') {
    throw new Error('Field staff accounts must use the mobile application.');
  }

  incrementSessionGeneration();
  setToken(token);
  setCurrentUser({
    userId,
    username,
    role,
    mustChangePassword,
  });

  return response.data;
}

export async function checkFirstBootStatus() {
  try {
    const response = await axios.get(`${BASE_URL}/auth/first-boot-status`);
    return Boolean(response.data?.isFirstBoot);
  } catch (error) {
    return false;
  }
}

export async function registerFirstBootAdmin({
  fullName,
  username,
  password,
  confirmPassword,
  companyName,
  companyAddress,
  companyContact,
  billingEmail,
}) {
  const response = await axios.post(`${BASE_URL}/auth/first-boot-admin`, {
    fullName,
    username,
    password,
    confirmPassword,
    companyName,
    companyAddress,
    companyContact,
    billingEmail,
  });

  const { token, userId, role, mustChangePassword } = response.data;

  incrementSessionGeneration();
  setToken(token);
  setCurrentUser({
    userId,
    username,
    role,
    fullName,
    mustChangePassword,
  });

  return response.data;
}

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT and session generation automatically on every request.
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token && !isTokenExpired(token)) {
    config.headers = config.headers || {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (!config.metadata) {
      config.metadata = {
        generation: sessionGeneration,
        token,
      };
    }
  }
  return config;
});

// Central 401 & 403 handling with sliding session renewal and stale 401 suppression.
apiClient.interceptors.response.use(
  (response) => {
    const renewedToken = response?.headers?.['x-renewed-token'];
    const reqGen = response?.config?.metadata?.generation;
    const reqToken = response?.config?.metadata?.token;
    if (renewedToken && reqGen !== undefined && reqToken) {
      handleSlidingTokenRenewal(renewedToken, reqToken, reqGen);
    }
    return response;
  },
  (error) => {
    const status = error?.response?.status;
    const requestUrl = error?.config?.url || '';

    if (status === 401 && !requestUrl.includes('/auth/login')) {
      const reqGen = error?.config?.metadata?.generation;
      const reqToken = error?.config?.metadata?.token;
      const activeToken = getToken();

      // Suppress stale 401s from older generations or superseded tokens while active token is valid
      if (
        (reqGen !== undefined && reqGen !== sessionGeneration) ||
        (reqToken && activeToken && reqToken !== activeToken && !isTokenExpired(activeToken))
      ) {
        return Promise.reject(error);
      }

      invalidateSession();
    }

    if (status === 403 && error?.response?.data?.code === 'PASSWORD_CHANGE_REQUIRED') {
      const currentUser = getCurrentUser();
      if (currentUser) {
        setCurrentUser({ ...currentUser, mustChangePassword: true });
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
        if (!window.location.pathname.startsWith('/change-password')) {
          window.location.href = '/change-password';
        }
      }
    }
    return Promise.reject(error);
  }
);

export async function validateSession(isRetry = false) {
  const token = getToken();
  if (!token || isTokenExpired(token)) {
    clearToken();
    clearCurrentUser();
    return false;
  }

  const requestGeneration = sessionGeneration;
  const requestToken = token;

  try {
    const { data } = await apiClient.get('/auth/me', {
      headers: {
        Authorization: `Bearer ${requestToken}`,
      },
      metadata: {
        generation: requestGeneration,
        token: requestToken,
      },
    });

    const activeToken = getToken();
    const action = evaluateSessionValidationOutcome({
      requestGeneration,
      currentGeneration: sessionGeneration,
      requestToken,
      activeToken,
      isSuccess: Boolean(data && data.username),
      is401: false,
      isRetry,
    });

    if (action === 'APPLY') {
      setCurrentUser({
        userId: data.userId,
        username: data.username,
        role: data.role,
        fullName: data.fullName,
        mustChangePassword: data.mustChangePassword,
      });
      return true;
    }

    if (action === 'RETRY' && !isRetry) {
      return await validateSession(true);
    }

    if (action === 'INVALIDATE') {
      invalidateSession();
      return false;
    }

    return isAuthenticated();
  } catch (error) {
    const status = error?.response?.status;
    const is401 = status === 401;
    const activeToken = getToken();

    const action = evaluateSessionValidationOutcome({
      requestGeneration,
      currentGeneration: sessionGeneration,
      requestToken,
      activeToken,
      isSuccess: false,
      is401,
      isRetry,
    });

    if (action === 'RETRY' && !isRetry) {
      return await validateSession(true);
    }

    if (action === 'INVALIDATE') {
      invalidateSession();
      return false;
    }

    return isAuthenticated();
  }
}

export async function changePassword(oldPassword, newPassword) {
  const response = await apiClient.post('/auth/password-change', {
    oldPassword,
    newPassword,
  });

  if (response.data?.token) {
    incrementSessionGeneration();
    setToken(response.data.token);
  }

  const currentUser = getCurrentUser();
  if (currentUser) {
    setCurrentUser({
      ...currentUser,
      mustChangePassword: false,
      role: response.data?.role || currentUser.role,
      username: response.data?.username || currentUser.username,
      userId: response.data?.userId || currentUser.userId,
    });
  }

  return response.data;
}

export async function verifyPassword(password) {
  const response = await apiClient.post('/auth/verify-password', { password });
  return response.data;
}

export default apiClient;
