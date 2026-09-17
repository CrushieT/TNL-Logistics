import axios from 'axios';
import Constants from 'expo-constants';
import { getToken, removeToken, removeUser } from '../storage/secureStore';

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

export const apiClient = axios.create({
  baseURL: resolveBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor injecting Bearer token
apiClient.interceptors.request.use(
  async (config) => {
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

// Response interceptor handling session revocation
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      if (error.response.data?.message?.includes('revoked') || error.response.data?.message?.includes('expired')) {
        await removeToken();
        await removeUser();
      }
    }
    return Promise.reject(error);
  }
);
