import { generateQRMatrix, generateQRSvgPath } from '../../utils/qr.js';
import { WAYBILL_LOGO_BASE64 } from './waybillLogo.mjs';

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

export const WAYBILL_ITEMS_PER_PAGE = 50;
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

export function buildWaybillHtml(manifest, logoUri = WAYBILL_LOGO_BASE64, branding = null, copies = WAYBILL_PRINT_COPY_COUNT) {
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

  const sheetsHtml = printSheets.map(({ copyIndex, pageIndex, pageNumber, totalPages, isLastPage, pageItems }) => {
    const midpoint = Math.ceil(pageItems.length / 2);
    const leftItems = pageItems.slice(0, midpoint);
    const rightItems = pageItems.slice(midpoint);

    const renderColumnTable = (columnItems, startOffset, isRightColumn = false) => {
      const rows = columnItems.map((parcel, idx) => {
        const overallIndex = pageIndex * WAYBILL_ITEMS_PER_PAGE + startOffset + idx;
        const seq = parcel.seq ?? parcel.packageIndex ?? (overallIndex + 1);
        const total = parcel.packageCount ?? totalQuantity;
        const packageDisplay = parcel.packageNumber || `${seq} of ${total}`;
        const weightDisplay = parcel.weightKg !== undefined && parcel.weightKg !== null && parcel.weightKg !== ''
          ? `${Number(parcel.weightKg).toFixed(1)} kg`
          : '2.5 kg';
        return `<tr><td class="td-tracking">${escapeHtml(parcel.trackingId)}${parcel.lost ? ' | LOST' : ''}</td><td class="td-pkg">${escapeHtml(packageDisplay)}</td><td class="td-weight">${escapeHtml(weightDisplay)}</td></tr>`;
      }).join('');

      return `<table class="manifest-table${isRightColumn && columnItems.length === 0 ? ' empty-col' : ''}"><thead><tr><th class="th-tracking">Tracking ID</th><th class="th-pkg">Package</th><th class="th-weight">Weight</th></tr></thead><tbody>${rows}</tbody></table>`;
    };

    const leftTable = renderColumnTable(leftItems, 0, false);
    const rightTable = renderColumnTable(rightItems, midpoint, true);

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
            <div class="copy-label${copyIndex === 0 ? '' : ' client-copy'}">${copyIndex === 0 ? 'ORIGINAL COPY' : 'CLIENT COPY'}</div>
            <p class="meta-line"><span class="meta-label">Waybill No. </span><span class="meta-mono">${escapeHtml(manifest.waybillId)}</span></p>
            <p class="meta-line"><span class="meta-label">Shipment No. </span><span class="meta-mono">${escapeHtml(manifest.shipmentId)}</span></p>
            <p class="meta-line"><span class="meta-label">Date: </span><span class="meta-val">${escapeHtml(manifest.generatedDate)}</span></p>
            <p class="meta-line"><span class="meta-label">Status: </span><span class="meta-val">${escapeHtml(manifest.statusLabel || '')}</span></p>
            <p class="meta-line"><span class="meta-label">Reconciliation: </span><span class="meta-val">Delivered: ${manifest.deliveredCount || 0} | Lost: ${manifest.lostCount || 0}</span></p>
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
        <div class="manifest-grid">
          ${leftTable}
          ${rightTable}
        </div>
      </div>
      <div class="bottom-block">
        ${isLastPage ? `<footer><div>RELEASED BY<br><b>${escapeHtml(manifest.releasedByAdminName || 'Hauler Staff')}</b><hr>Signature</div><div>CLIENT SIGNATURE AND PRINTED NAME<br><b>${escapeHtml(manifest.signedBy)}</b><hr>Date: ${escapeHtml(manifest.signedDate || '________________')}</div></footer>` : ''}
        <div class="page-footnote"><span>Waybill ${escapeHtml(manifest.waybillId || manifest.shipmentId)} | Manifest for ${escapeHtml(manifest.recipientName || 'Consignee')}</span><span>Page ${pageNumber} of ${totalPages}</span></div>
      </div>
    </section>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title></title><style>
    @page { size: A4 portrait; margin: 0; }
    body { margin: 0; padding: 0; font: 11.5px Arial, sans-serif; color: #111; }
    .copy { padding: 8mm 12mm 4mm 12mm; box-sizing: border-box; break-after: page; page-break-after: always; break-inside: avoid; page-break-inside: avoid; min-height: 278mm; max-height: 297mm; display: flex; flex-direction: column; justify-content: space-between; }
    .copy:last-child { break-after: auto; page-break-after: auto; }
    .letterhead { text-align: center; margin-bottom: 2mm; }
    .letterhead .logo-wrap img { max-height: 12mm; max-width: 38mm; object-fit: contain; margin: 0 auto 1mm auto; display: block; }
    .logo-fallback { width: 38mm; height: 12mm; border: 1.5px solid #111; display: flex; align-items: center; justify-content: center; margin: 0 auto 1mm auto; font-weight: 900; font-size: 13px; }
    .company-name { font-size: 16px; font-weight: 900; letter-spacing: 0.8px; text-transform: uppercase; color: #111; }
    .company-subtext { font-size: 10px; color: #555; margin-top: 0.8mm; }
    .letterhead-divider { border-top: 1px solid #ddd; margin: 1.5mm 0; }
    .meta-row { display: flex; justify-content: space-between; align-items: flex-start; padding-top: 1.5mm; margin-top: 1.5mm; }
    .meta-col { flex: 1; min-width: 0; padding-right: 3mm; text-align: left; }
    .meta-col h1 { margin: 0 0 1mm 0; font-size: 15px; font-weight: 900; letter-spacing: 0.5px; }
    .copy-label { display: inline-block; border: 1px solid #182b60; color: #182b60; padding: 0.8mm 1.8mm; margin-bottom: 1mm; font-size: 10.5px; font-weight: 700; line-height: 1; white-space: nowrap; }
    .copy-label.client-copy { border-color: #c94c12; color: #c94c12; }
    .meta-line { margin: 0.8mm 0; font-size: 11px; }
    .meta-label { color: #555; }
    .meta-val { font-weight: bold; color: #111; }
    .meta-mono { font-family: monospace; font-size: 14px; font-weight: 900; color: #111; }
    .return-qr { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 0.8mm; font-size: 8.5px; padding: 0 3mm; text-align: center; }
    .return-qr svg { width: 20mm; height: 20mm; shape-rendering: crispEdges; }
    .delivery-col { flex: 1; min-width: 0; padding-left: 3mm; text-align: right; }
    .delivery-col small { font-size: 10px; font-weight: bold; letter-spacing: 0.8px; color: #666; display: block; margin-bottom: 1mm; text-align: right; }
    .delivery-col b { font-size: 14px; display: block; color: #111; text-align: right; }
    .delivery-col .consignee-addr { margin: 1mm 0; font-size: 11.5px; color: #222; text-align: right; }
    .consignee-meta { display: flex; gap: 6mm; margin-top: 1mm; font-size: 11px; justify-content: flex-end; }
    .consignee-meta .meta-label { color: #555; }
    .consignee-meta b { display: inline; font-size: 11px; }
    .solid-divider { border-top: 1.5px solid #111; margin: 2mm 0 1.5mm 0; }
    .manifest-grid { display: flex; gap: 4mm; align-items: flex-start; width: 100%; margin-top: 1.5mm; }
    .manifest-table { flex: 1; min-width: 0; width: 49%; border-collapse: collapse; }
    .manifest-table.empty-col { visibility: hidden; }
    thead { display: table-header-group; }
    tr, footer, .bottom-block, .page-footnote { break-inside: avoid; page-break-inside: avoid; }
    th, td { padding: 1.4mm 2mm; border-bottom: 1px solid #ddd; text-align: left; }
    th { border-bottom: 1.5px solid #111; font-family: monospace; font-size: 10.5px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px; }
    td { font-size: 10.5px; }
    .th-tracking, .td-tracking { width: 52%; font-family: monospace; font-weight: bold; font-size: 10.5px; }
    .th-pkg, .td-pkg { width: 26%; font-size: 10.5px; }
    .th-weight, .td-weight { width: 22%; text-align: right; font-size: 10.5px; }
    .lost-tag { color: #c00; font-weight: bold; font-size: 9px; }
    footer { display: flex; justify-content: space-between; margin-top: 4mm; }
    footer div { width: 45%; font-size: 11px; }
    footer hr { margin-top: 7mm; border: 0; border-top: 1px solid #111; }
    .page-footnote { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #E1DFD5; padding-top: 1.5mm; margin-top: 3mm; font-size: 10px; color: #888; }
  </style></head><body>${sheetsHtml}</body></html>`;
}
