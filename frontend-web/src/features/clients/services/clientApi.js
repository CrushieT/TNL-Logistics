import apiClient from '../../../services/api/client';
import { mapClientRecord } from '../clientMapping.mjs';

export { mapClientRecord };

/**
 * Client Management API Client
 */
export async function listClients(params = {}) {
  const queryParams = new URLSearchParams();

  if (params.page !== undefined) queryParams.append('page', params.page);
  if (params.size !== undefined) queryParams.append('size', params.size);
  if (params.search && params.search.trim()) queryParams.append('search', params.search.trim());
  if (params.active !== undefined && params.active !== 'ALL') {
    if (params.active === true || params.active === 'Active') {
      queryParams.append('active', 'true');
    } else if (params.active === false || params.active === 'Inactive') {
      queryParams.append('active', 'false');
    }
  }
  if (params.all) queryParams.append('all', 'true');

  const queryString = queryParams.toString();
  const url = `/clients${queryString ? `?${queryString}` : ''}`;

  const { data } = await apiClient.get(url);

  // If response is a Spring Data Page object
  if (data && data.content && Array.isArray(data.content)) {
    return {
      content: data.content.map(mapClientRecord),
      totalElements: data.totalElements,
      totalPages: data.totalPages,
      number: data.number,
      size: data.size,
    };
  }

  // If response is a flat array
  if (Array.isArray(data)) {
    return data.map(mapClientRecord);
  }

  return [];
}

export async function getClient(clientId) {
  const { data } = await apiClient.get(`/clients/${clientId}`);
  return data;
}

export async function createClient(clientData) {
  const payload = {
    name: clientData.name,
    address: clientData.address,
    contactNumber: clientData.contactNumber,
    email: clientData.email || null,
    defaultRateType: clientData.defaultRateType || 'FLAT',
    ratePerKilo: clientData.ratePerKilo !== undefined ? clientData.ratePerKilo : null,
    active: clientData.active !== undefined ? clientData.active : true,
  };
  const { data } = await apiClient.post('/clients', payload);
  return mapClientRecord(data);
}

export async function updateClient(clientId, clientData) {
  const payload = {
    name: clientData.name,
    address: clientData.address,
    contactNumber: clientData.contactNumber,
    email: clientData.email || null,
    defaultRateType: clientData.defaultRateType || 'FLAT',
    ratePerKilo: clientData.ratePerKilo !== undefined ? clientData.ratePerKilo : null,
    active: clientData.active !== undefined ? clientData.active : true,
  };
  const { data } = await apiClient.put(`/clients/${clientId}`, payload);
  return mapClientRecord(data);
}

export async function updateClientRatePerKilo(clientId, ratePerKilo) {
  await apiClient.put(`/clients/${clientId}/rate-per-kilo`, {
    ratePerKilo,
  });
}

export async function deleteClient(clientId) {
  const { data } = await apiClient.delete(`/clients/${clientId}`);
  return data;
}
