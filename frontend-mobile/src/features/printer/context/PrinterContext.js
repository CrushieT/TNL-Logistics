import React, { createContext, useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Crypto from 'expo-crypto';
import { bluetoothPrinterService, VIRTUAL_PRINTERS } from '../services/bluetoothPrinterService';
import { normalizeLabelData } from '../services/thermalLabelData';
import { buildEscPosCommands } from '../services/escposFormatter';
import { shipmentApi } from '../../shipments/services/shipmentApi';
import { useAuth } from '../../auth/context/AuthContext';
import {
  assertPrintAuditCapacityAvailable,
  getPendingCount,
  getPendingPrintAudits,
  syncPrintAuditEntry,
} from '../services/printAuditOutbox';

const PrinterContext = createContext(null);
let serializedQueue = Promise.resolve();
const activeJobs = new Map();

function enqueueSerialized(jobId, operation) {
  if (activeJobs.has(jobId)) return activeJobs.get(jobId);
  const queuedOperation = serializedQueue.then(operation, operation);
  serializedQueue = queuedOperation.catch(() => undefined);
  activeJobs.set(jobId, queuedOperation);
  queuedOperation.then(
    () => activeJobs.delete(jobId),
    () => activeJobs.delete(jobId)
  );
  return queuedOperation;
}

export function PrinterProvider({ children }) {
  const { user } = useAuth();
  const ownerUserId = user?.userId;
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [isVirtualMode, setIsVirtualMode] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [availableDevices, setAvailableDevices] = useState(VIRTUAL_PRINTERS);
  const [isPrinting, setIsPrinting] = useState(false);
  const [pendingAuditCount, setPendingAuditCount] = useState(0);

  const syncAuditEntry = useCallback(async (entry) => {
    return syncPrintAuditEntry({
      entry,
      sendAudit: (auditEntry) => shipmentApi.printLabels(
        auditEntry.shipmentId,
        auditEntry.trackingIds,
        auditEntry.printJobId,
        auditEntry.printerId
      ),
    });
  }, []);

  const retryPendingAudits = useCallback(async () => {
    if (!ownerUserId) return [];
    const entries = await getPendingPrintAudits(ownerUserId);
    const results = [];
    for (const entry of entries) results.push(await syncAuditEntry(entry));
    setPendingAuditCount(await getPendingCount(ownerUserId));
    return results;
  }, [ownerUserId, syncAuditEntry]);

  useEffect(() => {
    let isMounted = true;
    bluetoothPrinterService.initialize().then((savedDevice) => {
      if (!isMounted) return;
      setConnectedDevice(savedDevice);
      setIsVirtualMode(bluetoothPrinterService.isVirtualMode);
      setAvailableDevices(bluetoothPrinterService.isVirtualMode ? VIRTUAL_PRINTERS : []);
    });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    retryPendingAudits();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') retryPendingAudits();
    });
    return () => subscription.remove();
  }, [retryPendingAudits]);

  const scanDevices = useCallback(async () => {
    setIsScanning(true);
    try {
      const devices = await bluetoothPrinterService.scanDevices();
      setAvailableDevices(devices);
      return devices;
    } finally {
      setIsScanning(false);
    }
  }, []);

  const connectPrinter = useCallback(async (device) => {
    const connected = await bluetoothPrinterService.connect(device);
    setConnectedDevice(connected);
    return connected;
  }, []);

  const disconnectPrinter = useCallback(async () => {
    await bluetoothPrinterService.disconnect();
    setConnectedDevice(null);
  }, []);

  const toggleVirtualMode = useCallback(async (enabled) => {
    await bluetoothPrinterService.setVirtualMode(enabled);
    setIsVirtualMode(Boolean(enabled));
    setConnectedDevice(bluetoothPrinterService.getConnectedDevice());
    setAvailableDevices(enabled ? VIRTUAL_PRINTERS : []);
  }, []);

  const auditTrackingIds = useCallback(async ({ printJobId, shipmentId, trackingIds, printerId }) => {
    if (!ownerUserId) return 'FAILED';
    const status = await syncAuditEntry({
      printJobId,
      ownerUserId,
      shipmentId,
      trackingIds,
      printerId,
      status: 'PENDING',
    });
    setPendingAuditCount(await getPendingCount(ownerUserId));
    return status;
  }, [ownerUserId, syncAuditEntry]);

  const assertCanRecordPrintAudit = useCallback(async () => {
    if (!ownerUserId) throw new Error('Sign in before printing parcel labels.');
    return assertPrintAuditCapacityAvailable();
  }, [ownerUserId]);

  const confirmSystemPrint = useCallback(async ({ printJobId, shipmentId, trackingIds }) =>
    auditTrackingIds({ printJobId, shipmentId, trackingIds, printerId: 'SYSTEM-PDF' }), [auditTrackingIds]);

  const printParcelLabels = useCallback((shipment, unitsToPrint = null, options = {}) => {
    const jobId = options.jobId || Crypto.randomUUID();
    return enqueueSerialized(jobId, async () => {
      const units = unitsToPrint || shipment.units || [];
      if (units.length === 0) throw new Error('No parcel units are available for printing.');

      const transmittedTrackingIds = [];
      const failedTrackingIds = [];
      const notAttemptedTrackingIds = [];
      let failureReason = null;
      const isVirtual = connectedDevice?.type === 'VIRTUAL' || bluetoothPrinterService.isVirtualMode;
      const shouldAudit = !isVirtual && options.auditMode !== 'NONE';

      if (shouldAudit) await assertCanRecordPrintAudit();
      setIsPrinting(true);

      try {
        for (let index = 0; index < units.length; index += 1) {
          const unit = units[index];
          try {
            const labelData = normalizeLabelData(shipment, unit, index, units.length);
            await bluetoothPrinterService.printRaw(buildEscPosCommands(labelData), {
              jobId,
              trackingId: labelData.trackingId,
              shipmentId: labelData.shipmentId,
              auditMode: options.auditMode || 'PHYSICAL',
            });
            transmittedTrackingIds.push(labelData.trackingId);
          } catch (error) {
            failedTrackingIds.push(unit.trackingId);
            notAttemptedTrackingIds.push(...units.slice(index + 1).map((item) => item.trackingId));
            failureReason = error?.code || error?.message || 'PRINT_FAILED';
            break;
          }
        }

        let auditSyncStatus = 'SKIPPED';
        if (shouldAudit && transmittedTrackingIds.length > 0) {
          auditSyncStatus = await auditTrackingIds({
            printJobId: jobId,
            shipmentId: shipment.shipmentId,
            trackingIds: transmittedTrackingIds,
            printerId: (connectedDevice?.address || 'BLUETOOTH').slice(0, 20),
          });
        }

        return {
          jobId,
          transport: isVirtual ? 'VIRTUAL' : 'BLUETOOTH',
          totalRequested: units.length,
          transmittedTrackingIds,
          failedTrackingIds,
          notAttemptedTrackingIds,
          failureReason,
          isVirtual,
          auditSyncStatus,
          success: failedTrackingIds.length === 0,
          count: transmittedTrackingIds.length,
          device: connectedDevice?.name || null,
        };
      } finally {
        setIsPrinting(false);
      }
    });
  }, [assertCanRecordPrintAudit, auditTrackingIds, connectedDevice]);

  return (
    <PrinterContext.Provider value={{
      isConnected: Boolean(connectedDevice), connectedDevice, isVirtualMode, isScanning,
      availableDevices, isPrinting, pendingAuditCount, scanDevices, connectPrinter,
      disconnectPrinter, toggleVirtualMode, printParcelLabels, confirmSystemPrint,
      retryPendingAudits, assertCanRecordPrintAudit,
    }}>
      {children}
    </PrinterContext.Provider>
  );
}

export function usePrinter() {
  const context = React.useContext(PrinterContext);
  if (!context) throw new Error('usePrinter must be used within a PrinterProvider');
  return context;
}
