import { generateQRMatrix, generateQRSvgPath } from '../../../utils/qr.js';

export class IncompleteLabelDataError extends Error {
  constructor(missingFields) {
    super(`Label data is incomplete: ${missingFields.join(', ')}`);
    this.name = 'IncompleteLabelDataError';
    this.missingFields = missingFields;
  }
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatFiniteNumber(value, fieldName, options = {}) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) throw new TypeError(`${fieldName} must be a finite number`);
  return numericValue.toLocaleString('en-PH', options);
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalText(value) {
  const cleaned = cleanText(value);
  return cleaned || null;
}

function finiteNumber(value, fieldName) {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new TypeError(`${fieldName} must be a finite number`);
  }
  return numberValue;
}

export function normalizeLabelData(shipment, unit, unitIndex = 0, totalUnits = 1) {
  const sourceShipment = shipment || {};
  const sourceUnit = unit || {};
  const recipientDetails = sourceShipment.recipientDetails || {};

  const trackingId = cleanText(sourceUnit.trackingId);
  const shipmentId = cleanText(sourceShipment.shipmentId);
  const recipientName = cleanText(recipientDetails.fullName || sourceShipment.recipient);
  const destinationHub = cleanText(sourceShipment.destination || sourceShipment.destinationHub);
  const address = cleanText(recipientDetails.address || sourceShipment.destinationAddress || sourceShipment.address) || destinationHub;

  const requiredFields = { trackingId, shipmentId, recipientName, destinationHub };
  const missingFields = Object.entries(requiredFields)
    .filter(([, value]) => !value)
    .map(([fieldName]) => fieldName);
  if (missingFields.length > 0) throw new IncompleteLabelDataError(missingFields);

  const countVal = sourceShipment.units?.length || sourceShipment.quantity || totalUnits;
  const packageIndex = finiteNumber(sourceUnit.packageIndex ?? sourceUnit.seq ?? unitIndex + 1, 'packageIndex');
  const packageCount = finiteNumber(sourceUnit.packageCount ?? countVal, 'packageCount');

  const totalAmount = finiteNumber(
    sourceShipment.pricing?.totalAmount ?? sourceShipment.totalAmount,
    'totalAmount'
  );

  const clientName = optionalText(
    typeof sourceShipment.client === 'string' ? sourceShipment.client : sourceShipment.client?.name
  );

  const route = optionalText(sourceShipment.route);

  return {
    trackingId,
    shipmentId,
    packageIndex,
    packageCount,
    recipientName,
    contactNumber: optionalText(recipientDetails.contactNumber || sourceShipment.contactNumber),
    address,
    destinationHub,
    contents: optionalText(sourceUnit.description ?? sourceShipment.description),
    clientName,
    route,
    totalAmount,
    weightKg: finiteNumber(sourceUnit.weightKg, 'weightKg'),
  };
}

export async function resolveCurrentLabelBranding(loadBranding) {
  const branding = await loadBranding();
  if (typeof branding?.companyName !== 'string' || !branding.companyName.trim()) {
    throw new Error('Company branding could not be verified for label printing.');
  }
  return branding;
}

