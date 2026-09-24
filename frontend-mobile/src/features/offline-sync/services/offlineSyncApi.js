import { apiClient } from '../../../services/api/client';

export async function submitOfflineSync(items) {
  const { data } = await apiClient.post('/tracking-events/offline-sync', { items }, { sensitivePayload: true });
  return data;
}
