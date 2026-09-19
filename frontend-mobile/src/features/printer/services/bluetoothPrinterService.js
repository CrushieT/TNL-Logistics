/**
 * Bluetooth Printer Transport Service.
 * Provides transport abstraction for physical ESC/POS Bluetooth printers and
 * an in-app virtual simulated driver for development and offline testing.
 */

import { Platform } from 'react-native';
import * as secureStore from '../../../services/storage/secureStore';

const STORAGE_KEY_PAIRED_PRINTER = 'tnl_paired_printer';
const STORAGE_KEY_VIRTUAL_MODE = 'tnl_virtual_printer_mode';

// Simulated virtual printers available in dev/testing
export const VIRTUAL_PRINTERS = [
  {
    name: 'Virtual Brother RJ-2035B',
    address: 'VIRTUAL:BR-RJ2035B-01',
    type: 'VIRTUAL',
    paperWidth: '58mm',
    status: 'READY',
  },
  {
    name: 'Virtual POS-80 Mobile',
    address: 'VIRTUAL:POS80-02',
    type: 'VIRTUAL',
    paperWidth: '80mm',
    status: 'READY',
  },
];

class BluetoothPrinterService {
  constructor() {
    this.connectedDevice = null;
    this.isVirtualMode = true; // Default to true in dev/testing
    this.printHistory = [];
  }

  async initialize() {
    try {
      const savedVirtualMode = await secureStore.getItem(STORAGE_KEY_VIRTUAL_MODE);
      if (savedVirtualMode !== null) {
        this.isVirtualMode = savedVirtualMode === 'true';
      }

      const savedPrinterJson = await secureStore.getItem(STORAGE_KEY_PAIRED_PRINTER);
      if (savedPrinterJson) {
        const savedPrinter = JSON.parse(savedPrinterJson);
        // Auto-reconnect to saved device if virtual or remembered
        this.connectedDevice = savedPrinter;
      }
    } catch (err) {
      console.warn('PrinterService initialization fallback:', err);
    }
    return this.connectedDevice;
  }

  async setVirtualMode(enabled) {
    this.isVirtualMode = Boolean(enabled);
    await secureStore.setItem(STORAGE_KEY_VIRTUAL_MODE, String(this.isVirtualMode));
    if (this.isVirtualMode && !this.connectedDevice) {
      // Connect to default virtual printer
      await this.connect(VIRTUAL_PRINTERS[0]);
    }
  }

  async scanDevices() {
    if (this.isVirtualMode || Platform.OS === 'web') {
      // Simulate Bluetooth discovery scan with realistic latency
      await new Promise((resolve) => setTimeout(resolve, 400));
      return VIRTUAL_PRINTERS;
    }

    try {
      // Check if native bluetooth module is available
      const NativePrinter = require('react-native-bluetooth-escpos-printer')?.BluetoothManager;
      if (NativePrinter && typeof NativePrinter.scanDevices === 'function') {
        const result = await NativePrinter.scanDevices();
        const paired = (result?.paired || []).map((d) => ({ ...d, type: 'BLUETOOTH' }));
        const found = (result?.found || []).map((d) => ({ ...d, type: 'BLUETOOTH' }));
        return [...paired, ...found];
      }
    } catch (err) {
      console.warn('Native Bluetooth scan unavailable, returning virtual devices:', err.message);
    }

    return VIRTUAL_PRINTERS;
  }

  async connect(device) {
    if (!device) throw new Error('No printer device specified.');

    if (device.type === 'VIRTUAL' || this.isVirtualMode || Platform.OS === 'web') {
      await new Promise((resolve) => setTimeout(resolve, 300));
      this.connectedDevice = {
        ...device,
        connectedAt: new Date().toISOString(),
      };
      await secureStore.setItem(STORAGE_KEY_PAIRED_PRINTER, JSON.stringify(this.connectedDevice));
      return this.connectedDevice;
    }

    try {
      const NativePrinter = require('react-native-bluetooth-escpos-printer')?.BluetoothManager;
      if (NativePrinter && typeof NativePrinter.connect === 'function') {
        await NativePrinter.connect(device.address);
        this.connectedDevice = {
          ...device,
          connectedAt: new Date().toISOString(),
        };
        await secureStore.setItem(STORAGE_KEY_PAIRED_PRINTER, JSON.stringify(this.connectedDevice));
        return this.connectedDevice;
      }
    } catch (err) {
      throw new Error(`Failed to connect to Bluetooth printer: ${err.message || 'Connection refused'}`);
    }

    // Fallback to virtual connection
    this.connectedDevice = { ...device, connectedAt: new Date().toISOString() };
    await secureStore.setItem(STORAGE_KEY_PAIRED_PRINTER, JSON.stringify(this.connectedDevice));
    return this.connectedDevice;
  }

  async disconnect() {
    if (this.connectedDevice?.type === 'BLUETOOTH' && Platform.OS !== 'web') {
      try {
        const NativePrinter = require('react-native-bluetooth-escpos-printer')?.BluetoothManager;
        if (NativePrinter && typeof NativePrinter.disconnect === 'function') {
          await NativePrinter.disconnect(this.connectedDevice.address);
        }
      } catch (err) {
        console.warn('Native disconnect error:', err);
      }
    }

    this.connectedDevice = null;
    await secureStore.deleteItem(STORAGE_KEY_PAIRED_PRINTER);
    return true;
  }

  async printRaw(bytes, jobMeta = {}) {
    if (!this.connectedDevice) {
      throw new Error('No thermal printer connected.');
    }

    const jobRecord = {
      id: `JOB-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      device: this.connectedDevice.name,
      byteCount: bytes.length,
      meta: jobMeta,
    };

    if (this.connectedDevice.type === 'VIRTUAL' || this.isVirtualMode || Platform.OS === 'web') {
      // Simulate physical printing delay (approx 150ms per label)
      await new Promise((resolve) => setTimeout(resolve, 150));
      this.printHistory.unshift(jobRecord);
      if (this.printHistory.length > 50) this.printHistory.pop();
      return { success: true, jobId: jobRecord.id, virtual: true };
    }

    try {
      const NativePrinter = require('react-native-bluetooth-escpos-printer')?.BluetoothEscposPrinter;
      if (NativePrinter && typeof NativePrinter.printRawData === 'function') {
        // Base64 encode byte buffer for native bridge
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(bytes).toString('base64');
        await NativePrinter.printRawData(base64Data);
        this.printHistory.unshift(jobRecord);
        return { success: true, jobId: jobRecord.id, virtual: false };
      }
    } catch (err) {
      throw new Error(`Bluetooth transmission error: ${err.message || 'Write failed'}`);
    }

    this.printHistory.unshift(jobRecord);
    return { success: true, jobId: jobRecord.id, virtual: true };
  }

  getConnectedDevice() {
    return this.connectedDevice;
  }

  isConnected() {
    return Boolean(this.connectedDevice);
  }

  getPrintHistory() {
    return [...this.printHistory];
  }
}

export const bluetoothPrinterService = new BluetoothPrinterService();