export function buildLabelHtml(labelOrLabels, branding = null) {
  const labels = Array.isArray(labelOrLabels) ? labelOrLabels : [labelOrLabels];
  if (labels.length === 0) throw new TypeError('At least one label is required');

  const resolvedName = (
    typeof branding === 'string'
      ? branding.trim()
      : branding?.companyName?.trim()
  ) || 'TNL LOGISTICS';

  const brandTitle = escapeHtml(resolvedName.toUpperCase());
  const displayBrandInTitle = resolvedName === 'TNL LOGISTICS' ? 'TNL' : resolvedName;

  const primaryTitle = escapeHtml(labels.length === 1
    ? `${labels[0].trackingId} - ${displayBrandInTitle} Shipping Label`
    : `${labels[0].shipmentId} (${labels.length} Labels) - ${displayBrandInTitle} Shipping Labels`);

  const cardsHtml = labels.map((label) => {
    const matrix = generateQRMatrix(label.trackingId);
    const { path: svgPath, totalSize: svgSize } = generateQRSvgPath(matrix);
    const packageIndex = formatFiniteNumber(label.packageIndex, 'packageIndex', { maximumFractionDigits: 0 });
    const packageCount = formatFiniteNumber(label.packageCount, 'packageCount', { maximumFractionDigits: 0 });
    const trackingId = escapeHtml(label.trackingId);
    const recipientName = escapeHtml(label.recipientName);
    const contactNumber = escapeHtml(label.contactNumber);
    const address = escapeHtml(label.address);
    const contents = escapeHtml(label.contents);
    const shipmentId = escapeHtml(label.shipmentId);
    const route = escapeHtml(label.route);

    return `  <div class="label-card">
    <div class="header">
      <div class="brand">
        <div class="brand-title">${brandTitle}</div>
      </div>
      <div class="header-right">
        <div class="pkg-pill">PKG ${packageIndex} / ${packageCount}</div>
        <div class="scan-track">SCAN TO TRACK</div>
      </div>
    </div>
    <div class="body">
      <div class="qr-box">
        <svg viewBox="0 0 ${svgSize} ${svgSize}" width="100%" height="100%" style="shape-rendering: crispEdges;">
          <rect width="${svgSize}" height="${svgSize}" fill="#FFFFFF" />
          <path d="${svgPath}" fill="#000000" />
        </svg>
      </div>
      <div class="meta">
        <div class="tracking-id">${trackingId}</div>
        <div class="recipient">${recipientName}</div>
        ${contactNumber ? `<div class="contact">${contactNumber}</div>` : ''}
        ${address ? `<div class="address">${address}</div>` : ''}
        ${route ? `<div class="hub">${route}</div>` : ''}
      </div>
    </div>
    <div class="footer">
      <div class="footer-row">
        <div class="contents-field">${contents ? `<span class="muted">Notes:</span> ${contents}` : ''}</div>
      </div>
      <div class="footer-row">
        <div class="shipment-field"><span class="muted">Shipment:</span> ${shipmentId}</div>
      </div>
    </div>
  </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${primaryTitle}</title>
  <style>
    @page {
      size: 150mm 100mm;
      margin: 0;
    }
    * {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 10mm;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif;
      background: #FFFFFF;
      color: #111111;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .label-card {
      width: 100%;
      max-width: 540px;
      border: 3px solid #000000;
      padding: 20px;
      box-sizing: border-box;
      background: #FFFFFF;
      margin-bottom: 24px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #000000;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .brand-title {
      font-weight: 900;
      font-size: 14px;
      letter-spacing: 0.8px;
    }
    .header-right {
      text-align: right;
    }
    .pkg-pill {
      background: #000000;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 2px;
      display: inline-block;
      letter-spacing: 0.5px;
    }
    .scan-track {
      font-size: 8.5px;
      font-family: monospace;
      color: #666666;
      margin-top: 2px;
      letter-spacing: 0.5px;
    }
    .body {
      display: flex;
      gap: 20px;
      align-items: center;
      margin-bottom: 16px;
    }
    .qr-box {
      flex-shrink: 0;
      width: 150px;
      height: 150px;
      border: 1px solid #E5E7EB;
      padding: 4px;
      box-sizing: border-box;
      background: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .meta {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-width: 0;
      word-break: break-word;
    }
    .tracking-id {
      font-family: monospace;
      font-size: 18px;
      font-weight: 800;
      color: #000000;
      letter-spacing: 0.5px;
    }
    .recipient {
      font-size: 15px;
      font-weight: 800;
      color: #111111;
      line-height: 19px;
    }
    .contact, .address, .hub {
      font-size: 12px;
      color: #444444;
      line-height: 16px;
    }
    .hub {
      font-weight: 700;
      color: #000000;
      margin-top: 4px;
    }
    .footer {
      border-top: 2px dashed #000000;
      padding-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .footer-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      font-size: 11.5px;
    }
    .muted {
      color: #555555;
    }
    .contents-field {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .shipment-field {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    @media print {
      body {
        padding: 8px;
        background: transparent;
      }
      .label-card {
        width: 100%;
        max-width: 100%;
        margin: 0 auto;
        margin-bottom: 0;
        page-break-after: always;
        break-after: page;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .label-card:last-child {
        page-break-after: auto;
        break-after: auto;
      }
    }
  </style>
</head>
<body>
${cardsHtml}
</body>
</html>`;
}
