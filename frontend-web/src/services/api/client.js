import axios from 'axios';
import { Platform } from 'react-native';

const TOKEN_KEY = 'tnl_admin_token';
const USER_KEY = 'tnl_user_info';
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export function getToken() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

export function setToken(token) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearToken() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

export function getCurrentUser() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

export function setCurrentUser(user) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearCurrentUser() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(USER_KEY);
  }
}

export function isTokenExpired(token) {
  if (!token || typeof token !== 'string') return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    if (!parsed.exp) return false;
    return Date.now() >= (parsed.exp * 1000 - 30000);
  } catch (err) {
    return true;
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

export async function login(username, password) {
  const response = await axios.post(`${BASE_URL}/auth/login`, {
    username,
    password,
  });

  const { token, userId, role, mustChangePassword } = response.data;

  if (role === 'FIELD_STAFF') {
    throw new Error('Field staff accounts must use the mobile application.');
  }

  setToken(token);
  setCurrentUser({
    userId,
    username,
    role,
    mustChangePassword,
  });

  return response.data;
}

export function logout() {
  clearToken();
  clearCurrentUser();
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    window.location.href = '/login';
  }
}

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT automatically on every request.
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token && !isTokenExpired(token)) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Central 401 & 403 handling.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = error?.config?.url || '';

    // Ignore 401 from the login endpoint itself so login error messages can render.
    if (status === 401 && !requestUrl.includes('/auth/login')) {
      clearToken();
      clearCurrentUser();
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
        if (!window.location.pathname.startsWith('/login')) {
          const redirectPath = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/login?redirect=${redirectPath}`;
        }
      }
    }
    return Promise.reject(error);
  }
);

export async function validateSession() {
  const token = getToken();
  if (!token || isTokenExpired(token)) {
    clearToken();
    clearCurrentUser();
    return false;
  }
  try {
    const { data } = await apiClient.get('/auth/me');
    if (data && data.username) {
      setCurrentUser({
        userId: data.userId,
        username: data.username,
        role: data.role,
        fullName: data.fullName,
        mustChangePassword: data.mustChangePassword,
      });
      return true;
    }
    clearToken();
    clearCurrentUser();
    return false;
  } catch (error) {
    clearToken();
    clearCurrentUser();
    return false;
  }
}

export default apiClient;
