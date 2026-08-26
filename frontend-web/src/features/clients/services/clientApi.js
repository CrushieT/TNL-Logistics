import apiClient from '../../../services/api/client';

export async function listClients() {
  const { data } = await apiClient.get('/clients');
  return (data || []).map((c) => ({
    id: c.clientId || c.id,
    code: c.clientId || c.code || 'CL-001',
    name: c.name,
    address: c.address,
    contactNumber: c.contactNumber,
    email: c.email,
  }));
}

export async function createClient(clientData) {
  const { data } = await apiClient.post('/clients', clientData);
  return {
    id: data.clientId || data.id,
    code: data.clientId || data.code,
    name: data.name,
    address: data.address,
    contactNumber: data.contactNumber,
    email: data.email,
  };
}
