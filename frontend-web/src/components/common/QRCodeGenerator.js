import React, { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { generateQRMatrix, generateQRSvgPath } from '../../utils/qr';

export default function QRCodeGenerator({
  value = 'TRK-2026-000101',
  size = 110,
  quietZone = 2,
  fgColor = '#000000',
  bgColor = '#FFFFFF',
  style,
}) {
  const { path, totalSize } = useMemo(() => {
    try {
      const matrix = generateQRMatrix(value || 'TRK-2026-000101');
      return generateQRSvgPath(matrix, quietZone);
    } catch (err) {
      console.warn('QR Code generation fallback:', err);
      return { path: '', totalSize: 25 };
    }
  }, [value, quietZone]);

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return (
      <View style={[styles.container, { width: size, height: size, backgroundColor: bgColor }, style]}>
        <svg
          viewBox={`0 0 ${totalSize} ${totalSize}`}
          width={size}
          height={size}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            shapeRendering: 'crispEdges',
          }}
        >
          <rect width={totalSize} height={totalSize} fill={bgColor} />
          <path d={path} fill={fgColor} />
        </svg>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size, backgroundColor: bgColor }, style]} />
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
