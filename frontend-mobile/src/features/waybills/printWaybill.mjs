import { generateQRMatrix, generateQRSvgPath } from '../../utils/qr.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

export function getWaybillQrPayload(waybillId) {
  return `WAYBILL:${String(waybillId ?? '')}`;
}

function buildWaybillQrMarkup(waybillId) {
  const payload = getWaybillQrPayload(waybillId);
  const { path, totalSize } = generateQRSvgPath(generateQRMatrix(payload), 4);
  return `<div class="return-qr"><small>RETURN CONFIRMATION QR</small><svg viewBox="0 0 ${totalSize} ${totalSize}" role="img" aria-label="${escapeHtml(payload)}"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg></div>`;
}

export const WAYBILL_ITEMS_PER_PAGE = 15;
export const WAYBILL_PRINT_COPY_COUNT = 2;

export function paginateWaybillParcels(parcels = []) {
  if (!Array.isArray(parcels) || parcels.length === 0) {
    return [[]];
  }
  const pages = [];
  for (let i = 0; i < parcels.length; i += WAYBILL_ITEMS_PER_PAGE) {
    pages.push(parcels.slice(i, i + WAYBILL_ITEMS_PER_PAGE));
  }
  return pages;
}

export function createWaybillPrintSheetSequence(paginatedPages, copies = WAYBILL_PRINT_COPY_COUNT) {
  const pages = Array.isArray(paginatedPages) && paginatedPages.length > 0 ? paginatedPages : [[]];
  const copyCount = Math.max(1, Number.isInteger(copies) ? copies : 1);

  return Array.from({ length: copyCount }, (_, copyIndex) => (
    pages.map((pageItems, pageIndex) => ({
      copyIndex,
      pageIndex,
      pageNumber: pageIndex + 1,
      totalPages: pages.length,
      isFirstPage: pageIndex === 0,
      isLastPage: pageIndex === pages.length - 1,
      pageItems,
    }))
  )).flat();
}

