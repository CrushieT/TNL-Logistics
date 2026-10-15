import { PermissionsAndroid, Platform } from 'react-native';
import * as secureStore from '../../../services/storage/secureStore';

const STORAGE_KEY_PAIRED_PRINTER = 'tnl_paired_printer';
const STORAGE_KEY_VIRTUAL_MODE = 'tnl_virtual_printer_mode';
export const IS_VIRTUAL_PRINTER_ENABLED = __DEV__;

export class PrinterTransportError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PrinterTransportError';
    this.code = code;
  }
}

function assertVirtualPrinterEnabled() {
  if (!IS_VIRTUAL_PRINTER_ENABLED) {
    throw new PrinterTransportError('SIMULATION_DISABLED', 'Virtual printing is available only in development builds.');
  }
}

export const VIRTUAL_PRINTERS = [{
  name: 'Virtual Brother RJ-2035B',
  address: 'VIRTUAL:BR-RJ2035B-01',
  type: 'VIRTUAL',
  paperWidth: '58mm',
  status: 'SIMULATION',
}];

function loadNativeModule() {
  if (Platform.OS === 'web') return null;
  try {
    return require('react-native-bluetooth-escpos-printer');
  } catch {
    return null;
  }
}

async function requestBluetoothPermissions() {
  if (Platform.OS !== 'android') return true;

  try {
    const apiLevel = Platform.Version;
    if (apiLevel >= 31) {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ];
      const results = await PermissionsAndroid.requestMultiple(permissions);
      const allGranted = permissions.every(
        (perm) => results[perm] === PermissionsAndroid.RESULTS.GRANTED
      );
      return allGranted;
    }

    // Android 11 and lower requires location permission for Bluetooth discovery
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Bluetooth Printer Permission',
        message: 'Allow TC & CT Staff App to discover and connect to your thermal label printer.',
        buttonPositive: 'Allow',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export class VirtualPrinterDriver {
  async connect(device = VIRTUAL_PRINTERS[0]) {
    assertVirtualPrinterEnabled();
    return { ...device, status: 'SIMULATION', connectedAt: new Date().toISOString() };
  }

  async disconnect() {}

  async scanDevices() {
    assertVirtualPrinterEnabled();
    return VIRTUAL_PRINTERS;
  }

  async printLabel(bytes, metadata) {
    assertVirtualPrinterEnabled();
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { success: true, virtual: true, byteCount: bytes?.length || 0, metadata };
  }

  getStatus() {
    return 'SIMULATION';
  }
}

export class EscposBluetoothDriver {
  constructor() {
    this.nativeModule = loadNativeModule();
  }

  assertAvailable() {
    if (!this.nativeModule?.BluetoothManager) {
      throw new PrinterTransportError(
        'TRANSPORT_UNAVAILABLE',
        'Bluetooth printing requires an Expo development build with the native printer bridge.'
      );
    }
  }

  async scanDevices() {
    this.assertAvailable();
    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
      throw new PrinterTransportError(
        'PERMISSION_DENIED',
        'Nearby devices permission is required to scan and connect to Bluetooth printers.'
      );
    }

    const rawResult = await this.nativeModule.BluetoothManager.scanDevices();
    const result = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;
    const paired = Array.isArray(result?.paired) ? result.paired : [];
    const found = Array.isArray(result?.found) ? result.found : [];
    return [...paired, ...found].map((device) => ({ ...device, type: 'BLUETOOTH', status: 'AVAILABLE' }));
  }

  async connect(device) {
    this.assertAvailable();
    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
      throw new PrinterTransportError(
        'PERMISSION_DENIED',
        'Nearby devices permission is required to connect to Bluetooth printers.'
      );
    }

    try {
      await this.nativeModule.BluetoothManager.connect(device.address);
    } catch (error) {
      if (error?.code !== 'Unable to connect device') throw error;
      // Allow the previous native socket to finish closing before one retry.
      await new Promise((resolve) => setTimeout(resolve, 500));
      await this.nativeModule.BluetoothManager.connect(device.address);
    }
    return { ...device, type: 'BLUETOOTH', status: 'CONNECTED', connectedAt: new Date().toISOString() };
  }

  async disconnect(device) {
    if (this.nativeModule?.BluetoothManager?.disconnect && device?.address) {
      await this.nativeModule.BluetoothManager.disconnect(device.address);
    }
  }

  async printLabel(payload, metadata) {
    this.assertAvailable();
    const { BluetoothTscPrinter, BluetoothEscposPrinter } = this.nativeModule;

    // Check if the payload is TSPL options (for XP-470B / XP-420B label printers)
    if (payload && typeof payload === 'object' && !(payload instanceof Uint8Array) && BluetoothTscPrinter?.printLabel) {
      await BluetoothTscPrinter.printLabel(payload);
      return { success: true, virtual: false, metadata };
    }

    // Fallback: ESC/POS raw bytes transmission (for Brother RJ-2035B)
    if (BluetoothEscposPrinter?.printRawData) {
      const base64 = typeof payload === 'string' ? payload : Buffer.from(payload).toString('base64');
      await BluetoothEscposPrinter.printRawData(base64);
      return { success: true, virtual: false, metadata };
    }

    throw new PrinterTransportError(
      'PRINT_FAILED',
      'The native printer module is unavailable for direct transmission.'
    );
  }

  getStatus() {
    return this.nativeModule?.BluetoothManager ? 'AVAILABLE' : 'TRANSPORT_UNAVAILABLE';
  }
}

