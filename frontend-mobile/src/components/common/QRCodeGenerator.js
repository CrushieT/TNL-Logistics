import React, { useMemo } from 'react';
import { View, StyleSheet, Platform, Image } from 'react-native';
import { generateQRMatrix, generateQRSvgPath, generateQRBitmapDataUri } from '../../utils/qr';

export function QRCodeGenerator({
  value = 'TRK-2026-000101',
  size = 110,
  quietZone = 2,
  fgColor = '#000000',
  bgColor = '#FFFFFF',
  style,
}) {
  const { svgPath, totalSvgSize, bitmapUri } = useMemo(() => {
    try {
      const matrix = generateQRMatrix(value || 'TRK-2026-000101');
      const { path, totalSize } = generateQRSvgPath(matrix, quietZone);
      const uri = generateQRBitmapDataUri(matrix, 4, quietZone);
      return { svgPath: path, totalSvgSize: totalSize, bitmapUri: uri };
    } catch (err) {
      console.warn('QR Code generation fallback:', err);
      return { svgPath: '', totalSvgSize: 25, bitmapUri: null };
    }
  }, [value, quietZone]);

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return (
      <View style={[styles.container, { width: size, height: size, backgroundColor: bgColor }, style]}>
        <svg
          viewBox={`0 0 ${totalSvgSize} ${totalSvgSize}`}
          width={size}
          height={size}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            shapeRendering: 'crispEdges',
          }}
        >
          <rect width={totalSvgSize} height={totalSvgSize} fill={bgColor} />
          <path d={svgPath} fill={fgColor} />
        </svg>
      </View>
    );
  }

  if (bitmapUri) {
    return (
      <View style={[styles.container, { width: size, height: size, backgroundColor: bgColor }, style]}>
        <Image
          source={{ uri: bitmapUri }}
          style={{ width: size, height: size }}
          resizeMode="contain"
          accessibilityLabel={`QR code for ${value}`}
        />
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
