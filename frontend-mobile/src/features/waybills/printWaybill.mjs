import { generateQRMatrix, generateQRSvgPath } from '../../utils/qr.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

export function getWaybillQrPayload(waybillId) {
  return `TNL-WAYBILL:${String(waybillId ?? '')}`;
}

function buildWaybillQrMarkup(waybillId) {
  const payload = getWaybillQrPayload(waybillId);
  const { path, totalSize } = generateQRSvgPath(generateQRMatrix(payload), 4);
  return `<div class="return-qr"><small>RETURN CONFIRMATION QR</small><svg viewBox="0 0 ${totalSize} ${totalSize}" role="img" aria-label="${escapeHtml(payload)}"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg><b>${escapeHtml(payload)}</b></div>`;
}

export function buildWaybillHtml(manifest, logoUri) {
  if (!manifest?.waybillId || !Array.isArray(manifest.parcels) || manifest.parcels.length === 0) {
    throw new Error('A generated waybill with manifest units is required');
  }
  const rows = manifest.parcels.map((parcel) => `<tr><td>${escapeHtml(parcel.trackingId)}</td><td>${escapeHtml(parcel.seq)} of ${escapeHtml(manifest.totalQuantity)}</td><td>${escapeHtml(manifest.description)}</td><td>${escapeHtml(parcel.weightKg ?? '')} kg</td></tr>`).join('');
  const logo = logoUri ? `<img src="${escapeHtml(logoUri)}" alt="TNL Logistics" onerror="this.style.display='none'"/>` : '';
  const returnQr = buildWaybillQrMarkup(manifest.waybillId);
  const copy = `<section class="copy">
    <header><div class="brand">${logo}<strong>TNL LOGISTICS</strong></div><div class="document"><h1>WAYBILL</h1><b>${escapeHtml(manifest.waybillId)}</b><p>${escapeHtml(manifest.generatedDate)}</p></div>${returnQr}</header>
    <div class="parties"><div><small>SHIPPER / CLIENT</small><b>${escapeHtml(manifest.clientName)}</b><p>${escapeHtml(manifest.clientAddress)}</p></div><div><small>CONSIGNEE / DESTINATION</small><b>${escapeHtml(manifest.recipientName)}</b><p>${escapeHtml(manifest.recipientAddress)}</p></div></div>
    <p>Shipment: ${escapeHtml(manifest.shipmentId)} &nbsp; Hauler: ${escapeHtml(manifest.haulerName)} &nbsp; Units: ${manifest.parcels.length}</p>
    <table><thead><tr><th>Tracking ID</th><th>Package</th><th>Contents</th><th>Weight</th></tr></thead><tbody>${rows}</tbody></table>
    <footer><div>RELEASED BY<br><b>${escapeHtml(manifest.releasedByAdminName || 'Hauler Staff')}</b><hr>Signature</div><div>CLIENT SIGNATURE AND PRINTED NAME<br><b>${escapeHtml(manifest.signedBy)}</b><hr>Date: ${escapeHtml(manifest.signedDate || '________________')}</div></footer>
  </section>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 12mm; }
    body { margin: 0; font: 11px Arial, sans-serif; color: #111; }
    .copy { break-after: page; page-break-after: always; }
    .copy:last-child { break-after: auto; page-break-after: auto; }
    header, .parties, footer { display: flex; justify-content: space-between; gap: 20mm; }
    header { align-items: center; border-bottom: 2px solid #111; padding-bottom: 5mm; }
    header .brand { display: flex; align-items: center; gap: 4mm; }
    header img { max-height: 15mm; max-width: 40mm; }
    header .document { text-align: right; }
    .return-qr { display: flex; flex-direction: column; align-items: center; gap: 1mm; font-size: 8px; }
    .return-qr svg { width: 25mm; height: 25mm; shape-rendering: crispEdges; }
    .return-qr b { font: 7px monospace; }
    h1 { margin: 0; font-size: 19px; }
    .parties { margin: 6mm 0; }
    .parties div, footer div { width: 45%; }
    .parties small, .parties b { display: block; }
    table { width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; }
    tr, footer { break-inside: avoid; page-break-inside: avoid; }
    th, td { padding: 3mm; border-bottom: 1px solid #bbb; text-align: left; }
    footer { margin-top: 10mm; }
    footer hr { margin-top: 8mm; }
  </style></head><body>${copy}${copy}</body></html>`;
}
