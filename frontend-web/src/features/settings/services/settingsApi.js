import apiClient from '../../../services/api/client';

/**
 * Fetch full administrative system configuration.
 * Restricted to ADMIN role.
 * @returns {Promise<Object>}
 */
export async function getSystemSettings() {
  const { data } = await apiClient.get('/settings');
  return data;
}

/**
 * Update system configuration settings.
 * Restricted to ADMIN role.
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export async function updateSystemSettings(payload) {
  const { data } = await apiClient.put('/settings', payload);
  return data;
}

/**
 * Fetch company branding, collection day, and calculation parameters.
 * Available to all authenticated staff.
 * @returns {Promise<Object>}
 */
export async function getCompanyBranding() {
  const { data } = await apiClient.get('/settings/branding');
  return data;
}
