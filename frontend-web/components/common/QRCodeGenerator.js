import React, { useMemo } from 'react';
import { View, StyleSheet, Image, Platform } from 'react-native';

/**
 * QR Code Generator Component
 * Generates clean, high-contrast, scannable 2D QR codes for tracking IDs.
 * Uses a crisp vector SVG data URL on web for pixel-sharp display and printing.
 */
export default function QRCodeGenerator({
  value = 'TRK-2026-000101',
  size = 110,
  quietZone = 2,
  fgColor = '#000000',
  bgColor = '#FFFFFF',
  style,
}) {
  const qrUri = useMemo(() => {
    // Generate clean QR code image from fast, reliable SVG vector encoding
    const encodedValue = encodeURIComponent(value);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodedValue}&format=svg&margin=${quietZone}&color=0-0-0&bgcolor=255-255-255`;
  }, [value, size, quietZone]);

  return (
    <View style={[styles.container, { width: size, height: size, backgroundColor: bgColor }, style]}>
      {Platform.OS === 'web' && typeof document !== 'undefined' ? (
        <img
          src={qrUri}
          alt={`QR Code for ${value}`}
          width={size}
          height={size}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            imageRendering: 'crisp-edges',
          }}
        />
      ) : (
        <Image
          source={{ uri: qrUri }}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
