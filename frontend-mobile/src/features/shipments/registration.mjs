export const MAX_PARCELS = 1000;

export function createRegistrationForm() {
  return {
    clientMode: 'EXISTING', clientId: '', clientName: '',
    newClientName: '', newClientAddress: '', newClientContact: '', newClientEmail: '',
    recipientName: '', recipientAddress: '', recipientContact: '', description: '',
    quantity: '1', weightKg: '', lengthCm: '', widthCm: '', heightCm: '',
    route: 'Manila to TNL Baguio', chargeModel: 'FLAT', shippingFee: '',
    otherCharges: '0', paidAtRegistration: false,
  };
}

function isDecimal(value, minimum, integerDigits) {
  const text = String(value).trim();
  return new RegExp(`^\\d{1,${integerDigits}}(?:\\.\\d{1,2})?$`).test(text)
    && Number(text) >= minimum;
}

export function validateRegistration(form) {
  const errors = {};
  if (form.clientMode === 'NEW') {
    const lengths = {
      newClientName: [2, 150, 'Client name'],
      newClientAddress: [2, 255, 'Billing address'],
      newClientContact: [7, 30, 'Contact number'],
    };
    for (const [field, [minimum, maximum, label]] of Object.entries(lengths)) {
      const length = form[field].trim().length;
      if (length < minimum || length > maximum) errors[field] = `${label} must be ${minimum}–${maximum} characters.`;
    }
    const email = form.newClientEmail.trim();
    if (email && (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      errors.newClientEmail = 'Enter a valid email address (up to 150 characters).';
    }
  } else if (!form.clientId) {
    errors.clientId = 'Select a billing client.';
  }
  for (const [field, label] of Object.entries({
    recipientName: 'Recipient name', recipientAddress: 'Complete address', recipientContact: 'Contact number',
  })) {
    if (!form[field].trim()) errors[field] = `${label} is required.`;
  }
  if (form.recipientContact.trim() && form.recipientContact.trim().length < 7) {
    errors.recipientContact = 'Enter a contact number with at least 7 characters.';
  }
  if (!/^\d+$/.test(form.quantity.trim()) || Number(form.quantity) < 1 || Number(form.quantity) > MAX_PARCELS) {
    errors.quantity = `Enter a whole number from 1 to ${MAX_PARCELS}.`;
  }
  for (const field of ['weightKg', 'lengthCm', 'widthCm', 'heightCm']) {
    const minimum = field === 'weightKg' ? 0.01 : 0.1;
    if (!isDecimal(form[field], minimum, 6)) errors[field] = `Minimum ${minimum}; up to 6 digits and 2 decimal places.`;
  }
  for (const field of ['shippingFee', 'otherCharges']) {
    if (!isDecimal(form[field], 0, 10)) errors[field] = 'Enter a nonnegative amount, up to 10 digits and 2 decimal places.';
  }
  if (!['FLAT', 'PER_PARCEL'].includes(form.chargeModel)) errors.chargeModel = 'Choose a charge model.';
  return errors;
}

export function toCents(value) {
  if (!isDecimal(value, 0, 10)) return null;
  const [whole, fraction = ''] = String(value).trim().split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function calculateRegistration(form, divisor) {
  const quantity = /^\d+$/.test(form.quantity.trim()) && Number(form.quantity) >= 1 && Number(form.quantity) <= MAX_PARCELS
    ? Number(form.quantity) : null;
  const fee = toCents(form.shippingFee);
  const other = toCents(form.otherCharges);
  const totalCents = fee !== null && other !== null && quantity !== null
    ? fee * (form.chargeModel === 'PER_PARCEL' ? quantity : 1) + other : null;
  const hasDimensions = ['lengthCm', 'widthCm', 'heightCm'].every((field) => isDecimal(form[field], 0.1, 6));
  const unitVolumeCm3 = hasDimensions ? Number(form.lengthCm) * Number(form.widthCm) * Number(form.heightCm) : null;
  const totalVolumeCm3 = unitVolumeCm3 !== null && quantity !== null ? unitVolumeCm3 * quantity : null;
  const actualWeight = isDecimal(form.weightKg, 0.01, 6) && quantity !== null ? Number(form.weightKg) * quantity : null;
  const volumetricWeight = totalVolumeCm3 !== null && Number.isFinite(divisor) && divisor > 0
    ? Math.round((totalVolumeCm3 / divisor + Number.EPSILON) * 100) / 100 : null;
  return {
    totalCents,
    unitVolume: unitVolumeCm3 === null ? null : unitVolumeCm3 / 1000000,
    totalVolume: totalVolumeCm3 === null ? null : totalVolumeCm3 / 1000000,
    actualWeight, volumetricWeight,
    billableWeight: actualWeight === null || volumetricWeight === null ? null : Math.max(actualWeight, volumetricWeight),
  };
}

export function buildShipmentRequest(form, clientId = form.clientId) {
  const errors = validateRegistration({ ...form, clientMode: 'EXISTING', clientId });
  if (Object.keys(errors).length) throw new Error('Shipment fields are invalid.');
  return {
    clientId, recipientName: form.recipientName.trim(), recipientAddress: form.recipientAddress.trim(),
    recipientContact: form.recipientContact.trim(), description: form.description.trim() || 'General Goods',
    quantity: Number(form.quantity), route: form.route.trim() || 'Manila to TNL Baguio',
    chargeModel: form.chargeModel, shippingFee: toCents(form.shippingFee) / 100,
    otherCharges: toCents(form.otherCharges) / 100, paidAtRegistration: form.paidAtRegistration,
    registeredVia: 'MOBILE_FIELD',
    parcels: Array.from({ length: Number(form.quantity) }, (_, index) => ({
      seq: index + 1, weightKg: Number(form.weightKg), lengthCm: Number(form.lengthCm),
      widthCm: Number(form.widthCm), heightCm: Number(form.heightCm),
    })),
  };
}

export function mapRegistrationErrors(error) {
  const aliases = error.registrationStage === 'client'
    ? { name: 'newClientName', address: 'newClientAddress', contactNumber: 'newClientContact', email: 'newClientEmail' }
    : {};
  return Object.fromEntries(Object.entries(error.response?.data?.fieldErrors || {}).map(([field, message]) => [
    aliases[field] || field.replace(/^parcels\[\d+\]\./, ''), message,
  ]));
}

export function isUncertainWrite(error) {
  return !error.response || error.response.status >= 500;
}

export function createShipmentSubmitter(api, isActive = () => true) {
  let isSubmitting = false;
  let createdClient = null;
  let createdClientKey = null;
  return async function submitRegistration(form, onClientCreated = () => {}) {
    if (isSubmitting || !isActive()) return null;
    if (Object.keys(validateRegistration(form)).length) throw new Error('Shipment fields are invalid.');
    isSubmitting = true;
    let stage = 'client';
    try {
      let clientId = form.clientId;
      let clientName = form.clientName;
      if (form.clientMode === 'NEW') {
        const clientRequest = {
          name: form.newClientName.trim(), address: form.newClientAddress.trim(),
          contactNumber: form.newClientContact.trim(), email: form.newClientEmail.trim() || null,
        };
        const key = JSON.stringify(clientRequest);
        if (!createdClient || createdClientKey !== key) {
          createdClient = await api.createClient(clientRequest);
          createdClientKey = key;
        }
        if (!isActive()) return null;
        clientId = createdClient.clientId;
        clientName = createdClient.name;
        onClientCreated(createdClient);
      }
      if (!isActive()) return null;
      stage = 'shipment';
      const shipment = await api.registerShipment(buildShipmentRequest(form, clientId));
      return isActive() ? { ...shipment, clientName } : null;
    } catch (error) {
      error.registrationStage = stage;
      throw error;
    } finally {
      isSubmitting = false;
    }
  };
}
