export const WAYBILL_QR_PREFIX = 'WAYBILL:';
export const LEGACY_WAYBILL_QR_PREFIX = 'TNL-WAYBILL:';

const WAYBILL_ID_PATTERN = /^WYB-[0-9]{4}-[0-9]{4,11}$/;

export function parseWaybillQrPayload(rawValue) {
  if (typeof rawValue !== 'string') {
    return { isValid: false, waybillId: null };
  }

  let waybillId = null;
  if (rawValue.startsWith(WAYBILL_QR_PREFIX)) {
    waybillId = rawValue.slice(WAYBILL_QR_PREFIX.length);
  } else if (rawValue.startsWith(LEGACY_WAYBILL_QR_PREFIX)) {
    waybillId = rawValue.slice(LEGACY_WAYBILL_QR_PREFIX.length);
  } else {
    return { isValid: false, waybillId: null };
  }

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
