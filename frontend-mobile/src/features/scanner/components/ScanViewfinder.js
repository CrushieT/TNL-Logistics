import React from 'react';
import { Animated, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Icon } from 'react-native-paper';
import { CameraView } from 'expo-camera';
import { colors, typography, spacing, radius } from '../../../theme';

export default function ScanViewfinder({
  cameraActive,
  torchEnabled,
  onToggleTorch,
  onBarcodeScanned,
  permissionGranted,
  onRequestPermission,
  instructionText,
  cameraError,
  onCameraMountError,
  onRetryCamera,
  cameraMountKey,
  pausedText,
  viewfinderHeight = 280,
  animatedHeight
}) {
  const hasCameraError = Boolean(cameraError);
  const isCompact = viewfinderHeight < 220;
  const reticleSize = isCompact ? 104 : 200;

  return (
    <Animated.View style={[styles.container, { height: animatedHeight || viewfinderHeight }]}>
      {permissionGranted && cameraActive && !hasCameraError ? (
        <CameraView
          key={cameraMountKey}
          style={styles.camera}
          facing="back"
          enableTorch={torchEnabled}
          onBarcodeScanned={onBarcodeScanned}
          onMountError={onCameraMountError}
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'code128']
          }}
        />
      ) : (
        <View style={[styles.fallbackContainer, isCompact && styles.fallbackContainerCompact]}>
          {hasCameraError ? (
            <>
              <Icon source="camera-off" size={isCompact ? 24 : 36} color={colors.inkFaint} />
              <Text style={[styles.fallbackText, isCompact && styles.fallbackTextCompact]}>
                {cameraError || 'Camera preview unavailable. You can enter tracking IDs manually below.'}
              </Text>
              {onRetryCamera && (
                <TouchableOpacity style={styles.permissionButton} onPress={onRetryCamera}>
                  <Text style={styles.permissionButtonText}>Retry Camera</Text>
                </TouchableOpacity>
              )}
            </>
          ) : !permissionGranted ? (
            <>
              <Icon source="camera-off" size={isCompact ? 24 : 36} color={colors.inkFaint} />
              <Text style={[styles.fallbackText, isCompact && styles.fallbackTextCompact]}>
                Camera permission is required to scan QR codes
              </Text>
              <TouchableOpacity style={styles.permissionButton} onPress={onRequestPermission}>
                <Text style={styles.permissionButtonText}>Grant Permission</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={[styles.fallbackText, isCompact && styles.fallbackTextCompact]}>
              {pausedText || 'Camera preview paused'}
            </Text>
          )}
        </View>
      )}

      {/* Reticle Overlay */}
      <View style={styles.overlayContainer} pointerEvents="box-none">
        {/* Torch Button in Upper Right */}
        {permissionGranted && cameraActive && !hasCameraError && (
          <TouchableOpacity
            style={[styles.torchButton, torchEnabled && styles.torchButtonActive]}
            onPress={onToggleTorch}
            accessibilityLabel="Toggle camera torch"
          >
            <Icon
              source={torchEnabled ? 'flashlight' : 'flashlight-off'}
              size={20}
              color={torchEnabled ? '#FFFFFF' : '#D9D8D3'}
            />
          </TouchableOpacity>
        )}

        {/* Reticle Frame */}
        {permissionGranted && cameraActive && !hasCameraError && (
          <View
            style={[styles.reticleContainer, { width: reticleSize, height: reticleSize }]}
            pointerEvents="none"
          >
            {/* Top Left Corner */}
            <View style={[styles.corner, styles.cornerTL]} />
            {/* Top Right Corner */}
            <View style={[styles.corner, styles.cornerTR]} />
            {/* Bottom Left Corner */}
            <View style={[styles.corner, styles.cornerBL]} />
            {/* Bottom Right Corner */}
            <View style={[styles.corner, styles.cornerBR]} />

            {/* Thin Orange Scan Line */}
            <View style={styles.scanLine} />
          </View>
        )}

        {/* Instruction Label */}
        <View
          style={[styles.instructionContainer, isCompact && styles.instructionContainerCompact]}
          pointerEvents="none"
        >
          <Text style={[styles.instructionText, isCompact && styles.instructionTextCompact]} numberOfLines={1}>
            {instructionText || 'Each package has its own QR — scan identifies the exact unit'}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111317',
    position: 'relative',
    overflow: 'hidden'
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%'
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg
  },
  fallbackContainerCompact: {
    padding: spacing.sm
  },
  fallbackText: {
    ...typography.bodySmall,
    color: '#A8A7A0',
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md
  },
  fallbackTextCompact: {
    fontSize: 11,
    marginTop: 4,
    marginBottom: spacing.xs
  },
  permissionButton: {
    backgroundColor: colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.sm
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center'
  },
  torchButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(26, 26, 26, 0.75)',
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  torchButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  reticleContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center'
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: colors.accent
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3
  },
  scanLine: {
    width: '90%',
    height: 1.5,
    backgroundColor: colors.accent,
    opacity: 0.85
  },
  instructionContainer: {
    position: 'absolute',
    bottom: 12,
    paddingHorizontal: spacing.lg
  },
  instructionContainerCompact: {
    bottom: 4,
    paddingHorizontal: spacing.sm
  },
  instructionText: {
    fontSize: 11,
    color: '#E0DFD8',
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.2
  },
  instructionTextCompact: {
    fontSize: 9
  }
});
