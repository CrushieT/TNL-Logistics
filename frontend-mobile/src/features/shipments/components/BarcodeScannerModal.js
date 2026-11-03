import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import ScanFeedbackBanner from '../../scanner/components/ScanFeedbackBanner';
import { safeHaptics } from '../../scanner/utils/haptics';
import { colors, spacing, typography } from '../../../theme';

export function BarcodeScannerModal({ visible, onClose, onScan }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const [feedback, setFeedback] = useState(null);
  const requestVersionRef = useRef(0);
  const scanLockRef = useRef(false);
  useEffect(() => {
    requestVersionRef.current += 1;
    scanLockRef.current = false;
    setScanned(false);
    setManualCode('');
    setFeedback(null);
    return () => { requestVersionRef.current += 1; };
  }, [visible]);

  if (!visible) return null;

  const handleBarcodeScanned = async ({ data }) => {
    if (scanLockRef.current) return;
    const code = String(data || '').trim();
    if (!code) {
      setFeedback({ kind: 'error', message: 'No code detected. Scan again or enter a code.' });
      safeHaptics.error();
      return;
    }
    scanLockRef.current = true;
    const requestVersion = requestVersionRef.current;
    setScanned(true);
    setFeedback({ kind: 'loading', message: 'Checking code...' });
    try {
      await onScan(code);
      if (requestVersionRef.current !== requestVersion) return;
      setFeedback({ kind: 'success', message: 'Code read. Check the lookup result.' });
      safeHaptics.selection();
    } catch (error) {
      if (requestVersionRef.current !== requestVersion) return;
      scanLockRef.current = false;
      setScanned(false);
      setFeedback({ kind: 'error', message: error?.response?.data?.message || error?.message || 'Lookup failed. Try again.' });
      safeHaptics.error();
    }
  };

  const handleManualSubmit = () => handleBarcodeScanned({ data: manualCode });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close scanner" onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
          <Text accessibilityRole="header" style={styles.headerTitle}>SCAN QR / BARCODE</Text>
          <View style={{ width: 50 }} />
        </View>

        {permission?.granted ? (
          <View style={styles.cameraContainer}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128'] }}
            />
            <View style={styles.overlay}>
              <View style={styles.targetFrame} />
              <Text style={styles.instruction}>Align barcode or QR code inside the frame</Text>
            </View>
          </View>
        ) : (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionPrompt}>Camera permission is required to scan QR tags.</Text>
            <TouchableOpacity accessibilityRole="button" onPress={requestPermission} style={styles.grantBtn}>
              <Text style={styles.grantText}>Grant Camera Permission</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScanFeedbackBanner kind={feedback?.kind} message={feedback?.message} onDismiss={() => setFeedback(null)} />
        {scanned && feedback?.kind !== 'loading' && (
          <TouchableOpacity accessibilityRole="button" onPress={() => {
            scanLockRef.current = false;
            setScanned(false);
            setFeedback(null);
          }} style={styles.lookupBtn}>
            <Text style={styles.lookupText}>Scan another code</Text>
          </TouchableOpacity>
        )}
        <View style={styles.manualBox}>
          <Text style={styles.manualLabel}>OR ENTER CODE MANUALLY</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.manualInput}
              placeholder="e.g. TRK-2026-000101 or SHP-..."
              placeholderTextColor={colors.inkFaint}
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              accessibilityRole="button"
              onPress={handleManualSubmit}
              disabled={scanned || !manualCode.trim()}
              style={[styles.lookupBtn, !manualCode.trim() && styles.btnDisabled]}
            >
              <Text style={styles.lookupText}>Look up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  closeBtn: { minHeight: 44, justifyContent: 'center' },
  closeText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  headerTitle: { ...typography.eyebrow, color: colors.ink, letterSpacing: 1 },
  cameraContainer: { flex: 1, position: 'relative', overflow: 'hidden' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
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
  instruction: {
    color: '#FFFFFF',
    fontSize: 13,
    marginTop: spacing.lg,
    fontWeight: '600',
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  permissionPrompt: { ...typography.body, textAlign: 'center', marginBottom: spacing.lg },
  grantBtn: {
    backgroundColor: colors.black,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 4,
  },
  grantText: { color: colors.surface, fontWeight: '700', fontSize: 14 },
  manualBox: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  manualLabel: { ...typography.eyebrow, marginBottom: spacing.sm },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
  manualInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    backgroundColor: colors.canvas,
    color: colors.ink,
    fontFamily: 'monospace',
  },
  lookupBtn: {
    backgroundColor: colors.black,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  lookupText: { color: colors.surface, fontWeight: '700', fontSize: 13 },
});
