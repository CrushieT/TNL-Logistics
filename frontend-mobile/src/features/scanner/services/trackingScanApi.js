import { apiClient } from '../../../services/api/client';

export const trackingScanApi = {
  /**
   * Retrieves scan context for a specific tracking ID.
   * Field staff role required.
   */
  async getScanContext(trackingId, signal) {
    const { data } = await apiClient.get(
      `/tracking-events/scan-context/${encodeURIComponent(trackingId)}`,
      { signal }
    );
    return data;
  },

  /**
   * Retrieves active vehicles for truck assignment.
   */
  async getActiveVehicles(signal) {
    const { data } = await apiClient.get('/vehicles', { signal });
    return data;
  },

  /**
   * Submits a single parcel status scan.
   */
  async submitSingleScan(payload) {
    const { data } = await apiClient.post('/tracking-events/scan', payload);
    return data;
  },

  /**
   * Submits an atomic batch scan for multiple parcels.
   */
  async submitBatchScan(payload) {
    const { data } = await apiClient.post('/tracking-events/batch-scan', payload);
    return data;
  }
};
