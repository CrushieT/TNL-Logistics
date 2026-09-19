/**
 * Normalizes shipment and parcel unit data into structured fields matching prototype qr print.png.
 */

export function normalizeLabelData(shipment = {}, unit = {}, unitIndex = 0, totalUnits = 1) {
  const trackingId = unit.trackingId || unit.id || shipment.trackingId || 'TRK-2026-000101';
  const packageIndex = unit.packageIndex || unitIndex + 1;
  const packageCount = shipment.units?.length || shipment.quantity || totalUnits || 1;

  const recipientName = shipment.recipientName || unit.recipientName || 'Juan Dela Cruz';
  const contactNumber = shipment.recipientContact || shipment.contactNumber || unit.recipientContact || '';
  const address = shipment.recipientAddress || shipment.address || unit.recipientAddress || '';
  const destinationHub = shipment.destinationHub || unit.destinationHub || 'TNL Baguio Hub';

  const contents = unit.description || shipment.description || shipment.contents || 'Assorted office supplies';
  const clientName = shipment.clientName || shipment.client?.companyName || shipment.clientId || 'Northbridge Trading';
  const shipmentId = shipment.shipmentId || 'SHP-2026-001';

  // Format origin and destination route
  const origin = shipment.origin || 'Manila';
  const destination = shipment.destinationHub || shipment.destination || 'TNL Baguio';
  const route = `${origin} to ${destination}`;

  const totalAmount = shipment.totalAmount || shipment.totalPrice || shipment.amount || 0;

  return {
    trackingId,
    packageIndex,
    packageCount,
    recipientName,
    contactNumber,
    address,
    destinationHub,
    contents,
    clientName,
    shipmentId,
    route,
    totalAmount: Number(totalAmount),
  };
}
