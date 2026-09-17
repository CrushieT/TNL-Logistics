import { apiClient } from '../../../services/api/client';

export const authService = {
  /**
   * Authenticates staff using a numeric PIN.
   * @param {string} pin - 4-6 digit numeric string
   * @returns {Promise<{ token: string, userId: string, username: string, fullName: string, role: string, mustChangePassword: boolean }>}
   */
  async loginWithPin(pin) {
    const response = await apiClient.post('/auth/mobile-pin-login', { pin });
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
