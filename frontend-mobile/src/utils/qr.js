import { qrcodegen } from '../vendor/qrcodegen/qrcodegen.js';

export function generateQRMatrix(text) {
  const qrCode = qrcodegen.QrCode.encodeText(String(text ?? ''), qrcodegen.QrCode.Ecc.MEDIUM);
  return Array.from({ length: qrCode.size }, (_, row) =>
    Array.from({ length: qrCode.size }, (_, column) => qrCode.getModule(column, row))
  );
}

export function generateQRSvgPath(matrix, margin = 2) {
  const size = matrix.length;
  let path = '';
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (matrix[row][column]) path += `M${column + margin},${row + margin}h1v1h-1z `;
    }
  }
  return { path, totalSize: size + margin * 2 };
}

export function generateQRBitmapDataUri(matrix, scale = 4, margin = 2) {
  const matrixSize = matrix.length;
  const width = (matrixSize + margin * 2) * scale;
  const height = width;
  const rowBytes = Math.ceil(width / 32) * 4;
  const imageSize = rowBytes * height;
  const dataOffset = 62;
  const buffer = new Uint8Array(dataOffset + imageSize);
  const view = new DataView(buffer.buffer);

  buffer[0] = 0x42;
  buffer[1] = 0x4d;
  view.setUint32(2, buffer.length, true);
  view.setUint32(10, dataOffset, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 1, true);
  view.setUint32(34, imageSize, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);
  view.setUint32(46, 2, true);
  buffer.set([0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00], 54);

  for (let outputRow = 0; outputRow < height; outputRow += 1) {
    const matrixRow = Math.floor((height - 1 - outputRow) / scale) - margin;
    const rowStart = dataOffset + outputRow * rowBytes;
    for (let outputColumn = 0; outputColumn < width; outputColumn += 1) {
      const matrixColumn = Math.floor(outputColumn / scale) - margin;
      const isDark = matrixRow >= 0 && matrixRow < matrixSize
        && matrixColumn >= 0 && matrixColumn < matrixSize
        && Boolean(matrix[matrixRow][matrixColumn]);
      if (isDark) buffer[rowStart + (outputColumn >> 3)] |= 1 << (7 - (outputColumn & 7));
    }
  }

  const binary = Array.from(buffer, (byte) => String.fromCharCode(byte)).join('');
  const base64 = typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(buffer).toString('base64');
  return `data:image/bmp;base64,${base64}`;
}
