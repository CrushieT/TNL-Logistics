import { apiClient } from '../../../services/api/client';
import { buildPersonalHistoryParams, encodeTrackingId } from '../trackingHistoryFlow.mjs';

export const trackingHistoryApi = {
  /**
   * Fetches paginated personal scan events for the authenticated field staff member.
   */
  async listMyEvents({ search, page = 0, size = 20 } = {}, signal) {
    const params = buildPersonalHistoryParams({ search, page, size });
    const { data } = await apiClient.get('/tracking-events/mine', { params, signal });
    return data;
  },

  /**
   * Fetches today's personal daily scan metrics for the authenticated field staff member.
   */
  async getMyMetrics(signal) {
    const { data } = await apiClient.get('/tracking-events/mine/metrics', { signal });
    return data;
  },

  /**
   * Fetches operational parcel history and personal timeline for a specific tracking ID.
   */
  async getMyParcelHistory(trackingId, signal) {
    if (!trackingId || !String(trackingId).trim()) {
      throw new Error('Tracking ID is required');
    }
    const encoded = encodeTrackingId(trackingId);
    const { data } = await apiClient.get(`/tracking-events/mine/parcels/${encoded}`, { signal });
    return data;
  },
};
