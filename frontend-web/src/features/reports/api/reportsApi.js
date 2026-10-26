import apiClient from '../../../services/api/client';

/**
 * Fetch consolidated reporting summary payload.
 *
 * @param {Object} [params]
 * @param {string} [params.startDate] - YYYY-MM-DD
 * @param {string} [params.endDate] - YYYY-MM-DD
 * @returns {Promise<Object>}
 */
export async function getReportSummary(params = {}, options = {}) {
  const query = {};
  if (params.startDate) query.startDate = params.startDate;
  if (params.endDate) query.endDate = params.endDate;

  const signal = options?.signal || params?.signal;
  const response = await apiClient.get('/reports/summary', {
    params: query,
    ...(signal ? { signal } : {}),
  });
  return response.data;
}
