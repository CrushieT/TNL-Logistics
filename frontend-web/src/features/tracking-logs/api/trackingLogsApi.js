import apiClient from '../../../services/api/client';

/**
 * Fetch paginated tracking event audit logs with optional search, status, and date filters.
 */
export async function listTrackingLogs({ search, status, startDate, endDate, page = 0, size = 25 } = {}) {
  const params = { page, size };
  if (search && search.trim()) params.search = search.trim();
  if (status && status !== 'ALL') params.status = status;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  const response = await apiClient.get('/tracking-events', { params });
  return response.data;
}

/**
 * Fetch today's operational tracking metrics for the 4-card summary bar.
 */
export async function getTrackingMetrics() {
  const response = await apiClient.get('/tracking-events/metrics');
  return response.data;
}
