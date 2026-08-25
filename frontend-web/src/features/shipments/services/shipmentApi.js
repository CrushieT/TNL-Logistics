import apiClient from '../../../services/api/client';

export async function getDashboardSummary() {
  try {
    const { data } = await apiClient.get('/dashboard/summary');
    return data;
  } catch (err) {
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

export async function getParcelUnit(trackingId) {
  const { data } = await apiClient.get(`/parcel-units/${trackingId}`);
  return data;
}

export async function printLabels(shipmentId, packageIds) {
  const { data } = await apiClient.post(`/shipments/${shipmentId}/labels/print`, {
    packageIds,
  });
  return data;
}

export async function registerShipment(payload) {
  const qty = parseInt(payload.quantity, 10) || 1;
  const weight = parseFloat(payload.weightPerUnit) || 1.0;
  const length = parseFloat(payload.lengthCm) || 20.0;
  const width = parseFloat(payload.widthCm) || 10.0;
  const height = parseFloat(payload.heightCm) || 15.0;

  const parcels = Array.from({ length: qty }, (_, i) => ({
    seq: i + 1,
    weightKg: weight,
    lengthCm: length,
    widthCm: width,
    heightCm: height,
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

  const unitVolumeCbm = (length * width * height) / 1000000;
  const totalVolumeCbm = unitVolumeCbm * qty;

  return {
    shipmentId: data.shipmentId,
    clientId: data.clientId,
    recipient: data.recipientName,
    recipientDetails: payload.recipient || {
      fullName: data.recipientName,
      address: backendRequest.recipientAddress,
      contactNumber: backendRequest.recipientContact,
    },
    client: payload.clientName || data.clientId,
    quantity: data.trackingIds ? data.trackingIds.length : qty,
    chargeModel: backendRequest.chargeModel === 'PER_PARCEL' ? 'Per unit' : 'Flat',
    shippingFee: backendRequest.shippingFee,
    otherCharges: backendRequest.otherCharges,
    totalAmount: data.totalAmount,
    paidAtRegistration: data.paidAtRegistration,
    description: backendRequest.description,
    route: backendRequest.route,
    weightPerUnit: weight,
    dimensions: { lengthCm: length, widthCm: width, heightCm: height },
    unitVolumeCbm,
    totalVolumeCbm,
    units: (data.trackingIds || []).map((tid, idx) => ({
      trackingId: tid,
      packageIndex: idx + 1,
      packageCount: data.trackingIds.length,
      labelStatus: 'Pending',
    })),
  };
}

export async function listTrackingLogs(params = {}) {
  const { data } = await apiClient.get('/tracking-logs', { params });
  return data;
}
