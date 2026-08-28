import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import AppShell from '../../components/layout/AppShell';
import { colors, fonts, spacing, radius, type, waybillStyles } from '../../theme';
import {
  WaybillManifestCard,
  getWaybillShipmentOptions,
  getHaulerStaffOptions,
  getWaybillManifest,
  sendToHauler,
  completeWaybill,
} from '../../features/waybills';

export default function WaybillsScreen() {
  const router = useRouter();

  // State
  const [shipments, setShipments] = useState([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [manifest, setManifest] = useState(null);
  const [haulerOptions, setHaulerOptions] = useState([]);
  const [selectedHauler, setSelectedHauler] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Load initial shipment list and hauler staff options
  const loadData = useCallback(async (targetShipmentId = null) => {
    try {
      setLoading(true);
      const [shipmentList, haulers] = await Promise.all([
        getWaybillShipmentOptions(),
        getHaulerStaffOptions(),
      ]);

      setShipments(shipmentList);
      setHaulerOptions(haulers);

      let shipIdToSelect = targetShipmentId;
      if (!shipIdToSelect && shipmentList.length > 0) {
        // Default to the first shipment or previously selected
        shipIdToSelect = selectedShipmentId || shipmentList[0].shipmentId;
      }

      if (shipIdToSelect) {
        setSelectedShipmentId(shipIdToSelect);
        await loadManifest(shipIdToSelect, haulers);
      }
    } catch (err) {
      console.error('Failed to load waybill data:', err);
      setFeedbackMsg({ type: 'error', text: 'Failed to load waybill records.' });
    } finally {
      setLoading(false);
    }
  }, [selectedShipmentId]);

  const loadManifest = async (shipmentId, haulers = haulerOptions) => {
    try {
      const data = await getWaybillManifest(shipmentId);
      setManifest(data);

      // Pre-fill hauler if already designated or pick first hauler staff
      if (data.haulerName && data.haulerName !== '—') {
        setSelectedHauler(data.haulerName);
      } else if (haulers.length > 0) {
        setSelectedHauler(haulers[0].fullName || haulers[0].displayLabel);
      }
    } catch (err) {
      console.error('Failed to load manifest for shipment:', shipmentId, err);
      setFeedbackMsg({ type: 'error', text: `Failed to load manifest for ${shipmentId}.` });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectShipment = async (shipmentId) => {
    setSelectedShipmentId(shipmentId);
    setFeedbackMsg(null);
    await loadManifest(shipmentId);
  };

  // Stage 1: Mark as Sent to Hauler
  const handleSendToHauler = async () => {
    if (!selectedShipmentId || !selectedHauler) {
      setFeedbackMsg({ type: 'error', text: 'Please select a hauler.' });
      return;
    }

    try {
      setActionLoading(true);
      setFeedbackMsg(null);

      const payload = {
        shipmentId: selectedShipmentId,
        haulerName: selectedHauler,
      };

      const updated = await sendToHauler(payload);
      setManifest(updated);

      // Refresh shipment selector status
      const updatedShipments = await getWaybillShipmentOptions();
      setShipments(updatedShipments);

      setFeedbackMsg({ type: 'success', text: `Waybill dispatched to ${selectedHauler}.` });
    } catch (err) {
      console.error('Failed to dispatch to hauler:', err);
      setFeedbackMsg({ type: 'error', text: 'Failed to update waybill status.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Stage 2: Mark as Signed / Completed
  const handleCompleteWaybill = async () => {
    if (!selectedShipmentId) return;

    try {
      setActionLoading(true);
      setFeedbackMsg(null);

      const payload = {
        signedBy: manifest?.recipientName || 'Consignee',
      };

      const updated = await completeWaybill(selectedShipmentId, payload);
      setManifest(updated);

      // Refresh shipment selector status
      const updatedShipments = await getWaybillShipmentOptions();
      setShipments(updatedShipments);

      setFeedbackMsg({ type: 'success', text: 'Waybill marked as Signed / Completed.' });
    } catch (err) {
      console.error('Failed to complete waybill:', err);
      setFeedbackMsg({ type: 'error', text: 'Failed to record signed Proof of Delivery.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Print / Export PDF Handler via isolated print iframe with full CSSOM extraction
  const handlePrint = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const manifestEl = document.getElementById('printable-waybill-manifest');
    if (!manifestEl) {
      window.print();
      return;
    }

    // Extract all compiled styles from document.styleSheets (including React Native Web CSSOM rules)
    let extractedStyles = '';
    try {
      for (let i = 0; i < document.styleSheets.length; i++) {
        const sheet = document.styleSheets[i];
        try {
          const rules = sheet.cssRules || sheet.rules;
          if (rules) {
            for (let j = 0; j < rules.length; j++) {
              extractedStyles += rules[j].cssText + '\n';
            }
          }
        } catch (err) {
          // Ignore cross-origin stylesheet errors
        }
      }
    } catch (e) {
      console.warn('Could not extract all stylesheets:', e);
    }

    // Reuse or create hidden print iframe
    let iframe = document.getElementById('manifest-print-frame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'manifest-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>TNL Logistics - Waybill</title>
          <style>
            ${extractedStyles}
          </style>
          <style>
            @page {
              size: landscape;
              margin: 0;
            }
            * {
              box-sizing: border-box !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #FFFFFF !important;
              width: 100% !important;
              height: 100% !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            .print-container {
              width: 100vw !important;
              min-height: 100vh !important;
              box-sizing: border-box !important;
              padding: 12mm 16mm !important;
              margin: 0 !important;
              display: flex !important;
              flex-direction: column !important;
            }
            #printable-waybill-manifest {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              border-width: 0 !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              background-color: transparent !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${manifestEl.outerHTML}
          </div>
        </body>
      </html>
    `);
    iframeDoc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 350);
  };

  // Find currently selected option
  const currentOption = shipments.find((s) => s.shipmentId === selectedShipmentId);
  const currentStatusLabel = manifest?.statusLabel || currentOption?.waybillStatus || 'Not Generated';
  const badgeStyle = waybillStyles[currentStatusLabel] || waybillStyles['Not Generated'];

  const isCompleted = manifest?.status === 'SIGNED_COMPLETED' || currentStatusLabel === 'Signed / Completed';
  const isSentToHauler = manifest?.status === 'SENT_TO_HAULER' || currentStatusLabel === 'Sent to Hauler';

  return (
    <AppShell activeTab="waybills">
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Header Row */}
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.eyebrow}>ONE WAYBILL PER SHIPMENT</Text>
            <Text style={styles.h1}>WAYBILLS</Text>
          </View>

          <Pressable style={styles.printBtn} onPress={handlePrint}>
            <Text style={styles.printBtnText}>Print / Export PDF</Text>
          </Pressable>
        </View>

        {/* Feedback Alert */}
        {feedbackMsg ? (
          <View style={[styles.alertBox, feedbackMsg.type === 'error' ? styles.alertError : styles.alertSuccess]}>
            <Text style={[styles.alertText, feedbackMsg.type === 'error' ? styles.alertTextError : styles.alertTextSuccess]}>
              {feedbackMsg.text}
            </Text>
          </View>
        ) : null}

        {/* Shipment Selector & Status Row */}
        <View style={styles.selectorRow}>
          {Platform.OS === 'web' ? (
            <View style={styles.selectWrapper}>
              <select
                value={selectedShipmentId}
                onChange={(e) => handleSelectShipment(e.target.value)}
                style={webSelectStyle}
              >
                {shipments.map((s) => (
                  <option key={s.shipmentId} value={s.shipmentId}>
                    {s.shipmentId} · {s.recipientName} · {s.waybillStatus}
                  </option>
                ))}
              </select>
            </View>
          ) : (
            <View style={styles.mobileSelectCard}>
              <Text style={styles.mobileSelectText}>{selectedShipmentId || 'Select Shipment'}</Text>
            </View>
          )}

          <View style={[styles.statusBadge, { backgroundColor: badgeStyle.bg, borderColor: badgeStyle.border }]}>
            <Text style={[styles.statusBadgeText, { color: badgeStyle.fg }]}>
              Waybill: {currentStatusLabel}
            </Text>
          </View>

          {selectedShipmentId ? (
            <Pressable
              onPress={() => router.push(`/shipments/${selectedShipmentId}`)}
              style={styles.openShipmentBtn}
            >
              <Text style={styles.openShipmentText}>Open shipment →</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Waybill Workflow Control Card */}
        <View style={styles.workflowCard}>
          <View style={styles.workflowHeader}>
            <Text style={styles.workflowEyebrow}>WAYBILL WORKFLOW:</Text>
          </View>

          <View style={styles.workflowBody}>
            {isCompleted ? (
              // Stage 3: Completed
              <View style={styles.completedRow}>
                <View style={styles.completedBadge}>
                  <Text style={styles.completedBadgeText}>✓ Completed</Text>
                </View>
                <Text style={styles.completedMeta}>
                  Signed by <Text style={styles.boldText}>{manifest?.signedBy || 'Consignee'}</Text> on{' '}
                  <Text style={styles.boldText}>{manifest?.signedDate || manifest?.generatedDate || '—'}</Text>
                </Text>
              </View>
            ) : isSentToHauler ? (
              // Stage 2: Sent to Hauler -> Direct Mark as Signed / Completed
              <View style={styles.actionRow}>
                <View style={styles.haulerInfoTag}>
                  <Text style={styles.haulerInfoLabel}>HAULER:</Text>
                  <Text style={styles.haulerInfoVal}>{manifest?.haulerName || selectedHauler || '—'}</Text>
                </View>

                <Pressable
                  style={[styles.actionBtn, actionLoading && styles.btnDisabled]}
                  onPress={handleCompleteWaybill}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.actionBtnText}>Mark as Signed / Completed →</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              // Stage 1: Not Generated -> Mark as Sent to Hauler
              <View style={styles.actionRow}>
                <View style={styles.haulerPickerGroup}>
                  <Text style={styles.inputLabel}>HAULER</Text>
                  {Platform.OS === 'web' ? (
                    <select
                      value={selectedHauler}
                      onChange={(e) => setSelectedHauler(e.target.value)}
                      style={webHaulerSelectStyle}
                    >
                      {haulerOptions.map((h) => (
                        <option key={h.userId || h.fullName} value={h.fullName || h.displayLabel}>
                          {h.displayLabel || h.fullName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <TextInput
                      style={styles.signedByInput}
                      value={selectedHauler}
                      onChangeText={setSelectedHauler}
                      placeholder="Hauler / Carrier Name"
                    />
                  )}
                </View>

                <Pressable
                  style={[styles.actionBtn, actionLoading && styles.btnDisabled]}
                  onPress={handleSendToHauler}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.actionBtnText}>Mark as Sent to Hauler →</Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* Live A4 Manifest Sheet Card */}
        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <View style={styles.manifestWrap}>
            {/* Embedded WaybillManifestCard */}
            {manifest ? (
              <WaybillManifestCard manifest={manifest} selectedHauler={selectedHauler} />
            ) : (
              <View style={styles.emptyManifestBox}>
                <Text style={styles.emptyManifestText}>No manifest details available for this shipment.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}

// Web Select Style
const webSelectStyle = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '13.5px',
  fontWeight: '600',
  color: colors.ink,
  backgroundColor: '#FFFFFF',
  border: '1px solid #C4C2B8',
  borderRadius: '4px',
  padding: '8px 12px',
  minWidth: '380px',
  cursor: 'pointer',
  outline: 'none',
};

const webHaulerSelectStyle = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '13px',
  color: colors.ink,
  backgroundColor: '#F8F7F3',
  border: '1px solid #C4C2B8',
  borderRadius: '3px',
  padding: '7px 10px',
  minWidth: '240px',
  cursor: 'pointer',
  outline: 'none',
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.lg,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eyebrow: {
    ...type.eyebrow,
    color: '#65635C',
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  h1: {
    ...type.h1,
    fontSize: 26,
    color: colors.ink,
  },
  printBtn: {
    backgroundColor: '#111111',
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  printBtnText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  alertBox: {
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  alertSuccess: {
    backgroundColor: '#E7F3EA',
    borderColor: '#B8E2C8',
  },
  alertError: {
    backgroundColor: '#FBEAE8',
    borderColor: '#F2B8B5',
  },
  alertText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
  },
  alertTextSuccess: {
    color: '#2E7D46',
  },
  alertTextError: {
    color: '#C0392B',
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  selectWrapper: {
    alignSelf: 'center',
  },
  mobileSelectCard: {
    padding: spacing.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  mobileSelectText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  statusBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  openShipmentBtn: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  openShipmentText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  workflowCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1DFD5',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    minHeight: 70,
  },
  workflowHeader: {
    alignSelf: 'center',
  },
  workflowEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: '#65635C',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  workflowBody: {
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.lg,
    flexWrap: 'wrap',
  },
  haulerPickerGroup: {
    gap: 4,
  },
  inputGroup: {
    gap: 4,
    minWidth: 260,
  },
  inputLabel: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  signedByInput: {
    borderWidth: 1,
    borderColor: '#C4C2B8',
    backgroundColor: '#F8F7F3',
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 3,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
  },
  haulerInfoTag: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: '#E1DFD5',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    gap: 2,
  },
  haulerInfoLabel: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.inkFaint,
  },
  haulerInfoVal: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  actionBtn: {
    backgroundColor: '#111111',
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 36,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  completedBadge: {
    backgroundColor: '#E7F3EA',
    borderWidth: 1,
    borderColor: '#B8E2C8',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
  },
  completedBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '800',
    color: '#2E7D46',
    letterSpacing: 0.4,
  },
  completedMeta: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkSoft,
  },
  boldText: {
    fontWeight: '700',
    color: colors.ink,
  },
  loaderWrap: {
    padding: spacing.xxl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manifestWrap: {
    marginTop: spacing.sm,
  },
  emptyManifestBox: {
    padding: spacing.xxl,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1DFD5',
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  emptyManifestText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.inkFaint,
  },

  // Manifest Sheet Card Styles
  manifestCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1DFD5',
    paddingHorizontal: 36,
    paddingVertical: 32,
    borderRadius: radius.sm,
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: spacing.md,
  },
  brandCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logoMark: {
    width: 44,
    height: 44,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  logoMarkText: {
    fontFamily: fonts.mono,
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 22,
  },
  brandInfo: {
    gap: 2,
  },
  brandTitle: {
    fontFamily: fonts.sans,
    fontWeight: '800',
    fontSize: 16,
    color: colors.ink,
    letterSpacing: 0.5,
  },
  brandSub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkSoft,
  },
  docCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  docTitle: {
    fontFamily: fonts.sans,
    fontWeight: '800',
    fontSize: 17,
    color: colors.ink,
    letterSpacing: 0.5,
  },
  docNumber: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.inkSoft,
  },
  docDate: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkFaint,
  },
  manifestDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E1DFD5',
    marginVertical: spacing.md + 2,
  },
  partiesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xl,
    paddingVertical: spacing.xs,
  },
  partyCol: {
    flex: 1,
    gap: 3,
  },
  partyColRight: {
    alignItems: 'flex-end',
  },
  partyEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  partyName: {
    fontFamily: fonts.sans,
    fontWeight: '800',
    fontSize: 15,
    color: colors.ink,
  },
  partyHub: {
    fontFamily: fonts.sans,
    fontWeight: '600',
    fontSize: 12.5,
    color: colors.inkSoft,
  },
  partyAddress: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.inkSoft,
  },
  tableContainer: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    marginBottom: 4,
  },
  thCell: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EFEA',
    alignItems: 'center',
  },
  tdCell: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.ink,
  },
  monoText: {
    fontFamily: fonts.mono,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E1DFD5',
    borderBottomWidth: 1,
    borderBottomColor: '#E1DFD5',
    marginVertical: spacing.sm,
  },
  summaryItem: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
  },
  summaryLabel: {
    color: colors.inkFaint,
    fontFamily: fonts.sans,
  },
  summaryValue: {
    fontFamily: fonts.sans,
    fontWeight: '700',
    color: colors.ink,
  },
  signaturesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  sigCol: {
    flex: 1,
    gap: 8,
  },
  sigEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sigLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    marginTop: 32,
    marginBottom: 4,
  },
  sigSubLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkFaint,
  },
  sigClientMeta: {
    gap: 4,
  },
  sigMetaLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkFaint,
  },
  sigMetaValue: {
    fontFamily: fonts.sans,
    fontWeight: '600',
    color: colors.ink,
  },
});
