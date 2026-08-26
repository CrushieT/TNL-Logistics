import axios from 'axios';

// support both Next.js (NEXT_PUBLIC_) and standard React (REACT_APP_) environment variables
const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:8080';

/**
 * Configure global axios instance for the admin dashboard.
 * Preconfigured with JSON headers and CORS compatibility.
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
		// TODO: Retrieve security token from localStorage/cookies and inject into header
		// const token = localStorage.getItem('token');
		// if (token) {
		//   config.headers.Authorization = `Bearer ${token}`;
		// }
		return config;
	},
	(error) => Promise.reject(error)
);
