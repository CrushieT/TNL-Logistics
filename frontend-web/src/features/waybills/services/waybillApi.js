import apiClient from '../../../services/api/client';
import { buildWaybillListQuery } from '../waybillDirectory.mjs';

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
  const queryString = buildWaybillListQuery(params);
  const { data } = await apiClient.get(`/waybills?${queryString}`);
  return data;
}
