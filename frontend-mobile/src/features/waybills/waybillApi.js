import { apiClient } from '../../services/api/client';

export async function listShipmentOptions({ page = 0, size = 20, search, signal } = {}) {
  const { data } = await apiClient.get('/waybills/shipment-options', {
    params: { page, size, ...(search ? { search } : {}) },
    signal
  });
  return data;
}

export async function listWaybillOptions({ page = 0, size = 20, search, status, signal } = {}) {
  const { data } = await apiClient.get('/waybills/options', {
    params: { page, size, ...(search ? { search } : {}), ...(status ? { status } : {}) },
    signal
  });
  return data;
}

export async function listShipmentWaybills(shipmentId) {
  const { data } = await apiClient.get(`/waybills/shipments/${encodeURIComponent(shipmentId)}`);
  return data;
}

export async function listAvailableUnits(shipmentId) {
  const { data } = await apiClient.get(`/waybills/shipments/${encodeURIComponent(shipmentId)}/available`);
  return data;
}

export async function getWaybill(waybillId) {
  const { data } = await apiClient.get(`/waybills/${encodeURIComponent(waybillId)}`);
  return data;
}

export async function generateWaybill(payload) {
  const { data } = await apiClient.post('/waybills/generate', payload);
  return data;
}

export async function sendWaybill(waybillId) {
  const { data } = await apiClient.post(`/waybills/${encodeURIComponent(waybillId)}/send`);
  return data;
}

export async function completeWaybill(waybillId, payload) {
  const { data } = await apiClient.post(`/waybills/${encodeURIComponent(waybillId)}/complete`, payload);
  return data;
}