class BluetoothPrinterService {
  constructor() {
    this.connectedDevice = null;
    this.rememberedDevice = null;
    this.pendingConnection = null;
    this.isVirtualMode = false;
    this.printHistory = [];
    this.virtualDriver = new VirtualPrinterDriver();
    this.bluetoothDriver = new EscposBluetoothDriver();
  }

  async initialize() {
    const savedVirtualMode = await secureStore.getItem(STORAGE_KEY_VIRTUAL_MODE);
    this.isVirtualMode = IS_VIRTUAL_PRINTER_ENABLED && savedVirtualMode === 'true';
    const savedPrinterJson = await secureStore.getItem(STORAGE_KEY_PAIRED_PRINTER);
    this.rememberedDevice = savedPrinterJson ? JSON.parse(savedPrinterJson) : null;
    if (!IS_VIRTUAL_PRINTER_ENABLED && this.rememberedDevice?.type === 'VIRTUAL') {
      this.rememberedDevice = null;
    }

    if (this.isVirtualMode) {
      this.connectedDevice = await this.virtualDriver.connect(
        this.rememberedDevice?.type === 'VIRTUAL' ? this.rememberedDevice : VIRTUAL_PRINTERS[0]
      );
    } else {
      this.connectedDevice = null;
    }
    return this.connectedDevice;
  }

  async setVirtualMode(enabled) {
    if (enabled) assertVirtualPrinterEnabled();
    if (this.connectedDevice) await this.disconnect();
    this.isVirtualMode = Boolean(enabled);
    await secureStore.setItem(STORAGE_KEY_VIRTUAL_MODE, String(this.isVirtualMode));
    if (this.isVirtualMode) this.connectedDevice = await this.connect(VIRTUAL_PRINTERS[0]);
  }

  async scanDevices() {
    return this.isVirtualMode
      ? this.virtualDriver.scanDevices()
      : this.bluetoothDriver.scanDevices();
  }

  async connect(device) {
    if (!device) throw new TypeError('No printer device specified');
    if (device.type === 'VIRTUAL') assertVirtualPrinterEnabled();
    if (this.pendingConnection) {
      if (this.pendingConnection.address === device.address && this.pendingConnection.type === device.type) {
        return this.pendingConnection.promise;
      }
      throw new PrinterTransportError('CONNECTION_IN_PROGRESS', 'Wait for the current printer connection to finish.');
    }
    const driver = device.type === 'VIRTUAL' ? this.virtualDriver : this.bluetoothDriver;
    if (device.type === 'VIRTUAL' && !this.isVirtualMode) {
      throw new PrinterTransportError('TRANSPORT_UNAVAILABLE', 'Enable virtual mode to use a simulated printer.');
    }
    const connectionPromise = (async () => {
      const connectedDevice = await driver.connect(device);
      this.connectedDevice = connectedDevice;
      this.rememberedDevice = connectedDevice;
      await secureStore.setItem(STORAGE_KEY_PAIRED_PRINTER, JSON.stringify(connectedDevice));
      return connectedDevice;
    })();
    this.pendingConnection = { address: device.address, type: device.type, promise: connectionPromise };
    try {
      return await connectionPromise;
    } finally {
      this.pendingConnection = null;
    }
  }

  async disconnect() {
    if (this.connectedDevice?.type === 'VIRTUAL') await this.virtualDriver.disconnect();
    else await this.bluetoothDriver.disconnect(this.connectedDevice);
    this.connectedDevice = null;
  }

  async printRaw(bytes, metadata = {}) {
    if (!this.connectedDevice) throw new PrinterTransportError('TRANSPORT_UNAVAILABLE', 'No printer is connected.');
    const driver = this.connectedDevice.type === 'VIRTUAL' ? this.virtualDriver : this.bluetoothDriver;
    const result = await driver.printLabel(bytes, metadata);
    this.printHistory.unshift({
      jobId: metadata.jobId,
      timestamp: new Date().toISOString(),
      device: this.connectedDevice.name,
      byteCount: bytes.length,
      metadata,
      isVirtual: Boolean(result.virtual),
    });
    this.printHistory = this.printHistory.slice(0, 50);
    return result;
  }

  getConnectedDevice() { return this.connectedDevice; }
  getRememberedDevice() { return this.rememberedDevice; }
  isConnected() { return Boolean(this.connectedDevice); }
  getPrintHistory() { return [...this.printHistory]; }
  getStatus() { return this.isVirtualMode ? this.virtualDriver.getStatus() : this.bluetoothDriver.getStatus(); }
}

export const bluetoothPrinterService = new BluetoothPrinterService();
