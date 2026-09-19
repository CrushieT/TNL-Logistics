/**
 * Pure JavaScript In-Memory QR Code Generator (ISO/IEC 18004)
 * Zero dependencies, 100% offline, zero native binary requirements.
 */

// Galois Field 256 math tables
const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    EXP_TABLE[i + 255] = x;
    LOG_TABLE[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }
})();

function gMul(x, y) {
  if (x === 0 || y === 0) return 0;
  return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
}

// Reed-Solomon error correction generator polynomial
function getGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1);
    for (let j = 0; j < next.length; j++) next[j] = 0;
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gMul(poly[j], EXP_TABLE[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

// Reed-Solomon error correction remainder calculation
function calcErrorCorrection(data, ecCount) {
  const gen = getGeneratorPoly(ecCount);
  const result = new Array(ecCount).fill(0);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ result.shift();
    result.push(0);
    for (let j = 0; j < ecCount; j++) {
      result[j] ^= gMul(gen[j], factor);
    }
  }
  return result;
}

// Version and capacity table for Error Correction Level M
const VERSION_SPECS = [
  null,
  { version: 1, size: 21, totalBytes: 26, dataBytes: 16, ecBytes: 10, align: [] },
  { version: 2, size: 25, totalBytes: 44, dataBytes: 28, ecBytes: 16, align: [6, 18] },
  { version: 3, size: 29, totalBytes: 70, dataBytes: 44, ecBytes: 26, align: [6, 22] },
  { version: 4, size: 33, totalBytes: 100, dataBytes: 64, ecBytes: 36, align: [6, 26] },
  { version: 5, size: 37, totalBytes: 134, dataBytes: 86, ecBytes: 48, align: [6, 30] },
];

/**
 * Encodes text into QR matrix.
 */
export function generateQRMatrix(text) {
  const utf8Bytes = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code < 128) {
      utf8Bytes.push(code);
    } else if (code < 2048) {
      utf8Bytes.push(192 | (code >> 6), 128 | (code & 63));
    } else {
      utf8Bytes.push(224 | (code >> 12), 128 | ((code >> 6) & 63), 128 | (code & 63));
    }
  }

  // Find minimum version that fits data
  let spec = null;
  for (let v = 1; v < VERSION_SPECS.length; v++) {
    const s = VERSION_SPECS[v];
    if (s.dataBytes >= utf8Bytes.length + 3) {
      spec = s;
      break;
    }
  }
  if (!spec) spec = VERSION_SPECS[VERSION_SPECS.length - 1];

  // Build bit stream: 0100 (Byte mode) + length (8 bits) + data + terminator (0000)
  const bitStream = [];
  function pushBits(val, len) {
    for (let i = len - 1; i >= 0; i--) {
      bitStream.push((val >> i) & 1);
    }
  }

  pushBits(4, 4); // Byte mode indicator
  pushBits(utf8Bytes.length, 8); // Character count
  for (let i = 0; i < utf8Bytes.length; i++) {
    pushBits(utf8Bytes[i], 8);
  }

  // Terminator (up to 4 zeroes)
  const maxDataBits = spec.dataBytes * 8;
  const termLen = Math.min(4, maxDataBits - bitStream.length);
  for (let i = 0; i < termLen; i++) bitStream.push(0);

  // Pad to byte boundary
  while (bitStream.length % 8 !== 0) bitStream.push(0);

  // Pad bytes: 0xEC, 0x11 alternately
  const dataBytes = [];
  for (let i = 0; i < bitStream.length; i += 8) {
    let byteVal = 0;
    for (let b = 0; b < 8; b++) {
      byteVal = (byteVal << 1) | bitStream[i + b];
    }
    dataBytes.push(byteVal);
  }

  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (dataBytes.length < spec.dataBytes) {
    dataBytes.push(padBytes[padIdx]);
    padIdx = (padIdx + 1) % 2;
  }

  // Compute error correction codewords
  const ecBytes = calcErrorCorrection(dataBytes, spec.ecBytes);
  const allBytes = dataBytes.concat(ecBytes);

  // Initialize matrix
  const size = spec.size;
  const matrix = Array.from({ length: size }, () => new Array(size).fill(null));
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));

  // Place Finder Pattern
  function placeFinder(row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          isFunction[nr][nc] = true;
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            matrix[nr][nc] = r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          } else {
            matrix[nr][nc] = false; // Separator
          }
        }
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!isFunction[6][i]) {
      matrix[6][i] = i % 2 === 0;
      isFunction[6][i] = true;
    }
    if (!isFunction[i][6]) {
      matrix[i][6] = i % 2 === 0;
      isFunction[i][6] = true;
    }
  }

  // Alignment patterns
  if (spec.align && spec.align.length > 0) {
    const coords = spec.align;
    for (let i = 0; i < coords.length; i++) {
      for (let j = 0; j < coords.length; j++) {
        const r = coords[i];
        const c = coords[j];
        if (isFunction[r][c]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBlack = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
            matrix[r + dr][c + dc] = isBlack;
            isFunction[r + dr][c + dc] = true;
          }
        }
      }
    }
  }

  // Reserve format information areas
  for (let i = 0; i < 9; i++) {
    if (i < size) isFunction[8][i] = true;
    if (size - 1 - i >= 0) isFunction[8][size - 1 - i] = true;
    if (i < size) isFunction[i][8] = true;
    if (size - 1 - i >= 0) isFunction[size - 1 - i][8] = true;
  }
  isFunction[size - 8][8] = true; // Dark module
  matrix[size - 8][8] = true;

  // Place data bits in zigzag layout
  const allBits = [];
  for (let i = 0; i < allBytes.length; i++) {
    for (let b = 7; b >= 0; b--) {
      allBits.push((allBytes[i] >> b) & 1);
    }
  }

  let bitIdx = 0;
  let upwards = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing column
    const rows = upwards
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const r of rows) {
      for (const c of [right, right - 1]) {
        if (!isFunction[r][c]) {
          const bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
          // Apply mask 0: (row + col) % 2 === 0
          const maskBit = (r + c) % 2 === 0;
          matrix[r][c] = (bit ^ (maskBit ? 1 : 0)) === 1;
        }
      }
    }
    upwards = !upwards;
  }

  // Format info for Level M, Mask 0 (0x5412)
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  const formatPos1 = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
    [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
  ];
  for (let i = 0; i < 15; i++) {
    const [r, c] = formatPos1[i];
    matrix[r][c] = formatBits[i] === 1;
  }
  const formatPos2 = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8],
    [size - 5, 8], [size - 6, 8], [size - 7, 8],
    [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5],
    [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1]
  ];
  for (let i = 0; i < 15; i++) {
    const [r, c] = formatPos2[i];
    matrix[r][c] = formatBits[i] === 1;
  }

  return matrix;
}

