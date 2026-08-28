import apiClient from '../../../services/api/client';

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
    active: clientData.active !== undefined ? clientData.active : true,
  };
  const { data } = await apiClient.put(`/clients/${clientId}`, payload);
  return mapClientRecord(data);
}

export async function deleteClient(clientId) {
  const { data } = await apiClient.delete(`/clients/${clientId}`);
  return data;
}

function mapClientRecord(c) {
  if (!c) return null;
  const id = c.clientId || c.id || 'CL-001';
  return {
    id,
    clientId: id,
    code: id,
    name: c.name,
    address: c.address,
    contactNumber: c.contactNumber,
    email: c.email,
    defaultRateType: c.defaultRateType || 'FLAT',
    active: c.active !== undefined ? c.active : true,
    dateRegistered: c.dateRegistered,
    totalShipments: c.totalShipments !== undefined ? c.totalShipments : 0,
    totalParcels: c.totalParcels !== undefined ? c.totalParcels : 0,
    totalCharges: c.totalCharges !== undefined ? c.totalCharges : 0,
    totalPaid: c.totalPaid !== undefined ? c.totalPaid : 0,
    outstandingBalance: c.outstandingBalance !== undefined ? c.outstandingBalance : 0,
  };
}

