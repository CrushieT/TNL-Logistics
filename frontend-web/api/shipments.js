import apiClient from './client';

export async function getDashboardSummary() {
  try {
    const { data } = await apiClient.get('/dashboard/summary');
    return data;
  } catch (err) {
    // If backend doesn't have dashboard summary endpoint yet, return mock for UI
    return null;
  }
}

export async function listShipments(params = {}) {
  const { data } = await apiClient.get('/shipments', { params });
  return data;
}

export async function getShipment(shipmentId) {
  const { data } = await apiClient.get(`/shipments/${shipmentId}`);
  return data;
}

export async function registerShipment(payload) {
  const qty = parseInt(payload.quantity, 10) || 1;
  const weight = parseFloat(payload.weightPerUnit) || 1.0;

  const parcels = Array.from({ length: qty }, (_, i) => ({
    seq: i + 1,
    weightKg: weight,
    lengthCm: 20.0,
    heightCm: 15.0,
    widthCm: 10.0,
  }));

  const backendRequest = {
    clientId: payload.clientId,
    recipientName: payload.recipient?.fullName || payload.recipientName || '',
    recipientAddress: payload.recipient?.address || payload.recipientAddress || '',
    recipientContact: payload.recipient?.contactNumber || payload.recipientContact || '',
    description: payload.description || 'General Goods',
    quantity: qty,
    chargeModel: payload.chargeModel === 'PER_UNIT' ? 'PER_PARCEL' : (payload.chargeModel || 'FLAT'),
    shippingFee: parseFloat(payload.shippingFee) || 0,
    otherCharges: parseFloat(payload.otherCharges) || 0,
    paidAtRegistration: Boolean(payload.paidAtRegistration),
    route: payload.route || 'Manila → TNL Baguio',
    registeredVia: 'DESKTOP_OFFICE',
    parcels,
  };

  const { data } = await apiClient.post('/shipments', backendRequest);

  // Return mapped structure for the result view
  return {
    shipmentId: data.shipmentId,
    recipient: data.recipientName,
    recipientDetails: payload.recipient,
    client: payload.clientName || data.clientId,
    quantity: data.trackingIds ? data.trackingIds.length : qty,
    chargeModel: backendRequest.chargeModel === 'PER_PARCEL' ? 'Per unit' : 'Flat',
    totalAmount: data.totalAmount,
    description: payload.description,
    route: payload.route,
    units: (data.trackingIds || []).map((tid, idx) => ({
      trackingId: tid,
      packageIndex: idx + 1,
      packageCount: data.trackingIds.length,
      labelStatus: 'Pending',
    })),
  };
}

export async function getParcelUnit(trackingId) {
  const { data } = await apiClient.get(`/parcel-units/${trackingId}`);
  return data;
}

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

export async function printLabels(shipmentId, packageIds) {
  const { data } = await apiClient.post(`/shipments/${shipmentId}/labels/print`, {
    packageIds,
  });
  return data;
}

export async function listTrackingLogs(params = {}) {
  const { data } = await apiClient.get('/tracking-logs', { params });
  return data;
}
