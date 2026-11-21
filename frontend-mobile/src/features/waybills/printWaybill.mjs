import { generateQRMatrix, generateQRSvgPath } from '../../utils/qr.js';
import { WAYBILL_LOGO_BASE64 } from './waybillLogo.mjs';

export { WAYBILL_LOGO_BASE64 };

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

export function computeParcelBillableWeight(parcel, divisor = 5000) {
  const actual = Number(parcel?.weightKg) || 0;
  let volumetric = 0;
  const safeDivisor = Number(divisor) > 0 ? Number(divisor) : 5000;

  if (parcel?.volumeCbm != null && Number(parcel.volumeCbm) > 0) {
    volumetric = (Number(parcel.volumeCbm) * 1000000) / safeDivisor;
  } else if (parcel?.lengthCm != null && parcel?.widthCm != null && parcel?.heightCm != null) {
    volumetric = (Number(parcel.lengthCm) * Number(parcel.widthCm) * Number(parcel.heightCm)) / safeDivisor;
  }

  const maxWeight = Math.max(actual, volumetric);
  return Math.round(maxWeight * 10) / 10;
}

export function groupParcelsByBillableWeight(parcels = [], totalQuantity = 0, divisor = 5000) {
  if (!Array.isArray(parcels) || parcels.length === 0) {
    return { rows: [], totalBoxes: 0, totalBillable: 0, lostCount: 0 };
  }

  const groups = new Map();
  let lostCount = 0;

  for (const parcel of parcels) {
    if (parcel?.lost) {
      lostCount += 1;
      continue;
    }
    const bw = computeParcelBillableWeight(parcel, divisor);
    const key = bw.toFixed(1);
    if (!groups.has(key)) {
      groups.set(key, { billableWeight: bw, boxes: 0, indices: [] });
    }
    const group = groups.get(key);
    group.boxes += 1;
    const idx = parcel?.packageIndex ?? parcel?.seq ?? null;
    if (idx != null) {
      group.indices.push(Number(idx));
    }
  }

  const sortedGroups = [...groups.values()].sort((a, b) => b.billableWeight - a.billableWeight);
  const total = totalQuantity || parcels.length;

  const rows = sortedGroups.map((group) => {
    const sortedIndices = [...group.indices].sort((a, b) => a - b);
    let rangeLabel = '';
    if (sortedIndices.length === 1) {
      rangeLabel = `Package ${sortedIndices[0]} of ${total}`;
    } else if (sortedIndices.length > 1) {
      const min = sortedIndices[0];
      const max = sortedIndices[sortedIndices.length - 1];
      const isContiguous = sortedIndices.length === (max - min + 1);
      if (isContiguous) {
        rangeLabel = `Package ${min}–${max} of ${total}`;
      } else {
        const joined = sortedIndices.join(', ');
        if (sortedIndices.length <= 3 && joined.length <= 12) {
          rangeLabel = `Package ${joined} of ${total}`;
        } else {
          rangeLabel = `Various (${group.boxes} of ${total})`;
        }
      }
    } else {
      rangeLabel = `${group.boxes} Box${group.boxes > 1 ? 'es' : ''} of ${total}`;
    }
    return {
      rangeLabel,
      boxes: group.boxes,
      billableWeight: group.billableWeight,
    };
  });

  const totalBoxes = rows.reduce((sum, r) => sum + r.boxes, 0);
  const totalBillable = rows.reduce((sum, r) => sum + (r.billableWeight * r.boxes), 0);

  return { rows, totalBoxes, totalBillable, lostCount };
}

export function paginateGroups(rows = [], itemsPerPage = WAYBILL_ITEMS_PER_PAGE) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [[]];
  }
  const pages = [];
  for (let i = 0; i < rows.length; i += itemsPerPage) {
    pages.push(rows.slice(i, i + itemsPerPage));
  }
  return pages;
}

export const paginateWaybillParcels = paginateGroups;

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

  const divisor = manifest.appliedVolumetricDivisor ?? 5000;
  const totalQuantity = manifest.totalQuantity || manifest.parcels.length;
  const grouped = groupParcelsByBillableWeight(manifest.parcels, totalQuantity, divisor);
  const paginatedPages = paginateGroups(grouped.rows);
  const printSheets = createWaybillPrintSheetSequence(paginatedPages, copies);

  const sheetsHtml = printSheets.map(({ copyIndex, pageIndex, pageNumber, totalPages, isLastPage, pageItems }) => {
    const midpoint = Math.ceil(pageItems.length / 2);
    const leftItems = pageItems.slice(0, midpoint);
    const rightItems = pageItems.slice(midpoint);

    const renderColumnTable = (columnItems, isRightColumn = false) => {
      const rows = columnItems.map((group) => (
        `<tr><td class="td-pkg-range">${escapeHtml(group.rangeLabel)}</td><td class="td-boxes">${group.boxes}</td><td class="td-bw">${group.billableWeight.toFixed(1)} kg</td></tr>`
      )).join('');

      return `<table class="manifest-table${isRightColumn && columnItems.length === 0 ? ' empty-col' : ''}"><thead><tr><th class="th-pkg-range">Packages</th><th class="th-boxes">Boxes</th><th class="th-bw">Billable Wt.</th></tr></thead><tbody>${rows}</tbody></table>`;
    };

    const leftTable = renderColumnTable(leftItems, false);
    const rightTable = renderColumnTable(rightItems, true);

    const summaryRowHtml = isLastPage ? `<div class="summary-row">
      <span><span class="summary-label">Total Boxes: </span><b class="summary-val">${grouped.totalBoxes}</b></span>
      <span><span class="summary-label">Total Billable: </span><b class="summary-val">${grouped.totalBillable.toFixed(1)} kg</b></span>
      ${grouped.lostCount > 0 ? `<span><span class="summary-label lost-label">Lost: </span><b class="lost-val">${grouped.lostCount}</b></span>` : ''}
      <span><span class="summary-label">Truck: </span><b class="summary-val">${escapeHtml(manifest.vehiclePlate || manifest.truckPlate || '—')}</b></span>
    </div>` : '';

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
        ${summaryRowHtml}
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
    .th-pkg-range, .td-pkg-range { width: 52%; font-family: monospace; font-weight: bold; font-size: 10.5px; }
    .th-boxes, .td-boxes { width: 20%; text-align: center; font-weight: bold; font-size: 10.5px; }
    .th-bw, .td-bw { width: 28%; text-align: right; font-family: monospace; font-weight: bold; font-size: 10.5px; }
    .summary-row { display: flex; justify-content: space-between; padding: 2mm 0; border-top: 1px solid #E1DFD5; border-bottom: 1px solid #E1DFD5; margin: 3mm 0 1.5mm 0; font-size: 11px; }
    .summary-label { color: #555; }
    .summary-val { font-weight: bold; color: #111; }
    .lost-label { color: #c00; font-weight: bold; }
    .lost-val { color: #c00; font-weight: bold; }
    footer { display: flex; justify-content: space-between; margin-top: 4mm; }
    footer div { width: 45%; font-size: 11px; }
    footer hr { margin-top: 7mm; border: 0; border-top: 1px solid #111; }
    .page-footnote { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #E1DFD5; padding-top: 1.5mm; margin-top: 3mm; font-size: 10px; color: #888; }
  </style></head><body>${sheetsHtml}</body></html>`;
}

export const buildWaybillPrintHtml = buildWaybillHtml;
