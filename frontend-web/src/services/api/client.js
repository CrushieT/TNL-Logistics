import axios from 'axios';
import { Platform } from 'react-native';

const TOKEN_KEY = 'tnl_admin_token';

export async function getToken() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

export async function setToken(token) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(TOKEN_KEY, token);
  }
}

export async function clearToken() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

export async function ensureAuthenticated() {
  let token = await getToken();
  if (!token || isTokenExpired(token)) {
    try {
      await clearToken();
      const authRes = await axios.post('http://localhost:8080/api/v1/auth/login', {
        username: 'admin',
        password: 'admin123',
      });
      if (authRes.data?.token) {
        token = authRes.data.token;
        await setToken(token);
      }
    } catch (e) {
      console.warn('Auto-login failed. Make sure backend is running.', e?.message);
    }
  }
  return token;
}

// Attach JWT automatically on every request.
apiClient.interceptors.request.use(async (config) => {
  const token = await ensureAuthenticated();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Central 401 & 403 handling with transparent re-login retry.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config;

    if ((status === 401 || status === 403) && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await clearToken();
        const newToken = await ensureAuthenticated();
        if (newToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch (retryErr) {
        console.warn('Re-authentication retry failed:', retryErr);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
