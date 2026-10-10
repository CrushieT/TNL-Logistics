import { calculateFixedMetrics, calculateParcelTotals, parsePositiveDecimal } from './fixedPointPricing.mjs';

export const MAX_PARCELS = 1000;

export function createRegistrationForm() {
  return {
    clientMode: 'EXISTING',
    clientId: '',
    clientName: '',
    newClientName: '',
    newClientAddress: '',
    newClientContact: '',
    newClientEmail: '',
    recipientAddress: '',
    recipientContact: '',
    description: '',
    quantity: '1',
    weightKg: '',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    route: 'Manila to TNL Labo C.N.',
    chargeModel: 'PER_KILO',
    otherCharges: '0',
    paidAtRegistration: false,
    parcels: [
      { id: 'unit-1', seq: 1, weightKg: '', lengthCm: '', widthCm: '', heightCm: '' },
    ],
  };
}

function isDecimal(value, minimum, integerDigits) {
  const text = String(value ?? '').trim();
  return new RegExp(`^\\d{1,${integerDigits}}(?:\\.\\d{1,2})?$`).test(text)
    && Number(text) >= minimum;
}

function hasPerUnitParcels(form) {
  if (!Array.isArray(form?.parcels) || form.parcels.length === 0) {
    return false;
  }
  if (form.parcels.length > 1) {
    return true;
  }
  const first = form.parcels[0];
  const firstHasValues = Boolean(first.weightKg || first.lengthCm || first.widthCm || first.heightCm);
  if (firstHasValues) {
    return true;
  }
  const hasLegacyTopLevel = Boolean(form.weightKg || form.lengthCm || form.widthCm || form.heightCm);
  return !hasLegacyTopLevel;
}

