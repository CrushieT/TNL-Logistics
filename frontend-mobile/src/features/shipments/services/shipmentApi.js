import { apiClient } from '../../../services/api/client';

export const shipmentApi = {
  async listClients(search, page, signal) {
    const { data } = await apiClient.get('/clients', { params: { active: true, search, page, size: 20 }, signal });
    return data;
  },
  async createClient(payload) {
    const { data } = await apiClient.post('/clients', payload);
    return data;
  },
  async registerShipment(payload) {
    const { data } = await apiClient.post('/shipments', payload);
    return data;
  },
  async getCalculationSettings(signal) {
    const { data } = await apiClient.get('/settings/branding', { signal });
    return data;
  },
  async listShipments({ search, status, labelStatus, page = 0, size = 20 }, signal) {
    const params = { page, size };
    if (search && search.trim()) params.search = search.trim();
    if (status && status !== 'ALL') params.status = status;
    if (labelStatus && labelStatus !== 'ALL') params.labelStatus = labelStatus;
    const { data } = await apiClient.get('/shipments', { params, signal });
    return data;
  },
  async getShipment(shipmentId, signal) {
    const { data } = await apiClient.get(`/shipments/${encodeURIComponent(shipmentId)}`, { signal });
    return data;
  },
  async getParcelUnit(trackingId, signal) {
    const { data } = await apiClient.get(`/parcel-units/${encodeURIComponent(trackingId)}`, { signal });
    return data;
  },
  async printLabels(shipmentId, packageIds, printJobId, printerId) {
    const { data } = await apiClient.post(`/shipments/${encodeURIComponent(shipmentId)}/labels/print`, {
      printJobId,
      packageIds,
      printerId,
    });
    return data;
  },
};
