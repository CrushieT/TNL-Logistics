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

export async function ensureAuthenticated() {
  let token = await getToken();
  if (!token) {
    try {
      const authRes = await axios.post('http://localhost:8080/api/v1/auth/login', {
        username: 'office',
        password: 'office123',
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
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Central 401 handling.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      await clearToken();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