/**
 * Generates an optimized vector SVG path data string for instant rendering.
 */
export function generateQRSvgPath(matrix, margin = 2) {
  const size = matrix.length;
  let path = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        path += `M${c + margin},${r + margin}h1v1h-1z `;
      }
    }
  }
  return { path, totalSize: size + margin * 2 };
}

/**
 * Converts a QR boolean matrix to a standard 1-bit monochrome uncompressed Windows BMP
 * base64 data URI. Supported natively on all React Native platforms (<Image source={{ uri }} />)
 * without any external SVG or canvas native modules.
 */
export function generateQRBitmapDataUri(matrix, scale = 4, margin = 2) {
  const matrixSize = matrix.length;
  const width = (matrixSize + margin * 2) * scale;
  const height = width;

  // Each scanline in 1-bit BMP must be padded to a 32-bit (4-byte) boundary
  const rowBytes = Math.ceil(width / 32) * 4;
  const imageSize = rowBytes * height;
  const fileHeaderSize = 14;
  const dibHeaderSize = 40;
  const colorTableSize = 8; // 2 entries of 4 bytes: [B, G, R, 0]
  const dataOffset = fileHeaderSize + dibHeaderSize + colorTableSize;
  const fileSize = dataOffset + imageSize;

  const buffer = new Uint8Array(fileSize);
  const view = new DataView(buffer.buffer);

  // Bitmap File Header (14 bytes)
  buffer[0] = 0x42; // 'B'
  buffer[1] = 0x4d; // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint16(6, 0, true); // Reserved
  view.setUint16(8, 0, true); // Reserved
  view.setUint32(10, dataOffset, true);

  // DIB Header - BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, dibHeaderSize, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // Bottom-up orientation
  view.setUint16(26, 1, true); // Color planes
  view.setUint16(28, 1, true); // Bits per pixel (1-bit monochrome)
  view.setUint32(30, 0, true); // BI_RGB compression (none)
  view.setUint32(34, imageSize, true);
  view.setInt32(38, 2835, true); // Horizontal resolution ~72 DPI
  view.setInt32(42, 2835, true); // Vertical resolution ~72 DPI
  view.setUint32(46, 2, true); // Number of colors in palette
  view.setUint32(50, 0, true); // Important colors

  // Color Table: Color 0 = White (0xFFFFFF), Color 1 = Black (0x000000)
  // Entry 0: White
  buffer[54] = 0xff; // B
  buffer[55] = 0xff; // G
  buffer[56] = 0xff; // R
  buffer[57] = 0x00; // Reserved
  // Entry 1: Black
  buffer[58] = 0x00; // B
  buffer[59] = 0x00; // G
  buffer[60] = 0x00; // R
  buffer[61] = 0x00; // Reserved

  // Pixel data (stored bottom-up)
  for (let y = 0; y < height; y++) {
    // Invert y for bottom-up BMP
    const sourceY = height - 1 - y;
    const matrixRow = Math.floor(sourceY / scale) - margin;
    const rowStart = dataOffset + y * rowBytes;

    for (let x = 0; x < width; x++) {
      const matrixCol = Math.floor(x / scale) - margin;
      let isBlack = false;
      if (matrixRow >= 0 && matrixRow < matrixSize && matrixCol >= 0 && matrixCol < matrixSize) {
        isBlack = Boolean(matrix[matrixRow][matrixCol]);
      }

      if (isBlack) {
        const byteIndex = rowStart + (x >> 3);
        const bitIndex = 7 - (x & 7);
        buffer[byteIndex] |= 1 << bitIndex;
      }
    }
  }

  // Base64 encoding in pure JavaScript
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }

  let base64 = '';
  if (typeof btoa !== 'undefined') {
    base64 = btoa(binary);
  } else {
    base64 = Buffer.from(buffer).toString('base64');
  }

  return `data:image/bmp;base64,${base64}`;
}
