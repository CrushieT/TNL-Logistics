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
};
