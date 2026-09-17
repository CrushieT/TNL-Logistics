import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { Icon } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { apiClient } from '../../services/api/client';
import { colors } from '../../theme';

/**
 * QR Scanner Screen placeholder for Phase 6.1 (Full 5-state validation in Phase 6.4).
 */
export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.permissionText}>
          Camera permission is required to scan parcel QR tags.
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = async ({ type, data }) => {
    setScanned(true);
    setLoading(true);

    try {
      Alert.alert(
        'Tag Scanned',
        `Data: ${data}\n\nSyncing status with backend...`,
        [
          {
            text: 'Update LOADED_ON_TRUCK',
            onPress: () => updateStatus(data, 'LOADED_ON_TRUCK'),
          },
          {
            text: 'Cancel',
            onPress: () => {
              setScanned(false);
              setLoading(false);
            },
            style: 'cancel',
          },
        ]
      );
    } catch (err) {
      Alert.alert('Scan Error', 'Unable to parse QR metadata.');
      setScanned(false);
      setLoading(false);
    }
  };

  const updateStatus = async (trackingNumber, status) => {
    try {
      await apiClient.post('/tracking-events/scan', {
        trackingNumber,
        status,
      });
      Alert.alert('Sync Successful', `Parcel ${trackingNumber} updated to ${status}.`);
    } catch (err) {
      Alert.alert(
        'Sync Failed',
        err.response?.data?.message || 'Could not sync update to server.'
      );
    } finally {
      setScanned(false);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />

      <View style={styles.overlay}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Icon source="arrow-left" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.title}>Scan Parcel QR</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.targetFrameContainer}>
          <View style={styles.targetFrame} />
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.instructionText}>
            {loading ? 'Processing scan...' : 'Align QR code within the frame to scan'}
          </Text>
          {scanned && !loading && (
            <TouchableOpacity style={styles.scanAgainButton} onPress={() => setScanned(false)}>
              <Text style={styles.scanAgainText}>Tap to Scan Again</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: colors.canvas,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionText: {
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  button: {
    backgroundColor: colors.black,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 4,
    marginBottom: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  backLink: {
    paddingVertical: 8,
  },
  backLinkText: {
    color: colors.inkSoft,
    fontSize: 14,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'space-between',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  targetFrameContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetFrame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  footerRow: {
    alignItems: 'center',
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 13,
    marginBottom: 12,
  },
  scanAgainButton: {
    backgroundColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 4,
  },
  scanAgainText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
