/**
 * Pure JavaScript ESC/POS Binary Command Formatter for 58mm/80mm Thermal Printers.
 * Implements standard Epson/Brother ESC/POS command specifications.
 */

import { generateQRMatrix, generateQRSvgPath } from '../../../utils/qr.js';
import { resolveCurrentLabelBranding } from './thermalLabelData.js';

// Command constants
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatFiniteNumber(value, fieldName, options = {}) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) throw new TypeError(`${fieldName} must be a finite number`);
  return numericValue.toLocaleString('en-PH', options);
}

export function buildEscPosCommands(labelData, branding = null) {
  const bytes = [];
  const companyName = (
    typeof branding === 'string'
      ? branding.trim()
      : branding?.companyName?.trim()
  ) || 'TNL LOGISTICS';

  function append(...cmdBytes) {
    bytes.push(...cmdBytes);
  }

  function appendText(str) {
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      // Strip unicode characters outside standard ASCII for thermal print stream
      bytes.push(code < 128 ? code : 0x20);
    }
  }

  function appendLine(str = '') {
    appendText(str);
    append(LF);
  }

  // 1. Initialize printer
  append(ESC, 0x40); // ESC @
  append(ESC, 0x74, 0x00); // ESC t 0 (Standard ASCII / CP437)

  // 2. Header: Dynamic Brand Title & Package Index
  append(ESC, 0x61, 0x01); // Center align
  append(ESC, 0x45, 0x01); // Bold ON
  append(GS, 0x21, 0x11); // Double width & height
  appendLine(companyName.toUpperCase());
  append(GS, 0x21, 0x00); // Normal text
  append(ESC, 0x45, 0x00); // Bold OFF

  append(ESC, 0x61, 0x01); // Center align
  appendLine(`PKG ${labelData.packageIndex} / ${labelData.packageCount}  |  SCAN TO TRACK`);
  appendLine('--------------------------------');

  // 3. QR Code (ESC/POS 2D Barcode Model 2)
  const qrData = labelData.trackingId;
  const qrLen = qrData.length + 3;
  const pL = qrLen & 0xff;
  const pH = (qrLen >> 8) & 0xff;

  append(ESC, 0x61, 0x01); // Center align
  // Set QR Model 2
  append(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
  // Set QR Module Size (Module size 6 for 2-inch/3-inch rolls)
  append(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06);
  // Set QR Error Correction Level M (0x31 = 49)
  append(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
  // Store QR Data
  append(GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30);
  appendText(qrData);
  // Print QR Code
  append(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
  append(LF);

  // 4. Tracking ID & Consignee Details
  append(ESC, 0x61, 0x00); // Left align
  append(ESC, 0x45, 0x01); // Bold ON
  appendLine(`TRK: ${labelData.trackingId}`);
  append(ESC, 0x45, 0x00); // Bold OFF

  appendLine(`TO:  ${labelData.recipientName}`);
  if (labelData.contactNumber) {
    appendLine(`TEL: ${labelData.contactNumber}`);
  }
  if (labelData.address) {
    appendLine(`ADR: ${labelData.address}`);
  }
  appendLine(`HUB: ${labelData.destinationHub}`);
  appendLine('--------------------------------');

  // 5. Footer Metadata
  if (labelData.contents) appendLine(`CONTENTS: ${labelData.contents}`);
  appendLine(`SHIPMENT: ${labelData.shipmentId}`);
  if (labelData.clientName) appendLine(`CLIENT:   ${labelData.clientName}`);
  if (labelData.route) appendLine(`ROUTE:    ${labelData.route}`);
  if (labelData.totalAmount !== null && labelData.totalAmount !== undefined) {
    append(ESC, 0x61, 0x02); // Right align
    append(ESC, 0x45, 0x01); // Bold ON
    appendLine(`TOTAL: PHP ${formatFiniteNumber(labelData.totalAmount, 'totalAmount', { maximumFractionDigits: 2 })}`);
    append(ESC, 0x45, 0x00); // Bold OFF
  }

  // 6. Paper Feed & Cut
  append(ESC, 0x64, 0x03); // Feed 3 lines
  append(GS, 0x56, 0x00); // Cut paper (Full cut)

  return new Uint8Array(bytes);
}

/**
 * Builds a clean, high-contrast HTML document formatted as 1/4 A4 (4" x 6" / A6)
 * shipping labels matching prototype qr print.png. Supports single label or multiple
 * parcel units with CSS page breaks for window.print() or PDF export.
 */
export function buildLabelHtml(labelOrLabels, branding = null) {
  const labels = Array.isArray(labelOrLabels) ? labelOrLabels : [labelOrLabels];
  if (labels.length === 0) throw new TypeError('At least one label is required');

  const resolvedName = (
    typeof branding === 'string'
      ? branding.trim()
      : branding?.companyName?.trim()
  ) || 'TNL LOGISTICS';

  const brandTitle = escapeHtml(resolvedName.toUpperCase());
  const badgeLetter = escapeHtml(resolvedName.charAt(0).toUpperCase() || 'T');
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
    const destinationHub = escapeHtml(label.destinationHub);
    const contents = escapeHtml(label.contents);
    const shipmentId = escapeHtml(label.shipmentId);
    const clientName = escapeHtml(label.clientName);
    const route = escapeHtml(label.route);
    const formattedTotal = label.totalAmount === null || label.totalAmount === undefined
      ? null
      : formatFiniteNumber(label.totalAmount, 'totalAmount', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    return `  <div class="label-card">
    <div class="header">
      <div class="brand">
        <div class="brand-badge">${badgeLetter}</div>
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
        <div class="hub">to ${destinationHub}</div>
      </div>
    </div>
    <div class="footer">
      <div class="footer-row">
        ${contents ? `<div><span class="muted">Contents:</span> ${contents}</div>` : '<div></div>'}
        <div><span class="muted">Shipment:</span> ${shipmentId}</div>
      </div>
      <div class="footer-row">
        ${clientName ? `<div><span class="muted">Client:</span> ${clientName}</div>` : '<div></div>'}
        ${route ? `<div><span class="muted">Route:</span> ${route}</div>` : '<div></div>'}
      </div>
      ${formattedTotal !== null ? `<div class="total-row"><span class="muted">Total:</span> PHP ${formattedTotal}</div>` : ''}
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
      size: 100mm 150mm;
      margin: 0;
    }
    body {
      margin: 0;
      padding: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif;
      background: #FFFFFF;
      color: #111111;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .label-card {
      width: 100%;
      max-width: 360px;
      border: 2px solid #000000;
      padding: 16px;
      box-sizing: border-box;
      background: #FFFFFF;
      margin-bottom: 24px;
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
    .brand-badge {
      width: 22px;
      height: 22px;
      background: #000000;
      color: #FFFFFF;
      font-weight: 900;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      border-radius: 2px;
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
      gap: 16px;
      align-items: center;
      margin-bottom: 12px;
    }
    .qr-box {
      flex-shrink: 0;
      width: 120px;
      height: 120px;
      border: 1px solid #E5E7EB;
      padding: 4px;
      box-sizing: border-box;
    }
    .meta {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .tracking-id {
      font-family: monospace;
      font-size: 15px;
      font-weight: 800;
      color: #000000;
    }
    .recipient {
      font-size: 13px;
      font-weight: 800;
      color: #111111;
    }
    .contact, .address, .hub {
      font-size: 11px;
      color: #444444;
      line-height: 14px;
    }
    .hub {
      font-weight: 700;
      color: #000000;
      margin-top: 2px;
    }
    .footer {
      border-top: 1.5px dashed #666666;
      padding-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .footer-row {
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
    }
    .muted {
      color: #666666;
    }
    .total-row {
      text-align: right;
      font-size: 12px;
      font-weight: 900;
      margin-top: 4px;
    }
    @media print {
      body {
        padding: 0;
        background: transparent;
      }
      .label-card {
        margin-bottom: 0;
        page-break-after: always;
        break-after: page;
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

export async function prepareVerifiedLabelPrint(labelOrLabels, loadBranding) {
  const branding = await resolveCurrentLabelBranding(loadBranding);
  return { branding, html: buildLabelHtml(labelOrLabels, branding) };
}
