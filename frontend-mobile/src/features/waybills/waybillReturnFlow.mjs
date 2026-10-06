export const WAYBILL_QR_PREFIX = 'TNL-WAYBILL:';

const WAYBILL_ID_PATTERN = /^WYB-[0-9]{4}-[0-9]{4,11}$/;

export function parseWaybillQrPayload(rawValue) {
  if (typeof rawValue !== 'string' || !rawValue.startsWith(WAYBILL_QR_PREFIX)) {
    return { isValid: false, waybillId: null };
  }

  const waybillId = rawValue.slice(WAYBILL_QR_PREFIX.length);
  if (!WAYBILL_ID_PATTERN.test(waybillId)) {
    return { isValid: false, waybillId: null };
  }

  return { isValid: true, waybillId };
}

export function isWaybillCompletionUnlocked(manifest, confirmedWaybillId) {
  return Boolean(
    manifest?.status === 'SENT_TO_HAULER'
      && manifest.waybillId
      && manifest.waybillId === confirmedWaybillId
  );
}

export function doesWaybillQrMatchOpenManifest(manifest, scannedWaybillId) {
  return !manifest?.waybillId || manifest.waybillId === scannedWaybillId;
}
