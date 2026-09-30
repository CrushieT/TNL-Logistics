import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { fonts } from '../../../theme';
import PrintableReportDocument from './PrintableReportDocument';
import { buildReportPrintUrl } from '../utils/reportPrintModel.mjs';

export default function PrintableReportModal({ visible, onClose, reportData, startDate, endDate }) {
  const [printError, setPrintError] = useState(null);

  if (!visible || !reportData) return null;

  const handleBrowserPrint = () => {
    if (typeof window === 'undefined') return;

    setPrintError(null);
    const printWindow = window.open(buildReportPrintUrl(startDate, endDate), '_blank');
    if (!printWindow) {
      setPrintError('The print tab was blocked. Allow pop-ups for this site, then try again.');
      return;
    }

    printWindow.opener = null;
  };

  const handleClose = () => {
    setPrintError(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <View nativeID="report-print-backdrop" style={styles.backdrop}>
        <View nativeID="report-print-toolbar" style={styles.actionToolbar}>
          <TouchableOpacity style={styles.printActionBtn} onPress={handleBrowserPrint} activeOpacity={0.8}>
            <Text style={styles.printActionText}>Print Document (A4)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.8}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>

        {printError ? <Text style={styles.printError}>{printError}</Text> : null}

        <ScrollView
          nativeID="report-print-scroll"
          style={styles.previewScroll}
          contentContainerStyle={styles.scrollWrapper}
          showsVerticalScrollIndicator
          showsHorizontalScrollIndicator
        >
          <PrintableReportDocument
            reportData={reportData}
            startDate={startDate}
            endDate={endDate}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    padding: 16,
  },
  actionToolbar: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  printActionBtn: {
    backgroundColor: '#111827',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 6,
  },
  printActionText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  closeText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
  },
  printError: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: '#991B1B',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  previewScroll: {
    flex: 1,
    width: '100%',
  },
  scrollWrapper: {
    alignItems: 'center',
    paddingBottom: 40,
  },
});
