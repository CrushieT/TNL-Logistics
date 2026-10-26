import { apiClient } from '../../../services/api/client';
import { getDeviceCredentials } from '../../../services/storage/secureStore';
import { authSessionCoordinator } from './sessionCoordinator.mjs';

async function requireDeviceHeaders() {
  const generation = authSessionCoordinator.generation();
  const deviceCredentials = await getDeviceCredentials();
  authSessionCoordinator.assertCurrent(generation);
  if (!deviceCredentials) {
    throw {
      status: null,
      code: 'MISSING_DEVICE_CREDENTIALS',
      message: 'This device must be bound with a password before continuing.',
      retryAfterSeconds: null,
    };
  }
  return {
    _sessionGeneration: generation,
    headers: {
      'X-Device-Id': deviceCredentials.deviceId,
      'X-Device-Token': deviceCredentials.deviceToken,
    },
  };
}

export const authService = {
  /**
   * Authenticates staff using username & password (Stage 1 / Device Binding).
   * @param {string} username
   * @param {string} password
   * @param {{ deviceId: string, deviceToken: string }} [deviceCredentials]
   * @param {boolean} [confirmDeviceSwitch]
   * @returns {Promise<{ token: string, deviceId: string, deviceToken: string, userId: string, username: string, fullName: string, role: string, mustChangePassword: boolean, hasPinSet: boolean }>}
   */
  async loginWithPassword(username, password, deviceCredentials, confirmDeviceSwitch = false) {
    const headers = deviceCredentials ? {
      'X-Device-Id': deviceCredentials.deviceId,
      'X-Device-Token': deviceCredentials.deviceToken,
    } : undefined;
    const response = await apiClient.post('/auth/mobile-login', { username, password, confirmDeviceSwitch }, {
      headers,
      _sessionGeneration: authSessionCoordinator.generation(),
      skipAuth: true,
      sensitivePayload: true,
    });
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
    }, { skipAuth: true, sensitivePayload: true, _sessionGeneration: authSessionCoordinator.generation() });
    return response.data;
  },

  /**
   * Sets up or updates the staff member's mobile PIN (Stage 2).
   * Requires Bearer token authentication.
   * @param {string} pin - Exactly 4 numeric digits
   * @returns {Promise<{ token: string, message: string, hasPinSet: boolean }>}
   */
  async setupInitialPin(pin) {
    const options = await requireDeviceHeaders();
    const response = await apiClient.post('/auth/mobile-setup-pin', { pin }, {
      ...options,
      sensitivePayload: true,
    });
    return response.data;
  },

  async rotatePin(pin, currentPassword) {
    const options = await requireDeviceHeaders();
    const response = await apiClient.post('/auth/mobile-setup-pin', { pin, currentPassword }, {
      ...options,
      sensitivePayload: true,
    });
    return response.data;
  },

  /**
   * Completes a mandatory password rotation for the current authenticated user.
   * @param {string} oldPassword
   * @param {string} newPassword
   * @returns {Promise<{ token: string, userId: string, username: string, role: string, mustChangePassword: boolean }>}
   */
  async changePassword(oldPassword, newPassword) {
    const response = await apiClient.post('/auth/password-change', { oldPassword, newPassword }, {
      _sessionGeneration: authSessionCoordinator.generation(),
      sensitivePayload: true,
    });
    return response.data;
  },

  async verifyCurrentPassword(password) {
    const response = await apiClient.post('/auth/verify-password', { password }, {
      _sessionGeneration: authSessionCoordinator.generation(),
      sensitivePayload: true,
    });
    return response.data;
  },

  /**
   * Fetches the current authenticated user's profile.
   */
  async fetchCurrentUser() {
    const options = await requireDeviceHeaders();
    const response = await apiClient.get('/auth/me', { ...options, sensitivePayload: true });
    return response.data;
  },

  async unbindCurrentDevice() {
    const options = await requireDeviceHeaders();
    const response = await apiClient.post('/auth/mobile-unbind', null, {
      ...options,
      sensitivePayload: true,
    });
    return response.data;
  },

  /**
   * Checks the PIN configuration status for a specific staff username.
   * @param {string} username
   * @returns {Promise<{ username: string, hasPinSet: boolean }>}
   */
  async checkMobilePinStatus(username) {
    const generation = authSessionCoordinator.generation();
    const deviceCredentials = await getDeviceCredentials();
    authSessionCoordinator.assertCurrent(generation);
    if (!deviceCredentials) {
      return { username, hasPinSet: false };
    }

    const response = await apiClient.get(`/auth/mobile-pin-status?username=${encodeURIComponent(username)}`, {
      _sessionGeneration: generation,
      skipAuth: true,
      sensitivePayload: true,
      headers: {
        'X-Device-Id': deviceCredentials.deviceId,
        'X-Device-Token': deviceCredentials.deviceToken,
      },
    });
    return response.data;
  },
};
