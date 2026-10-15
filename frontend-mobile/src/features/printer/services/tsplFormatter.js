/**
 * Pure JavaScript TSPL Command Generator for Xprinter XP-470B / XP-420B (203 DPI).
 * Matches the layout of .docs-private/prototype/prototype qr print.png
 *
 * True Landscape Waybill (Rotated 90 degrees across standard 100mm x 150mm sticker):
 * - Physical Feed: 100mm wide (800 dots), 150mm long (1200 dots).
 * - Rotated 90 degrees:
 *   - The 150mm length (Y: 0 to 1200) becomes the horizontal width of your waybill.
 *   - The 100mm width (X: 0 to 800) becomes the vertical height of your waybill.
 *   - When torn off, you hold the sticker sideways as a true wide landscape waybill!
 */

function cleanStr(val) {
  return String(val ?? '').replace(/["\r\n]/g, ' ').trim();
}

const FOOTER_FONTS = [
  { type: '3', width: 16, height: 24, lineHeight: 32 },
  { type: '2', width: 12, height: 20, lineHeight: 28 },
  { type: '1', width: 8, height: 12, lineHeight: 20 },
];

function wrapTextLines(text, maxCharacters) {
  const lines = [];
  let remainingText = text.replace(/\s+/g, ' ').trim();
  while (remainingText.length > maxCharacters) {
    const wordBoundary = remainingText.lastIndexOf(' ', maxCharacters);
    const nextWord = remainingText.slice(wordBoundary + 1).split(' ', 1)[0];
    const splitIndex = wordBoundary > 0 && nextWord.length <= maxCharacters ? wordBoundary : maxCharacters;
    lines.push(remainingText.slice(0, splitIndex));
    remainingText = remainingText.slice(splitIndex).trimStart();
  }
  if (remainingText) lines.push(remainingText);
  return lines;
}

function buildDashedDivider(x, startY, endY) {
  const dashLength = 12;
  const dividerLength = endY - startY;
  const dashCount = Math.ceil((dividerLength + dashLength) / (dashLength * 2));
  const dashSpacing = (dividerLength - dashLength) / (dashCount - 1);

  return Array.from({ length: dashCount }, (_, dashIndex) => ({
    x,
    y: Math.round(startY + dashIndex * dashSpacing),
    width: 2,
    height: dashLength,
  }));
}

/**
 * Builds the options payload for BluetoothTscPrinter.printLabel()
 * which calls the native TSPL driver to print directly to the XP-470B.
 */
export function buildTsplOptions(labelData, branding = null, options = {}) {
  const companyName = (
    typeof branding === 'string'
      ? branding.trim()
      : branding?.companyName?.trim()
  ) || 'TNL LOGISTICS';

  const brandTitle = companyName.toUpperCase().slice(0, 36);

  const widthMm = options.widthMm || 100;
  const heightMm = options.heightMm || 150;
  const gapMm = options.gapMm || 3;

  const trackingId = cleanStr(labelData.trackingId);
  const recipientName = cleanStr(labelData.recipientName);
  const contactNumber = cleanStr(labelData.contactNumber);
  const address = cleanStr(labelData.address);
  const contents = cleanStr(labelData.contents);
  const shipmentId = cleanStr(labelData.shipmentId);
  const clientName = cleanStr(labelData.clientName);
  const route = cleanStr(labelData.route);
  const packageIndex = labelData.packageIndex ?? 1;
  const packageCount = labelData.packageCount ?? 1;
  const totalAmount = labelData.totalAmount !== null && labelData.totalAmount !== undefined
    ? Number(labelData.totalAmount).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : null;

  // In 90-degree rotated mode on 203 DPI (8 dots/mm):
  // Physical Roll: 100mm wide (800 dots), 150mm feed length (1200 dots).
  // Rotated 90:
  // - X axis (0 to 800) represents vertical position on the landscape waybill.
  //   Top edge = X ~ 730, Bottom edge = X ~ 55.
  // - Y axis (0 to 1200) represents horizontal position across the landscape waybill.
  //   Left edge = Y ~ 65, Right edge = Y ~ 1135.

  const texts = [
    // --- HEADER (Top of landscape waybill) ---
    // Brand Name without T badge, large bold font 4
    { text: brandTitle, x: 695, y: 85, fonttype: '4', rotation: 90, xscal: 1, yscal: 1, bold: true },
    // Package Pill PKG X / Y in clean bold font 3
    { text: `PKG ${packageIndex} / ${packageCount}`, x: 695, y: 880, fonttype: '3', rotation: 90, xscal: 1, yscal: 1, bold: true },
    // Scan prompt
    { text: 'SCAN TO TRACK', x: 660, y: 880, fonttype: '2', rotation: 90, xscal: 1, yscal: 1, bold: false },

    // --- BODY: Right of QR (Tracking ID & Recipient Details - Large fonts) ---
    // Tracking ID in prominent bold font 4
    { text: trackingId, x: 575, y: 440, fonttype: '4', rotation: 90, xscal: 1, yscal: 1, bold: true },
    // Recipient Name in clear bold font 3
    { text: recipientName.slice(0, 30), x: 520, y: 440, fonttype: '3', rotation: 90, xscal: 1, yscal: 1, bold: true },
  ];

  if (contactNumber) {
    texts.push({ text: `Tel: ${contactNumber}`, x: 475, y: 440, fonttype: '3', rotation: 90, xscal: 1, yscal: 1, bold: false });
  }

  let hubX = 410;
  if (address) {
    const addressFont = FOOTER_FONTS.find((font) => {
      const lines = wrapTextLines(address, Math.floor((1111 - 440) / font.width));
      return (lines.length - 1) * font.lineHeight + font.height <= 76;
    });
    if (!addressFont) {
      throw new RangeError('Delivery address is too long to fit on this label. Use system printing for this shipment.');
    }
    const addressLines = wrapTextLines(address, Math.floor((1111 - 440) / addressFont.width));
    addressLines.forEach((text, lineIndex) => {
      texts.push({ text, x: 430 - lineIndex * addressFont.lineHeight, y: 440,
        fonttype: addressFont.type, rotation: 90, xscal: 1, yscal: 1, bold: false });
    });
    hubX = addressLines.length === 1 ? 375 : 345;
  }
  let routeHeight = 32;
  if (route) {
    const routeFont = [{ type: '4', width: 24, height: 32, lineHeight: 40 }, ...FOOTER_FONTS]
      .find((font) => {
        const lines = wrapTextLines(route, Math.floor((1111 - 440) / font.width));
        return (lines.length - 1) * font.lineHeight + font.height <= 52;
      });
    if (!routeFont) {
      throw new RangeError('Route is too long to fit on this label. Use system printing for this shipment.');
    }
    const routeLines = wrapTextLines(route, Math.floor((1111 - 440) / routeFont.width));
    routeHeight = Math.max(32, (routeLines.length - 1) * routeFont.lineHeight + routeFont.height);
    routeLines.forEach((text, lineIndex) => {
      texts.push({ text, x: hubX - lineIndex * routeFont.lineHeight, y: 440,
        fonttype: routeFont.type, rotation: 90, xscal: 1, yscal: 1, bold: true });
    });
  }

  // Contents span the footer; client and shipment share the row above the total.
  let footerLayout = null;
  for (const font of FOOTER_FONTS) {
    const leftCapacity = Math.floor((630 - 85 - 20) / font.width);
    const rightCapacity = Math.floor((1111 - 630) / font.width);
    const contentsCapacity = Math.floor((1111 - 85) / font.width);
    const contentsLines = wrapTextLines(contents ? `Contents: ${contents}` : '', contentsCapacity);
    const clientLines = wrapTextLines(clientName ? `Client: ${clientName}` : '', leftCapacity);
    const firstRowLines = Math.max(1, contentsLines.length);
    const secondRowLines = Math.max(1, clientLines.length);
    const rowGap = secondRowLines > 0 ? 13 : 0;
    const minimumLastLineX = (totalAmount !== null ? 133 : 75) + font.height;
    const firstRowX = Math.max(200,
      minimumLastLineX + (firstRowLines + secondRowLines - 1) * font.lineHeight + rowGap);

    if (`Shipment: ${shipmentId}`.length > rightCapacity || firstRowX > hubX - routeHeight - 44) continue;
    footerLayout = { font, firstRowX };
    const secondRowX = firstRowX - firstRowLines * font.lineHeight - rowGap;
    for (const field of [
      { lines: contentsLines, x: firstRowX, y: 85 },
      { lines: [`Shipment: ${shipmentId}`], x: secondRowX, y: 1111 - `Shipment: ${shipmentId}`.length * font.width },
      { lines: clientLines, x: secondRowX, y: 85 },
    ]) {
      field.lines.forEach((text, lineIndex) => {
        texts.push({ text, x: field.x - lineIndex * font.lineHeight, y: field.y,
          fonttype: font.type, rotation: 90, xscal: 1, yscal: 1, bold: false });
      });
    }
    break;
  }
  if (!footerLayout) {
    throw new RangeError('Label footer is too long to fit on this label. Use system printing for this shipment.');
  }

  if (totalAmount !== null) {
    const totalText = `Total: PHP ${totalAmount}`;
    const totalFont = [{ type: '4', width: 24 }, ...FOOTER_FONTS]
      .find((font) => totalText.length * font.width + 1 <= 1111 - 85);
    if (!totalFont) {
      throw new RangeError('Label total is too long to fit on this label. Use system printing for this shipment.');
    }
    // Include the native driver's one-dot bold offset in the fixed right edge.
    texts.push({ text: totalText, x: 90, y: 1111 - totalText.length * totalFont.width - 1,
      fonttype: totalFont.type, rotation: 90, xscal: 1, yscal: 1, bold: true });
  }

  return {
    width: widthMm,
    height: heightMm,
    gap: gapMm,
    direction: 0,
    tear: 'ON',
    text: texts,
    qrcode: [
      {
        x: 555, // Shifted down from 585 to balance spacing between top header divider and bottom footer line
        y: 110, // Centered horizontally between left border (y ~ 69) and recipient text (y = 440)
        level: 'L',
        width: 10, // Enlarged from 9 to 10 for prominent scan module size
        rotation: 90,
        code: trackingId,
      },
    ],
    // Solid divider lines & outer border using TSPL REVERSE rectangles
    // In TSPL, REVERSE on a blank white canvas creates crisp solid black lines
    reverse: [
      // Outer border (4 edges, 4 dots thick)
      { x: 731, y: 65, width: 4, height: 1070 },  // Top horizontal border
      { x: 55, y: 65, width: 4, height: 1070 },   // Bottom horizontal border
      { x: 55, y: 65, width: 680, height: 4 },    // Left vertical border
      { x: 55, y: 1131, width: 680, height: 4 },  // Right vertical border

      // Solid header divider line under brand name
      { x: 625, y: 65, width: 4, height: 1070 },

      // End at the inside edge of the right border without reversing its pixels.
      ...buildDashedDivider(Math.max(250, footerLayout.firstRowX + 28), 85, 1131),
      ...(totalAmount !== null ? buildDashedDivider(125, 630, 1131) : []),
    ],
  };
}
