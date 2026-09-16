import apiClient from '../../../services/api/client';

/**
 * Fetch consolidated reporting summary payload.
 *
 * @param {Object} [params]
 * @param {string} [params.startDate] - YYYY-MM-DD
 * @param {string} [params.endDate] - YYYY-MM-DD
 * @returns {Promise<Object>}
 */
export async function getReportSummary(params = {}) {
  const query = {};
  if (params.startDate) query.startDate = params.startDate;
  if (params.endDate) query.endDate = params.endDate;

  const response = await apiClient.get('/reports/summary', { params: query });
  return response.data;
}
