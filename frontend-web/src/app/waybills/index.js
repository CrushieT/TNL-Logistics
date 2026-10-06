import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import AppShell from '../../components/layout/AppShell';
import PageHeader from '../../components/layout/PageHeader';
import { WaybillManifestCard, SearchableShipmentDropdown, getWaybillShipmentOptions, getWaybillManifest, getWaybillByNumber } from '../../features/waybills';
import { colors, spacing } from '../../theme';
import {
  buildWaybillPrintHtml,
  getRenderedWaybillLogoUri
} from '../../features/waybills/services/waybillPrint.mjs';

export default function WaybillsScreen() {
  const [shipments, setShipments] = useState([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [waybills, setWaybills] = useState([]);
  const [selectedWaybillId, setSelectedWaybillId] = useState('');
  const [numberSearch, setNumberSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadShipments = useCallback(async () => {
    try {
      setShipments(await getWaybillShipmentOptions());
    } catch {
      setMessage('Could not load shipments.');
    }
  }, []);

  useEffect(() => { loadShipments(); }, [loadShipments]);

  const selectShipment = async (shipmentId) => {
    setSelectedShipmentId(shipmentId);
    setSelectedWaybillId('');
    setMessage('');
    setLoading(true);
    try {
      const records = await getWaybillManifest(shipmentId);
      setWaybills(records);
      setSelectedWaybillId(records[0]?.waybillId || '');
    } catch {
      setWaybills([]);
      setMessage('Could not load waybills for this shipment.');
    } finally {
      setLoading(false);
    }
  };

  const searchNumber = async () => {
    const number = numberSearch.trim();
    if (!number) return;
    setLoading(true);
    setMessage('');
    try {
      const record = await getWaybillByNumber(number);
      await selectShipment(record.shipmentId);
      setSelectedWaybillId(record.waybillId);
    } catch {
      setMessage('Waybill number not found.');
    } finally {
      setLoading(false);
    }
  };

  const selected = waybills.find((waybill) => waybill.waybillId === selectedWaybillId);
  const selectedShipment = shipments.find((shipment) => shipment.shipmentId === selectedShipmentId);

  const printSelected = () => {
    if (!selected || typeof document === 'undefined') return;
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
    document.body.appendChild(frame);
    const printDocument = frame.contentDocument;
    printDocument.open();
    const logoUri = getRenderedWaybillLogoUri(document);
    printDocument.write(buildWaybillPrintHtml(selected, logoUri));
    printDocument.close();
    setTimeout(() => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => frame.remove(), 60000);
    }, 300);
  };

  return (
    <AppShell activeTab="waybills">
      <View style={styles.container}>
        <PageHeader eyebrow="BILLING & FINANCE" title="Waybills" />
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <View style={styles.controls}>
          <SearchableShipmentDropdown shipments={shipments} selectedShipmentId={selectedShipmentId}
            onSelectShipment={selectShipment} loading={loading} />
          <TextInput style={styles.input} value={numberSearch} onChangeText={setNumberSearch}
            placeholder="Exact waybill number" onSubmitEditing={searchNumber} />
          <Pressable style={styles.button} onPress={searchNumber}><Text style={styles.buttonText}>Find</Text></Pressable>
        </View>
        {selectedShipmentId ? (
          <View style={styles.section}>
            <Text style={styles.heading}>{selectedShipmentId}</Text>
            <Text>{selectedShipment?.waybillStatus || ''}</Text>
            {waybills.length === 0
              ? <Text>No waybills have been generated for this shipment.</Text>
              : waybills.map((waybill) => (
                <Pressable key={waybill.waybillId} style={[styles.row, selectedWaybillId === waybill.waybillId && styles.selected]}
                  onPress={() => setSelectedWaybillId(waybill.waybillId)}>
                  <Text style={styles.rowTitle}>{waybill.waybillId}</Text>
                  <Text>{waybill.statusLabel} · {waybill.parcels.length} units</Text>
                </Pressable>
              ))}
          </View>
        ) : null}
        {selected ? (
          <View style={styles.section}>
            <View style={styles.printHeader}>
              <View style={styles.printSummary}>
                <Text style={styles.heading}>Printable waybill preview</Text>
                <Text style={styles.previewHint}>
                  Printing creates two identical landscape A4 copies with the return confirmation QR shown below.
                </Text>
              </View>
              <Pressable style={styles.button} onPress={printSelected}>
                <Text style={styles.buttonText}>Print two A4 copies</Text>
              </Pressable>
            </View>
            <WaybillManifestCard manifest={selected} />
          </View>
        ) : null}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  input: { minWidth: 200, padding: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF' },
  button: { alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 16, backgroundColor: colors.ink },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  section: { gap: spacing.sm, backgroundColor: '#FFFFFF', padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  printHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  printSummary: { flex: 1, minWidth: 260, gap: 4 },
  previewHint: { color: colors.inkSoft, fontSize: 12 },
  heading: { fontSize: 16, fontWeight: '700', color: colors.ink },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderWidth: 1, borderColor: colors.border },
  rowTitle: { fontWeight: '700', color: colors.ink },
  selected: { borderColor: colors.accent },
  message: { color: colors.danger },
});
