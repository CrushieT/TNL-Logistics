const MAX_QUANTITY = 1000;

function parsePositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function calculateShipmentMetrics(input, volumetricDivisor, ratePerKilo = null) {
  if (!input) {
    return {
      unitVolume: null,
      totalVolume: null,
      actualWeight: null,
      volumetricWeight: null,
      billableWeight: null,
      shippingFee: null,
    };
  }

  // Support per-unit parcels array
  if (Array.isArray(input.parcels) && input.parcels.length > 0) {
    let totalActualWeight = 0;
    let totalVolumeCm3 = 0;
    let allValid = true;

    for (const unit of input.parcels) {
      const weight = parsePositiveNumber(unit.weightKg);
      const l = parsePositiveNumber(unit.lengthCm);
      const w = parsePositiveNumber(unit.widthCm);
      const h = parsePositiveNumber(unit.heightCm);

      if (weight === null || l === null || w === null || h === null) {
        allValid = false;
        break;
      }
      totalActualWeight += weight;
      totalVolumeCm3 += (l * w * h);
    }

    if (!allValid) {
      return {
        unitVolume: null,
        totalVolume: null,
        actualWeight: null,
        volumetricWeight: null,
        billableWeight: null,
        shippingFee: null,
      };
    }

    const divisor = Number(volumetricDivisor);
    const volumetricWeight = Number.isFinite(divisor) && divisor > 0
      ? Math.round((totalVolumeCm3 / divisor + Number.EPSILON) * 100) / 100
      : null;
    const roundedActualWeight = Math.round((totalActualWeight + Number.EPSILON) * 100) / 100;
    const billableWeight = volumetricWeight !== null
      ? Math.round((Math.max(roundedActualWeight, volumetricWeight) + Number.EPSILON) * 100) / 100
      : null;

    const rate = parsePositiveNumber(ratePerKilo);
    const shippingFee = (billableWeight !== null && rate !== null)
      ? Math.round((billableWeight * rate + Number.EPSILON) * 100) / 100
      : null;

    return {
      unitVolume: input.parcels.length === 1 ? totalVolumeCm3 / 1000000 : null,
      totalVolume: Math.round((totalVolumeCm3 / 1000000 + Number.EPSILON) * 10000) / 10000,
      actualWeight: roundedActualWeight,
      volumetricWeight,
      billableWeight,
      shippingFee,
      ratePerKilo: rate,
    };
  }

  // Legacy single-spec model
  const parsedQuantity = /^\d+$/.test(String(input.quantity || '').trim())
    && Number(input.quantity) >= 1
    && Number(input.quantity) <= MAX_QUANTITY
    ? Number(input.quantity)
    : null;
  const parsedWeight = parsePositiveNumber(input.weightPerUnit);
  const parsedLength = parsePositiveNumber(input.lengthCm);
  const parsedWidth = parsePositiveNumber(input.widthCm);
  const parsedHeight = parsePositiveNumber(input.heightCm);
  const hasDimensions = parsedLength !== null && parsedWidth !== null && parsedHeight !== null;

  const unitVolumeCm3 = hasDimensions
    ? parsedLength * parsedWidth * parsedHeight
    : null;
  const totalVolumeCm3 = unitVolumeCm3 !== null && parsedQuantity !== null
    ? unitVolumeCm3 * parsedQuantity
    : null;
  const actualWeight = parsedWeight !== null && parsedQuantity !== null
    ? Math.round((parsedWeight * parsedQuantity + Number.EPSILON) * 100) / 100
    : null;
  const volumetricWeight = totalVolumeCm3 !== null
    && Number.isFinite(volumetricDivisor)
    && volumetricDivisor > 0
    ? Math.round((totalVolumeCm3 / volumetricDivisor + Number.EPSILON) * 100) / 100
    : null;
  const billableWeight = actualWeight === null || volumetricWeight === null
    ? null
    : Math.round((Math.max(actualWeight, volumetricWeight) + Number.EPSILON) * 100) / 100;

  const rate = parsePositiveNumber(ratePerKilo);
  const shippingFee = (billableWeight !== null && rate !== null)
    ? Math.round((billableWeight * rate + Number.EPSILON) * 100) / 100
    : null;

  return {
    unitVolume: unitVolumeCm3 === null ? null : unitVolumeCm3 / 1000000,
    totalVolume: totalVolumeCm3 === null ? null : totalVolumeCm3 / 1000000,
    actualWeight,
    volumetricWeight,
    billableWeight,
    shippingFee,
    ratePerKilo: rate,
  };
}
