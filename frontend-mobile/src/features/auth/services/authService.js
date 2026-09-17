import { apiClient } from '../../../services/api/client';

export const authService = {
  /**
   * Authenticates staff using username & password (Stage 1 / Device Binding).
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{ token: string, userId: string, username: string, fullName: string, role: string, mustChangePassword: boolean, hasPinSet: boolean }>}
   */
  async loginWithPassword(username, password) {
    const response = await apiClient.post('/auth/mobile-login', { username, password });
    return response.data;
  },

  /**
   * Authenticates staff using a numeric PIN (Stage 3 / Shift Unlock).
   * Supports both raw PIN and targeted { username, pin } payloads.
   * @param {string|{ username?: string, pin: string }} pinOrPayload
   * @returns {Promise<{ token: string, userId: string, username: string, fullName: string, role: string, mustChangePassword: boolean, hasPinSet: boolean }>}
   */
  async loginWithPin(pinOrPayload) {
    const payload = typeof pinOrPayload === 'string'
      ? { pin: pinOrPayload }
      : pinOrPayload;
    const response = await apiClient.post('/auth/mobile-pin-login', payload);
    return response.data;
  },

  /**
   * Sets up or updates the staff member's mobile PIN (Stage 2).
   * Requires Bearer token authentication.
   * @param {string} pin - 4 to 6 digit numeric string
   * @returns {Promise<{ message: string, hasPinSet: boolean }>}
   */
  async setupPin(pin) {
    const response = await apiClient.post('/auth/mobile-setup-pin', { pin });
    return response.data;
  },

  /**
   * Fetches the current authenticated user's profile.
   */
  async fetchCurrentUser() {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
};
