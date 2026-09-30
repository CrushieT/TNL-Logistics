const MAX_QUANTITY = 1000;

function parsePositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function calculateShipmentMetrics({
  quantity,
  weightPerUnit,
  lengthCm,
  widthCm,
  heightCm,
}, volumetricDivisor) {
  const parsedQuantity = /^\d+$/.test(String(quantity).trim())
    && Number(quantity) >= 1
    && Number(quantity) <= MAX_QUANTITY
    ? Number(quantity)
    : null;
  const parsedWeight = parsePositiveNumber(weightPerUnit);
  const parsedLength = parsePositiveNumber(lengthCm);
  const parsedWidth = parsePositiveNumber(widthCm);
  const parsedHeight = parsePositiveNumber(heightCm);
  const hasDimensions = parsedLength !== null && parsedWidth !== null && parsedHeight !== null;

  const unitVolumeCm3 = hasDimensions
    ? parsedLength * parsedWidth * parsedHeight
    : null;
  const totalVolumeCm3 = unitVolumeCm3 !== null && parsedQuantity !== null
    ? unitVolumeCm3 * parsedQuantity
    : null;
  const actualWeight = parsedWeight !== null && parsedQuantity !== null
    ? parsedWeight * parsedQuantity
    : null;
  const volumetricWeight = totalVolumeCm3 !== null
    && Number.isFinite(volumetricDivisor)
    && volumetricDivisor > 0
    ? Math.round((totalVolumeCm3 / volumetricDivisor + Number.EPSILON) * 100) / 100
    : null;

  return {
    unitVolume: unitVolumeCm3 === null ? null : unitVolumeCm3 / 1000000,
    totalVolume: totalVolumeCm3 === null ? null : totalVolumeCm3 / 1000000,
    actualWeight,
    volumetricWeight,
    billableWeight: actualWeight === null || volumetricWeight === null
      ? null
      : Math.max(actualWeight, volumetricWeight),
  };
}