export function validateRegistration(form) {
  const errors = {};

  // 1. Client validation
  if (form.clientMode === 'NEW') {
    const lengths = {
      newClientName: [2, 150, 'Client name'],
      newClientAddress: [2, 255, 'Billing address'],
      newClientContact: [7, 11, 'Contact number'],
    };
    for (const [field, [minimum, maximum, label]] of Object.entries(lengths)) {
      const length = (form[field] || '').trim().length;
      if (length < minimum || length > maximum) {
        errors[field] = `${label} must be ${minimum}–${maximum} characters.`;
      }
    }
    if (form.newClientContact && form.newClientContact.trim() && !/^\d+$/.test(form.newClientContact.trim())) {
      errors.newClientContact = 'Contact number must contain digits only.';
    }
    const email = (form.newClientEmail || '').trim();
    if (email && (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      errors.newClientEmail = 'Enter a valid email address (up to 150 characters).';
    }
  } else {
    if (!form.clientId) {
      errors.clientId = 'Select a billing client.';
    }

    // 2. Recipient details
    if (!form.recipientAddress || !form.recipientAddress.trim()) {
      errors.recipientAddress = 'Complete address is required.';
    } else if (form.recipientAddress.trim().length > 255) {
      errors.recipientAddress = 'Complete address cannot exceed 255 characters.';
    }

    if (!form.recipientContact || !form.recipientContact.trim()) {
      errors.recipientContact = 'Contact number is required.';
    } else if (!/^\d+$/.test(form.recipientContact.trim())) {
      errors.recipientContact = 'Contact number must contain digits only.';
    } else if (form.recipientContact.trim().length < 7) {
      errors.recipientContact = 'Enter a contact number with at least 7 characters.';
    } else if (form.recipientContact.trim().length > 11) {
      errors.recipientContact = 'Contact number cannot exceed 11 characters.';
    }
  }

  // 3. Shipment metadata
  if (form.description && form.description.trim().length > 255) {
    errors.description = 'Description cannot exceed 255 characters.';
  }
  if (form.route && form.route.trim().length > 150) {
    errors.route = 'Route cannot exceed 150 characters.';
  }

  // 4. Quantity
  const qtyStr = String(form.quantity ?? '').trim();
  const qtyNum = Number(qtyStr);
  if (!/^\d+$/.test(qtyStr) || qtyNum < 1 || qtyNum > MAX_PARCELS) {
    errors.quantity = `Enter a whole number from 1 to ${MAX_PARCELS}.`;
  }

  // 5. Parcels measurements
  if (hasPerUnitParcels(form)) {
    if (Number.isInteger(qtyNum) && qtyNum >= 1 && form.parcels.length !== qtyNum) {
      errors.quantity = `Parcel count (${form.parcels.length}) does not match quantity (${qtyNum}).`;
    }
    form.parcels.forEach((parcel, index) => {
      if (!isDecimal(parcel.weightKg, 0.01, 6)) {
        errors[`parcels[${index}].weightKg`] = 'Minimum 0.01; up to 6 digits and 2 decimal places.';
        if (index === 0 && form.weightKg !== undefined) {
          errors.weightKg = 'Minimum 0.01; up to 6 digits and 2 decimal places.';
        }
      }
      for (const dim of ['lengthCm', 'widthCm', 'heightCm']) {
        if (!isDecimal(parcel[dim], 0.1, 6)) {
          errors[`parcels[${index}].${dim}`] = 'Minimum 0.1; up to 6 digits and 2 decimal places.';
          if (index === 0 && form[dim] !== undefined) {
            errors[dim] = 'Minimum 0.1; up to 6 digits and 2 decimal places.';
          }
        }
      }
    });
  } else {
    // Legacy single-spec model
    for (const field of ['weightKg', 'lengthCm', 'widthCm', 'heightCm']) {
      const minimum = field === 'weightKg' ? 0.01 : 0.1;
      if (!isDecimal(form[field], minimum, 6)) {
        errors[field] = `Minimum ${minimum}; up to 6 digits and 2 decimal places.`;
      }
    }
  }

  // 6. Charges
  if (form.otherCharges !== undefined && form.otherCharges !== null) {
    if (!isDecimal(form.otherCharges, 0, 10)) {
      errors.otherCharges = 'Enter a nonnegative amount, up to 10 digits and 2 decimal places.';
    }
  }

  if (form.chargeModel && !['FLAT', 'PER_PARCEL', 'PER_KILO'].includes(form.chargeModel)) {
    errors.chargeModel = 'Choose a charge model.';
  }

  return errors;
}

export function toCents(value) {
  if (!isDecimal(value, 0, 10)) return null;
  const [whole, fraction = ''] = String(value).trim().split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function calculateRegistration(form, divisor, ratePerKilo = null) {
  const quantityText = String(form?.quantity ?? '').trim();
  const quantity = /^\d+$/.test(quantityText) && Number(quantityText) >= 1 && Number(quantityText) <= MAX_PARCELS
    ? Number(quantityText) : null;
  const validDivisor = typeof divisor === 'number' && Number.isFinite(divisor) && divisor > 0 ? divisor : null;
  const isPerUnit = hasPerUnitParcels(form);
  let metrics;
  if (isPerUnit) {
    const isValid = form.parcels.every(parcel => isDecimal(parcel.weightKg, 0.01, 6)
      && ['lengthCm', 'widthCm', 'heightCm'].every(field => isDecimal(parcel[field], 0.1, 6)));
    const totals = isValid ? calculateParcelTotals(form.parcels) : null;
    if (!totals) {
      return { totalCents: null, totalAmount: null, shippingFee: null, unitVolume: null,
        totalVolume: null, actualWeight: null, volumetricWeight: null, billableWeight: null,
        ratePerKilo: parsePositiveDecimal(ratePerKilo) === null ? null : Number(ratePerKilo) };
    }
    metrics = calculateFixedMetrics(totals.actualUnits, totals.volumeUnits, validDivisor, ratePerKilo, form.parcels.length, true, form.otherCharges ?? '0');
  } else {
    const hasDimensions = ['lengthCm', 'widthCm', 'heightCm'].every(field => isDecimal(form?.[field], 0.1, 6));
    const unitVolume = hasDimensions
      ? ['lengthCm', 'widthCm', 'heightCm'].reduce((product, field) => product * parsePositiveDecimal(form[field]), 1n) : null;
    const totalVolume = unitVolume === null || quantity === null ? null : unitVolume * BigInt(quantity);
    const actualWeight = isDecimal(form?.weightKg, 0.01, 6) && quantity !== null
      ? parsePositiveDecimal(form.weightKg) * BigInt(quantity) : null;
    metrics = calculateFixedMetrics(actualWeight, totalVolume, validDivisor, ratePerKilo, quantity, false, form?.otherCharges ?? '0');
    metrics.unitVolume = unitVolume === null ? null : Number(unitVolume) / 1e18;
  }

  let totalCents = null;
  if (metrics.shippingFee !== null) {
    totalCents = metrics.totalCents;
  } else {
    const fee = toCents(form?.shippingFee);
    const other = toCents(form?.otherCharges ?? '0');
    if (fee !== null && quantity !== null && (isPerUnit || other !== null)) {
      totalCents = Number(BigInt(fee) * BigInt(form?.chargeModel === 'PER_PARCEL' ? quantity : 1) + BigInt(other ?? 0));
      metrics.shippingFee = fee / 100;
    }
  }
  return { ...metrics, totalCents, totalAmount: totalCents === null ? null : totalCents / 100 };
}

export function buildShipmentRequest(form, clientId = form.clientId, guards = {}) {
  const recipientAddress = (form.clientMode === 'NEW' ? form.newClientAddress : (form.recipientAddress || form.newClientAddress || '')).trim();
  const recipientContact = (form.clientMode === 'NEW' ? form.newClientContact : (form.recipientContact || form.newClientContact || '')).trim();
  const recipientName = (form.recipientName || form.clientName || form.newClientName || '').trim();

  const errors = validateRegistration({
    ...form,
    clientMode: 'EXISTING',
    clientId,
    recipientAddress,
    recipientContact,
  });
  if (Object.keys(errors).length) throw new Error('Shipment fields are invalid.');

  const parcels = hasPerUnitParcels(form)
    ? form.parcels.map((parcel, index) => ({
        seq: parcel.seq || (index + 1),
        weightKg: Number(parcel.weightKg),
        lengthCm: Number(parcel.lengthCm),
        widthCm: Number(parcel.widthCm),
        heightCm: Number(parcel.heightCm),
      }))
    : Array.from({ length: Number(form.quantity) }, (_, index) => ({
        seq: index + 1,
        weightKg: Number(form.weightKg),
        lengthCm: Number(form.lengthCm),
        widthCm: Number(form.widthCm),
        heightCm: Number(form.heightCm),
      }));

  const request = {
    clientId,
    recipientName: recipientName || undefined,
    recipientAddress,
    recipientContact,
    description: (form.description || '').trim() || 'General Goods',
    quantity: Number(form.quantity),
    route: (form.route || '').trim() || 'Manila to TNL Baguio',
    chargeModel: (hasPerUnitParcels(form) && (!form.chargeModel || form.chargeModel === 'FLAT')) ? 'PER_KILO' : (form.chargeModel || 'PER_KILO'),
    otherCharges: toCents(form.otherCharges ?? '0') / 100,
    paidAtRegistration: Boolean(form.paidAtRegistration),
    registeredVia: 'MOBILE_FIELD',
    parcels,
  };

  const expectedRate = guards.expectedRatePerKilo !== undefined ? guards.expectedRatePerKilo : form.expectedRatePerKilo;
  if (expectedRate !== undefined && expectedRate !== null) {
    request.expectedRatePerKilo = Number(expectedRate);
  }

  const expectedDivisor = guards.expectedVolumetricDivisor !== undefined ? guards.expectedVolumetricDivisor : form.expectedVolumetricDivisor;
  if (expectedDivisor !== undefined && expectedDivisor !== null) {
    request.expectedVolumetricDivisor = Number(expectedDivisor);
  }

  return request;
}

export function mapRegistrationErrors(error, preserveIndexed = false) {
  const aliases = error.registrationStage === 'client'
    ? { name: 'newClientName', address: 'newClientAddress', contactNumber: 'newClientContact', email: 'newClientEmail' }
    : {};
  return Object.fromEntries(Object.entries(error.response?.data?.fieldErrors || {}).map(([field, message]) => [
    aliases[field] || (preserveIndexed ? field : field.replace(/^parcels\[\d+\]\./, '')), message,
  ]));
}

export function isUncertainWrite(error) {
  return !error.response || error.response.status >= 500;
}

export function createShipmentSubmitter(api, isActive = () => true) {
  let isSubmitting = false;
  let createdClient = null;
  let createdClientKey = null;
  return async function submitRegistration(form, onClientCreated = () => {}, guards = {}) {
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
          contactNumber: form.newClientContact.trim(), email: (form.newClientEmail || '').trim() || null,
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
      const shipment = await api.registerShipment(buildShipmentRequest(form, clientId, guards));
      return isActive() ? { ...shipment, clientName } : null;
    } catch (error) {
      error.registrationStage = stage;
      throw error;
    } finally {
      isSubmitting = false;
    }
  };
}
