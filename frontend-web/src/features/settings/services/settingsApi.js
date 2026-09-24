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

let cachedBranding = null;
let pendingBrandingPromise = null;

/**
 * Update system configuration settings.
 * Restricted to ADMIN role.
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export async function updateSystemSettings(payload) {
  const { data } = await apiClient.put('/settings', payload);
  invalidateCompanyBrandingCache();
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem('tnl_branding_invalidated_at', String(Date.now()));
    } catch {}
  }
  return data;
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('storage', (event) => {
    if (event.key === 'tnl_branding_invalidated_at') {
      invalidateCompanyBrandingCache();
    }
  });
}

/**
 * Fetch company branding, collection day, and calculation parameters.
 * Available to all authenticated staff. Cached in memory to deduplicate requests.
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<Object>}
 */
export async function getCompanyBranding(forceRefresh = false) {
  if (!forceRefresh && cachedBranding) {
    return cachedBranding;
  }
  if (!forceRefresh && pendingBrandingPromise) {
    return pendingBrandingPromise;
  }

  pendingBrandingPromise = apiClient.get('/settings/branding')
    .then(({ data }) => {
      cachedBranding = data;
      return data;
    })
    .finally(() => {
      pendingBrandingPromise = null;
    });

  return pendingBrandingPromise;
}

/**
 * Retrieve synchronously cached branding if previously fetched.
 * @returns {Object|null}
 */
export function getCachedCompanyBranding() {
  return cachedBranding;
}

/**
 * Invalidate the in-memory company branding cache.
 */
export function invalidateCompanyBrandingCache() {
  cachedBranding = null;
  pendingBrandingPromise = null;
}
