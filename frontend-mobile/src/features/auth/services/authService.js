import { apiClient } from '../../../services/api/client';
import { getDeviceCredentials } from '../../../services/storage/secureStore';

export const authService = {
  /**
   * Authenticates staff using username & password (Stage 1 / Device Binding).
   * @param {string} username
   * @param {string} password
   * @param {string} [deviceId] Existing device identifier when re-authenticating.
   * @returns {Promise<{ token: string, deviceId: string, deviceToken: string, userId: string, username: string, fullName: string, role: string, mustChangePassword: boolean, hasPinSet: boolean }>}
   */
  async loginWithPassword(username, password, deviceId) {
    const headers = deviceId ? { 'X-Device-Id': deviceId } : undefined;
    const response = await apiClient.post('/auth/mobile-login', { username, password }, { headers });
    return response.data;
  },

  /**
   * Authenticates staff using a numeric PIN (Stage 3 / Shift Unlock).
   * @param {string} username
   * @param {string} pin
   * @param {{ deviceId: string, deviceToken: string }} deviceCredentials
   * @returns {Promise<{ token: string, deviceId: string, deviceToken: string, userId: string, username: string, fullName: string, role: string, mustChangePassword: boolean, hasPinSet: boolean }>}
   */
  async loginWithPin(username, pin, deviceCredentials) {
    const response = await apiClient.post('/auth/mobile-pin-login', {
      username,
      pin,
      deviceId: deviceCredentials.deviceId,
      deviceToken: deviceCredentials.deviceToken,
    });
    return response.data;
  },

  /**
   * Sets up or updates the staff member's mobile PIN (Stage 2).
   * Requires Bearer token authentication.
   * @param {string} pin - 4 to 6 digit numeric string
   * @returns {Promise<{ token: string, message: string, hasPinSet: boolean }>}
   */
  async setupPin(pin) {
    const response = await apiClient.post('/auth/mobile-setup-pin', { pin });
    return response.data;
  },

  /**
   * Completes a mandatory password rotation for the current authenticated user.
   * @param {string} oldPassword
   * @param {string} newPassword
   * @returns {Promise<{ token: string, userId: string, username: string, role: string, mustChangePassword: boolean }>}
   */
  async changePassword(oldPassword, newPassword) {
    const response = await apiClient.post('/auth/password-change', { oldPassword, newPassword });
    return response.data;
  },

  /**
   * Fetches the current authenticated user's profile.
   */
  async fetchCurrentUser() {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  /**
   * Checks the PIN configuration status for a specific staff username.
   * @param {string} username
   * @returns {Promise<{ username: string, hasPinSet: boolean }>}
   */
  async checkMobilePinStatus(username) {
    const deviceCredentials = await getDeviceCredentials();
    if (!deviceCredentials) {
      return { username, hasPinSet: false };
    }

    const response = await apiClient.get(`/auth/mobile-pin-status?username=${encodeURIComponent(username)}`, {
      headers: {
        'X-Device-Id': deviceCredentials.deviceId,
        'X-Device-Token': deviceCredentials.deviceToken,
      },
    });
    return response.data;
  },
};
