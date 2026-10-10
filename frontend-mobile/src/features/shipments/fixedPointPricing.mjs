const DECIMAL_SCALE = 10000n;
const VOLUME_SCALE = DECIMAL_SCALE ** 3n;

export function parseDecimal(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,4})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * DECIMAL_SCALE + BigInt(fraction.padEnd(4, '0'));
}

export function parsePositiveDecimal(value) {
  const units = parseDecimal(value);
  return units !== null && units > 0n ? units : null;
}

function roundHalfUp(numerator, denominator) {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

export function calculateParcelTotals(parcels) {
  let actualUnits = 0n;
  let volumeUnits = 0n;
  for (const parcel of parcels) {
    const weight = parsePositiveDecimal(parcel.weightKg);
    const length = parsePositiveDecimal(parcel.lengthCm);
    const width = parsePositiveDecimal(parcel.widthCm);
    const height = parsePositiveDecimal(parcel.heightCm);
    if ([weight, length, width, height].includes(null)) return null;
    actualUnits += weight;
    volumeUnits += length * width * height;
  }
  return { actualUnits, volumeUnits };
}

export function calculateFixedMetrics(actualUnits, volumeUnits, divisor, rate, quantity = 1, shouldRoundVolume = false, otherCharges) {
  const divisorUnits = parsePositiveDecimal(divisor);
  const rateUnits = parsePositiveDecimal(rate);
  const actualCents = actualUnits === null ? null : roundHalfUp(actualUnits * 100n, DECIMAL_SCALE);
  const volumetricCents = volumeUnits === null || divisorUnits === null
    ? null : roundHalfUp(volumeUnits * 100n * DECIMAL_SCALE, VOLUME_SCALE * divisorUnits);
  const billableCents = actualCents === null || volumetricCents === null
    ? null : (actualCents > volumetricCents ? actualCents : volumetricCents);
  const feeCents = billableCents === null || rateUnits === null
    ? null : roundHalfUp(billableCents * rateUnits, DECIMAL_SCALE);
  const totalVolume = volumeUnits === null ? null : (shouldRoundVolume
    ? Number(roundHalfUp(volumeUnits, VOLUME_SCALE * 100n)) / 10000
    : Number(volumeUnits) / Number(VOLUME_SCALE * 1000000n));
  const otherUnits = parseDecimal(otherCharges) ?? 0n;
  const totalCents = feeCents === null ? null : Number(feeCents + roundHalfUp(otherUnits, 100n));
  return {
    ...(otherCharges === undefined ? {} : { totalCents, totalAmount: totalCents === null ? null : totalCents / 100 }),
    unitVolume: volumeUnits === null || quantity !== 1 ? null : Number(volumeUnits) / Number(VOLUME_SCALE * 1000000n),
    totalVolume,
    actualWeight: actualCents === null ? null : Number(actualCents) / 100,
    volumetricWeight: volumetricCents === null ? null : Number(volumetricCents) / 100,
    billableWeight: billableCents === null ? null : Number(billableCents) / 100,
    shippingFee: feeCents === null ? null : Number(feeCents) / 100,
    ratePerKilo: rateUnits === null ? null : Number(rateUnits) / Number(DECIMAL_SCALE),
  };
}

export function calculateTotalCents(shippingFee, otherCharges) {
  const feeUnits = parseDecimal(shippingFee) ?? 0n;
  const otherUnits = parseDecimal(otherCharges) ?? 0n;
  return Number(roundHalfUp(feeUnits, 100n) + roundHalfUp(otherUnits, 100n));
}

