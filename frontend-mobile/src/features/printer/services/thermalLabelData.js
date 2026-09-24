export class IncompleteLabelDataError extends Error {
  constructor(missingFields) {
    super(`Label data is incomplete: ${missingFields.join(', ')}`);
    this.name = 'IncompleteLabelDataError';
    this.missingFields = missingFields;
  }
}

export async function resolveCurrentLabelBranding(loadBranding) {
  const branding = await loadBranding();
  if (typeof branding?.companyName !== 'string' || !branding.companyName.trim()) {
    throw new Error('Company branding could not be verified for label printing.');
  }
  return branding;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalText(value) {
  const cleaned = cleanText(value);
  return cleaned || null;
}

function finiteNumber(value, fieldName) {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new TypeError(`${fieldName} must be a finite number`);
  }
  return numberValue;
}

export function normalizeLabelData(shipment, unit, unitIndex = 0, totalUnits = 1) {
  const sourceShipment = shipment || {};
  const sourceUnit = unit || {};
  const recipientDetails = sourceShipment.recipientDetails || {};

  const trackingId = cleanText(sourceUnit.trackingId);
  const shipmentId = cleanText(sourceShipment.shipmentId);
  const recipientName = cleanText(recipientDetails.fullName);
  const address = cleanText(recipientDetails.address);
  const destinationHub = cleanText(sourceShipment.destination);

  const requiredFields = { trackingId, shipmentId, recipientName, address, destinationHub };
  const missingFields = Object.entries(requiredFields)
    .filter(([, value]) => !value)
    .map(([fieldName]) => fieldName);
  if (missingFields.length > 0) throw new IncompleteLabelDataError(missingFields);

  const packageIndex = finiteNumber(sourceUnit.packageIndex ?? sourceUnit.seq ?? unitIndex + 1, 'packageIndex');
  const packageCount = finiteNumber(sourceShipment.units?.length ?? sourceShipment.quantity ?? totalUnits, 'packageCount');
  const totalAmount = finiteNumber(sourceShipment.totalAmount, 'totalAmount');

  return {
    trackingId,
    shipmentId,
    packageIndex,
    packageCount,
    recipientName,
    contactNumber: optionalText(recipientDetails.contactNumber),
    address,
    destinationHub,
    contents: optionalText(sourceUnit.description ?? sourceShipment.description),
    clientName: optionalText(
      typeof sourceShipment.client === 'string' ? sourceShipment.client : sourceShipment.client?.name
    ),
    route: optionalText(sourceShipment.route),
    totalAmount,
    weightKg: finiteNumber(sourceUnit.weightKg, 'weightKg'),
  };
}
