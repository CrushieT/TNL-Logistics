import apiClient from '../../../services/api/client';

/**
 * Users / Staff Management API Client
 */
export async function listUsers({ role = 'all', status = 'all', page = 0, size = 20 } = {}) {
  const { data } = await apiClient.get('/users', { params: { role, status, page, size } });
  return data;
}

export async function getUser(userId) {
  const { data } = await apiClient.get(`/users/${userId}`);
  return data;
}

export async function createUser(payload) {
  const { data } = await apiClient.post('/users', payload);
  return data;
}

export async function updateUser(userId, payload) {
  const { data } = await apiClient.put(`/users/${userId}`, payload);
  return data;
}

export async function deleteUser(userId) {
  const { data } = await apiClient.delete(`/users/${userId}`);
  return data;
}

export async function resetPassword(userId, newPassword) {
  const { data } = await apiClient.put(`/users/${userId}/reset-password`, { newPassword });
  return data;
}

export async function resetPin(userId, pin, clearPin = false) {
  const payload = clearPin ? { clearPin: true } : { pin, clearPin: false };
  const { data } = await apiClient.put(`/users/${userId}/reset-pin`, payload);
  return data;
}
