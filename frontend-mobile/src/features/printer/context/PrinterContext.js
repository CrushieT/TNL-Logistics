import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Crypto from 'expo-crypto';
import { bluetoothPrinterService, VIRTUAL_PRINTERS } from '../services/bluetoothPrinterService';
import { normalizeLabelData, resolveCurrentLabelBranding } from '../services/thermalLabelData';
import { buildEscPosCommands } from '../services/escposFormatter';
import { buildTsplOptions } from '../services/tsplFormatter';
import { shipmentApi } from '../../shipments/services/shipmentApi';
import { useAuth } from '../../auth/context/AuthContext';
import { apiClient } from '../../../services/api/client';
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
  const { user, isAuthenticated } = useAuth();
  const ownerUserId = user?.userId;
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [rememberedDevice, setRememberedDevice] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [autoReconnectEnabled, setAutoReconnectEnabled] = useState(false);
  const lifecycleRef = useRef(0);
  const appStateRef = useRef(AppState.currentState);
  const initializedRef = useRef(false);
  const sessionCleanupRef = useRef(Promise.resolve());
  const [branding, setBranding] = useState(null);
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [brandingError, setBrandingError] = useState(null);
  const [isVirtualMode, setIsVirtualMode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanNotice, setScanNotice] = useState(null);
  const scanGenerationRef = useRef(0);
  const isScanningRef = useRef(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [pendingAuditCount, setPendingAuditCount] = useState(0);

  const fetchBranding = useCallback(async () => {
    if (!ownerUserId) {
      setBranding(null);
      setBrandingError(null);
      return null;
    }
    setBrandingLoading(true);
    setBrandingError(null);
    try {
      const { data } = await apiClient.get('/settings/branding');
      if (typeof data?.companyName === 'string' && data.companyName.trim()) {
        setBranding(data);
        setBrandingLoading(false);
        return data;
      }
      throw new Error('Company branding payload is invalid.');
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Unable to retrieve company branding.';
      setBranding(null);
      setBrandingLoading(false);
      setBrandingError(message);
      throw new Error(message);
    }
  }, [ownerUserId]);

  useEffect(() => {
    fetchBranding().catch(() => {});
  }, [fetchBranding]);

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

  const refreshConnection = useCallback(() => {
    setConnectedDevice(bluetoothPrinterService.getConnectedDevice());
    setRememberedDevice(bluetoothPrinterService.getRememberedDevice());
    setAutoReconnectEnabled(bluetoothPrinterService.autoReconnectEnabled);
  }, []);

  const runConnection = useCallback(async (device, automatic = false) => {
    const lifecycle = lifecycleRef.current;
    setIsConnecting(true);
    setConnectionError(null);
    try {
      const connected = await bluetoothPrinterService.connect(device, { automatic });
      if (lifecycle === lifecycleRef.current) setConnectionError(null);
      return connected;
    } catch (error) {
      if (lifecycle === lifecycleRef.current && error?.code !== 'CANCELLED') {
        setConnectionError(error?.message || 'Unable to connect. Check the printer and tap Reconnect.');
      }
      throw error;
    } finally {
      if (lifecycle === lifecycleRef.current) {
        setIsConnecting(Boolean(bluetoothPrinterService.pendingConnection));
        refreshConnection();
      }
    }
  }, [refreshConnection]);

  useEffect(() => {
    const lifecycle = ++lifecycleRef.current;
    initializedRef.current = false;
    const isCurrent = () => lifecycle === lifecycleRef.current;
    const reconnectAutomatically = () => {
      const service = bluetoothPrinterService;
      if (!isCurrent() || !initializedRef.current || !isAuthenticated || !ownerUserId || appStateRef.current !== 'active'
        || !service.autoReconnectEnabled || service.isVirtualMode || service.isConnected()
        || isScanningRef.current || service.isScanning || service.pendingConnection || service.controlOperation
        || service.isPrinting || service.isTransmitting) return;
      const saved = service.getRememberedDevice();
      if (saved?.type === 'BLUETOOTH') runConnection(saved, true).catch(() => {});
    };
    const lostSubscription = bluetoothPrinterService.observeConnectionLoss(() => {
      if (!isCurrent()) return;
      refreshConnection();
      setConnectionError('Printer connection lost. Check the printer and tap Reconnect.');
    });
    const appSubscription = AppState.addEventListener('change', (state) => {
      const previousState = appStateRef.current;
      appStateRef.current = state;
      if (state !== 'active') {
        bluetoothPrinterService.cancelPendingConnection({ automaticOnly: true }).catch(() => {});
      } else if (previousState !== 'active') reconnectAutomatically();
    });
    Promise.all([bluetoothPrinterService.initialize(), sessionCleanupRef.current]).then(() => {
      if (!isCurrent()) return;
      initializedRef.current = true;
      refreshConnection();
      setIsConnecting(false);
      setConnectionError(null);
      setIsVirtualMode(bluetoothPrinterService.isVirtualMode);
      setAvailableDevices(bluetoothPrinterService.isVirtualMode ? VIRTUAL_PRINTERS : []);
      reconnectAutomatically();
    }).catch((error) => {
      if (isCurrent()) setConnectionError(error?.message || 'Unable to restore the saved printer.');
    });
    return () => {
      lifecycleRef.current += 1;
      initializedRef.current = false;
      lostSubscription.remove();
      appSubscription.remove();
      sessionCleanupRef.current = bluetoothPrinterService.cancelPendingConnection();
    };
  }, [isAuthenticated, ownerUserId, refreshConnection, runConnection]);

  useEffect(() => {
    retryPendingAudits();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') retryPendingAudits();
    });
    return () => subscription.remove();
  }, [retryPendingAudits]);

  const scanDevices = useCallback(async () => {
    if (isScanningRef.current) throw new Error('A printer scan is already in progress.');
    isScanningRef.current = true;
    const scanGeneration = ++scanGenerationRef.current;
    setScanNotice(null);
    setIsScanning(true);
    try {
      const { devices, discoveryStatus } = await bluetoothPrinterService.scanDevices();
      if (scanGeneration === scanGenerationRef.current) {
        setAvailableDevices(devices);
        setScanNotice(discoveryStatus === 'paired_only' ? 'Discovery unavailable; showing paired devices.' : null);
      }
      return devices;
    } finally {
      isScanningRef.current = false;
      setIsScanning(false);
    }
  }, []);

  const connectPrinter = useCallback(async (device) => {
    if (!isAuthenticated || !ownerUserId) throw new Error('Sign in before connecting a printer.');
    const lifecycle = lifecycleRef.current;
    await Promise.all([bluetoothPrinterService.initialize(), sessionCleanupRef.current]);
    if (lifecycle !== lifecycleRef.current) throw new Error('The signed-in session changed. Reconnect again.');
    return runConnection(device);
  }, [isAuthenticated, ownerUserId, runConnection]);

  const reconnectPrinter = useCallback(() => connectPrinter(bluetoothPrinterService.getRememberedDevice()), [connectPrinter]);

  const disconnectPrinter = useCallback(async () => {
    try {
      await bluetoothPrinterService.disconnect();
      setConnectionError(null);
    } finally {
      refreshConnection();
    }
  }, [refreshConnection]);

  const forgetPrinter = useCallback(async () => {
    try {
      await bluetoothPrinterService.forgetPrinter();
      setConnectionError(null);
      setAvailableDevices([]);
    } finally {
      refreshConnection();
    }
  }, [refreshConnection]);

  const toggleVirtualMode = useCallback(async (enabled) => {
    scanGenerationRef.current += 1;
    setScanNotice(null);
    await bluetoothPrinterService.setVirtualMode(enabled);
    setIsVirtualMode(Boolean(enabled));
    refreshConnection();
    setAvailableDevices(enabled ? VIRTUAL_PRINTERS : []);
  }, [refreshConnection]);

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

      if (bluetoothPrinterService.pendingConnection || bluetoothPrinterService.controlOperation) {
        throw new Error('Wait for the printer connection to finish before printing.');
      }
      bluetoothPrinterService.isPrinting = true;
      setIsPrinting(true);

      try {
        if (shouldAudit) await assertCanRecordPrintAudit();
        const resolvedBranding = await resolveCurrentLabelBranding(fetchBranding);

        for (let index = 0; index < units.length; index += 1) {
          const unit = units[index];
          try {
            const labelData = normalizeLabelData(shipment, unit, index, units.length);
            const printPayload = isVirtual
              ? buildEscPosCommands(labelData, resolvedBranding)
              : buildTsplOptions(labelData, resolvedBranding);

            await bluetoothPrinterService.printRaw(printPayload, {
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
        bluetoothPrinterService.isPrinting = false;
        setIsPrinting(false);
      }
    });
  }, [assertCanRecordPrintAudit, auditTrackingIds, connectedDevice, fetchBranding]);

  return (
    <PrinterContext.Provider value={{
      isConnected: Boolean(connectedDevice), connectedDevice, isVirtualMode, isScanning, isConnecting,
      rememberedDevice, connectionError, autoReconnectEnabled, reconnectPrinter, forgetPrinter,
      availableDevices, scanNotice, isPrinting, pendingAuditCount, scanDevices, connectPrinter,
      disconnectPrinter, toggleVirtualMode, printParcelLabels, confirmSystemPrint,
      retryPendingAudits, assertCanRecordPrintAudit, branding, brandingLoading,
      brandingError, fetchBranding,
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
