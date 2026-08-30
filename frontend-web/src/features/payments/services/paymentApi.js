import apiClient from '../../../services/api/client';

/**
 * Fetch paginated shipments with financial rollups for payment management.
 * @param {Object} params - { search, paymentStatus, page, size }
 */
export async function listPaymentShipments(params = {}) {
  const { data } = await apiClient.get('/shipments', { params });
  return data;
}

/**
 * Record a payment against an outstanding shipment.
 * @param {Object} payload - { shipmentId, amount, method, referenceNumber, paymentDate, remarks }
 */
export async function recordPayment(payload) {
  const { data } = await apiClient.post('/payments', payload);
  return data;
}

/**
 * Retrieve itemized payment records and balance history for a shipment.
 * @param {string} shipmentId
 */
export async function getShipmentPaymentHistory(shipmentId) {
  const { data } = await apiClient.get(`/payments/shipment/${shipmentId}`);
  return data;
}

/**
 * Fetch company-wide paginated payment audit directory.
 * @param {Object} params - { search, method, startDate, endDate, page, size }
 */
export async function listRecordedPayments(params = {}) {
  const { data } = await apiClient.get('/payments', { params });
  return data;
}
