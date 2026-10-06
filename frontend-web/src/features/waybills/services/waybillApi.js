import apiClient from '../../../services/api/client';

/**
 * Waybill Management API Client
 */

export async function getWaybillShipmentOptions() {
  const { data } = await apiClient.get('/waybills/shipments');
  return Array.isArray(data) ? data : [];
}

export async function getHaulerStaffOptions() {
  const { data } = await apiClient.get('/waybills/haulers');
  return Array.isArray(data) ? data : [];
}

export async function getWaybillManifest(shipmentId) {
  const { data } = await apiClient.get(`/waybills/shipments/${encodeURIComponent(shipmentId)}`);
  return Array.isArray(data) ? data : [];
}

export async function getWaybillByNumber(waybillId) {
  const { data } = await apiClient.get(`/waybills/${encodeURIComponent(waybillId)}`);
  return data;
}

export async function listWaybills(params = {}) {
  const queryParams = new URLSearchParams();

  if (params.page !== undefined) queryParams.append('page', params.page);
  if (params.size !== undefined) queryParams.append('size', params.size);
  if (params.search && params.search.trim()) queryParams.append('search', params.search.trim());
  if (params.status && params.status !== 'ALL') queryParams.append('status', params.status);
  if (params.hauler && params.hauler !== 'ALL') queryParams.append('hauler', params.hauler);

  const queryString = queryParams.toString();
  const url = `/waybills${queryString ? `?${queryString}` : ''}`;

  const { data } = await apiClient.get(url);
  return data;
}
