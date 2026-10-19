import apiClient from '../../../services/api/client';

/**
 * Vehicle Fleet API Client
 */
export async function listVehicles(includeInactive = true, options = {}) {
  const { data } = await apiClient.get(`/vehicles?all=${includeInactive}`, { signal: options.signal });
  if (!Array.isArray(data)) throw new Error('Invalid vehicle directory response.');
  return data;
}

export async function getVehicle(vehicleId) {
  const { data } = await apiClient.get(`/vehicles/${vehicleId}`);
  return data;
}

export async function createVehicle(payload) {
  const { data } = await apiClient.post('/vehicles', payload);
  return data;
}

export async function updateVehicle(vehicleId, payload) {
  const { data } = await apiClient.put(`/vehicles/${vehicleId}`, payload);
  return data;
}

export async function deleteVehicle(vehicleId) {
  const { data } = await apiClient.delete(`/vehicles/${vehicleId}`);
  return data;
}
