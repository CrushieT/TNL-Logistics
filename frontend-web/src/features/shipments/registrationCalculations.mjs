import { calculateFixedMetrics, calculateParcelTotals, parsePositiveDecimal } from './fixedPointPricing.mjs';

const MAX_QUANTITY = 1000;
const unavailableMetrics = () => ({
  unitVolume: null, totalVolume: null, actualWeight: null,
  volumetricWeight: null, billableWeight: null, shippingFee: null,
});

export function calculateShipmentMetrics(input, volumetricDivisor, ratePerKilo = null) {
  if (!input) return unavailableMetrics();
  if (Array.isArray(input.parcels) && input.parcels.length > 0) {
    const totals = calculateParcelTotals(input.parcels);
    if (!totals) return unavailableMetrics();
    return calculateFixedMetrics(totals.actualUnits, totals.volumeUnits, volumetricDivisor, ratePerKilo, input.parcels.length, true);
  }

  const quantity = /^\d+$/.test(String(input.quantity || '').trim())
    && Number(input.quantity) >= 1 && Number(input.quantity) <= MAX_QUANTITY
    ? Number(input.quantity) : null;
  const weight = parsePositiveDecimal(input.weightPerUnit);
  const dimensions = [input.lengthCm, input.widthCm, input.heightCm].map(parsePositiveDecimal);
  const unitVolume = dimensions.includes(null) ? null : dimensions.reduce((product, dimension) => product * dimension, 1n);
  const totalVolume = unitVolume === null || quantity === null ? null : unitVolume * BigInt(quantity);
  const actualWeight = weight === null || quantity === null ? null : weight * BigInt(quantity);
  const metrics = calculateFixedMetrics(actualWeight, totalVolume,
    Number.isFinite(volumetricDivisor) ? volumetricDivisor : null, ratePerKilo, quantity);
  return { ...metrics, unitVolume: unitVolume === null ? null : Number(unitVolume) / 1e18 };
}
