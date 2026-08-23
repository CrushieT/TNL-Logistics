import axios from 'axios';

// Load the API URL from environment variable, falling back to localhost:8080
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

/**
 * Configure global axios instance for the admin web portal.
 */
export const apiClient = axios.create({
	baseURL: API_URL,
	headers: {
		'Content-Type': 'application/json',
	},
});