export function buildWaybillHtml(manifest, logoUri, branding = null, copies = WAYBILL_PRINT_COPY_COUNT) {
  if (!manifest?.waybillId || !Array.isArray(manifest.parcels) || manifest.parcels.length === 0) {
    throw new Error('A generated waybill with manifest units is required');
  }

  const brand = branding || manifest;
  const companyName = escapeHtml((brand?.companyName || 'TC & CT INTEGRATED LOGISTICS').toUpperCase());
  const companySubtext = `${escapeHtml(brand?.companyAddress || 'Manila Central Hub')} | ${escapeHtml(brand?.companyContact || '0917-555-0000')} | ${escapeHtml(brand?.billingEmail || 'billing@tcct.ph')}`;
  const logo = logoUri ? `<img src="${escapeHtml(logoUri)}" alt="${companyName}" onerror="this.style.display='none'"/>` : '';
  const returnQr = buildWaybillQrMarkup(manifest.waybillId);

  const paginatedPages = paginateWaybillParcels(manifest.parcels);
  const printSheets = createWaybillPrintSheetSequence(paginatedPages, copies);
  const totalQuantity = manifest.totalQuantity || manifest.parcels.length;

  const sheetsHtml = printSheets.map(({ pageIndex, pageNumber, totalPages, isLastPage, pageItems }) => {
    const rows = pageItems.map((parcel, idx) => {
      const overallIndex = pageIndex * WAYBILL_ITEMS_PER_PAGE + idx;
      const seq = parcel.seq ?? parcel.packageIndex ?? (overallIndex + 1);
      const total = parcel.packageCount ?? totalQuantity;
      const packageDisplay = parcel.packageNumber || `${seq} of ${total}`;
      const weightDisplay = parcel.weightKg !== undefined && parcel.weightKg !== null && parcel.weightKg !== ''
        ? `${Number(parcel.weightKg).toFixed(1)} kg`
        : '2.5 kg';
      return `<tr><td>${escapeHtml(parcel.trackingId)}</td><td>${escapeHtml(packageDisplay)}</td><td>${escapeHtml(manifest.description || 'General Cargo')}</td><td>${escapeHtml(weightDisplay)}</td></tr>`;
    }).join('');

    return `<section class="copy">
      <div>
        <div class="letterhead">
          ${logo ? `<div class="logo-wrap">${logo}</div>` : `<div class="logo-fallback"><strong>LOGISTICS</strong></div>`}
          <div class="company-name">${companyName}</div>
          <div class="company-subtext">${companySubtext}</div>
        </div>
        <div class="letterhead-divider"></div>
        <div class="meta-row">
          <div class="meta-col">
            <h1>WAYBILL</h1>
            <p class="meta-line"><span class="meta-label">Waybill No. </span><span class="meta-mono">${escapeHtml(manifest.waybillId)}</span></p>
            <p class="meta-line"><span class="meta-label">Shipment No. </span><span class="meta-mono">${escapeHtml(manifest.shipmentId)}</span></p>
            <p class="meta-line"><span class="meta-label">Date: </span><span class="meta-val">${escapeHtml(manifest.generatedDate)}</span></p>
          </div>
          ${returnQr}
          <div class="delivery-col">
            <small>DELIVER TO / CONSIGNEE</small>
            <b>${escapeHtml(manifest.recipientName)}</b>
            <p class="consignee-addr">${escapeHtml(manifest.recipientAddress)}</p>
            ${manifest.recipientContact ? `<div class="consignee-meta"><span class="meta-item"><span class="meta-label">Contact: </span><b>${escapeHtml(manifest.recipientContact)}</b></span></div>` : ''}
          </div>
        </div>
        <div class="solid-divider"></div>
        <table><thead><tr><th>Tracking ID</th><th>Package</th><th>Contents</th><th>Weight</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
      <div>
        ${isLastPage ? `<footer><div>RELEASED BY<br><b>${escapeHtml(manifest.releasedByAdminName || 'Hauler Staff')}</b><hr>Signature</div><div>CLIENT SIGNATURE AND PRINTED NAME<br><b>${escapeHtml(manifest.signedBy)}</b><hr>Date: ${escapeHtml(manifest.signedDate || '________________')}</div></footer>` : ''}
        <div class="page-footnote"><span>Waybill ${escapeHtml(manifest.waybillId || manifest.shipmentId)} | Manifest for ${escapeHtml(manifest.recipientName || 'Consignee')}</span><span>Page ${pageNumber} of ${totalPages}</span></div>
      </div>
    </section>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title></title><style>
    @page { size: A4 portrait; margin: 0; }
    body { margin: 0; padding: 0; font: 13px Arial, sans-serif; color: #111; }
    .copy { padding: 12mm; box-sizing: border-box; break-after: page; page-break-after: always; min-height: 297mm; display: flex; flex-direction: column; justify-content: space-between; }
    .copy:last-child { break-after: auto; page-break-after: auto; }
    .letterhead { text-align: center; margin-bottom: 2.5mm; }
    .letterhead .logo-wrap img { max-height: 13mm; max-width: 40mm; object-fit: contain; margin: 0 auto 1.5mm auto; display: block; }
    .logo-fallback { width: 40mm; height: 13mm; border: 2px solid #111; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5mm auto; font-weight: 900; font-size: 14px; }
    .company-name { font-size: 18px; font-weight: 900; letter-spacing: 0.8px; text-transform: uppercase; color: #111; }
    .company-subtext { font-size: 11px; color: #555; margin-top: 1mm; }
    .letterhead-divider { border-top: 1px solid #ddd; margin: 2mm 0; }
    .meta-row { display: flex; justify-content: space-between; align-items: flex-start; padding-top: 2.5mm; margin-top: 2.5mm; }
    .meta-col { flex: 1; min-width: 0; padding-right: 4mm; text-align: left; }
    .meta-col h1 { margin: 0 0 1.5mm 0; font-size: 17px; font-weight: 900; letter-spacing: 0.5px; }
    .meta-line { margin: 1.2mm 0; font-size: 12px; }
    .meta-label { color: #555; }
    .meta-val { font-weight: bold; color: #111; }
    .meta-mono { font-family: monospace; font-size: 16px; font-weight: 900; color: #111; }
    .return-qr { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 1mm; font-size: 9.5px; padding: 0 4mm; text-align: center; }
    .return-qr svg { width: 23mm; height: 23mm; shape-rendering: crispEdges; }
    .delivery-col { flex: 1; min-width: 0; padding-left: 4mm; text-align: right; }
    .delivery-col small { font-size: 11px; font-weight: bold; letter-spacing: 0.8px; color: #666; display: block; margin-bottom: 1.5mm; text-align: right; }
    .delivery-col b { font-size: 16px; display: block; color: #111; text-align: right; }
    .delivery-col .consignee-addr { margin: 1.5mm 0; font-size: 13px; color: #222; text-align: right; }
    .consignee-meta { display: flex; gap: 8mm; margin-top: 1.5mm; font-size: 12px; justify-content: flex-end; }
    .consignee-meta .meta-label { color: #555; }
    .consignee-meta b { display: inline; font-size: 12px; }
    .solid-divider { border-top: 1.5px solid #111; margin: 3.5mm 0 2.5mm 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 2.5mm; }
    thead { display: table-header-group; }
    tr, footer { break-inside: avoid; page-break-inside: avoid; }
    th, td { padding: 3mm 3.5mm; border-bottom: 1px solid #ddd; text-align: left; }
    th { border-bottom: 1.5px solid #111; font-family: monospace; font-size: 13.5px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px; }
    td { font-size: 14px; }
    footer { display: flex; justify-content: space-between; margin-top: 6mm; }
    footer div { width: 45%; font-size: 12px; }
    footer hr { margin-top: 10mm; border: 0; border-top: 1px solid #111; }
    .page-footnote { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #E1DFD5; padding-top: 2mm; margin-top: 4mm; font-size: 11px; color: #888; }
  </style></head><body>${sheetsHtml}</body></html>`;
}
