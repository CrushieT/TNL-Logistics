import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { bluetoothPrinterService, VIRTUAL_PRINTERS } from '../services/bluetoothPrinterService';
import { normalizeLabelData } from '../services/thermalLabelData';
import { buildEscPosCommands } from '../services/escposFormatter';
import { shipmentApi } from '../../shipments/services/shipmentApi';

const PrinterContext = createContext(null);

export function PrinterProvider({ children }) {
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [isVirtualMode, setIsVirtualMode] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [availableDevices, setAvailableDevices] = useState(VIRTUAL_PRINTERS);
  const [isPrinting, setIsPrinting] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewLabelData, setPreviewLabelData] = useState(null);

  // Initialize saved printer connection
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const saved = await bluetoothPrinterService.initialize();
      if (isMounted) {
        setConnectedDevice(saved);
        setIsVirtualMode(bluetoothPrinterService.isVirtualMode);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

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
    setIsVirtualMode(enabled);
    setConnectedDevice(bluetoothPrinterService.getConnectedDevice());
  }, []);

  /**
   * High-level print function:
   * 1. Normalizes parcel unit and shipment data.
   * 2. Formats ESC/POS binary stream.
   * 3. Transmits to physical Bluetooth socket or virtual driver.
   * 4. Synchronizes backend audit record via shipmentApi.printLabels.
   */
  const printParcelLabels = useCallback(
    async (shipment, unitsToPrint = null) => {
      const units = unitsToPrint || shipment.units || (shipment.trackingIds || []).map((id, idx) => ({ trackingId: id, packageIndex: idx + 1 }));
      const totalUnits = units.length || 1;

      setIsPrinting(true);
      const printResults = [];
      const printedTrackingIds = [];

      try {
        for (let i = 0; i < units.length; i++) {
          const unit = units[i];
          const labelData = normalizeLabelData(shipment, unit, i, totalUnits);
          const bytes = buildEscPosCommands(labelData);

          const result = await bluetoothPrinterService.printRaw(bytes, {
            trackingId: labelData.trackingId,
            shipmentId: labelData.shipmentId,
          });

          printResults.push(result);
          printedTrackingIds.push(labelData.trackingId);
        }

        // Synchronize backend print audit
        if (shipment.shipmentId && printedTrackingIds.length > 0) {
          try {
            await shipmentApi.printLabels(shipment.shipmentId, printedTrackingIds);
          } catch (auditErr) {
            console.warn('Backend print audit sync notice:', auditErr?.message);
          }
        }

        return {
          success: true,
          count: printResults.length,
          printedTrackingIds,
          device: connectedDevice?.name || 'Virtual Thermal Printer',
        };
      } finally {
        setIsPrinting(false);
      }
    },
    [connectedDevice]
  );

  const openPreview = useCallback((labelData) => {
    setPreviewLabelData(labelData);
    setPreviewModalVisible(true);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewModalVisible(false);
    setPreviewLabelData(null);
  }, []);

  const value = {
    isConnected: Boolean(connectedDevice),
    connectedDevice,
    isVirtualMode,
    isScanning,
    availableDevices,
    isPrinting,
    previewModalVisible,
    previewLabelData,
    scanDevices,
    connectPrinter,
    disconnectPrinter,
    toggleVirtualMode,
    printParcelLabels,
    openPreview,
    closePreview,
  };

  return <PrinterContext.Provider value={value}>{children}</PrinterContext.Provider>;
}

export function usePrinter() {
  const context = useContext(PrinterContext);
  if (!context) {
    throw new Error('usePrinter must be used within a PrinterProvider');
  }
  return context;
}
