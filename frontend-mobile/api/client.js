import axios from 'axios';

// In Expo development, EXPO_PUBLIC_API_URL is loaded from .env file.
// Note: When testing on a physical device, replace localhost with your development machine's local IP (e.g., http://192.168.1.X:8080).
// For Android emulator, use http://10.0.2.2:8080 if pointing to localhost.
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

/**
 * Configure global axios instance for the field mobile application.
 */
export const apiClient = axios.create({
	baseURL: API_URL,
	headers: {
		'Content-Type': 'application/json',
	},
});

// Request interceptor placeholder for attaching authentication tokens
apiClient.interceptors.request.use(
	(config) => {
		// TODO: Inject authorization header from secure store
		// const token = await SecureStore.getItemAsync('token');
		// if (token) {
		//   config.headers.Authorization = `Bearer ${token}`;
		// }
		return config;
	},
	(error) => Promise.reject(error)
);
