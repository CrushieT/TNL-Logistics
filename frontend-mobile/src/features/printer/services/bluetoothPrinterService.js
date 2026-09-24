import { Platform } from 'react-native';
import * as secureStore from '../../../services/storage/secureStore';

const STORAGE_KEY_PAIRED_PRINTER = 'tnl_paired_printer';
const STORAGE_KEY_VIRTUAL_MODE = 'tnl_virtual_printer_mode';

export class PrinterTransportError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PrinterTransportError';
    this.code = code;
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

export class VirtualPrinterDriver {
  async connect(device = VIRTUAL_PRINTERS[0]) {
    return { ...device, status: 'SIMULATION', connectedAt: new Date().toISOString() };
  }

  async disconnect() {}

  async scanDevices() {
    return VIRTUAL_PRINTERS;
  }

  async printLabel(bytes, metadata) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { success: true, virtual: true, byteCount: bytes.length, metadata };
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
    const rawResult = await this.nativeModule.BluetoothManager.scanDevices();
    const result = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;
    const paired = Array.isArray(result?.paired) ? result.paired : [];
    const found = Array.isArray(result?.found) ? result.found : [];
    return [...paired, ...found].map((device) => ({ ...device, type: 'BLUETOOTH', status: 'AVAILABLE' }));
  }

  async connect(device) {
    this.assertAvailable();
    await this.nativeModule.BluetoothManager.connect(device.address);
    return { ...device, type: 'BLUETOOTH', status: 'CONNECTED', connectedAt: new Date().toISOString() };
  }

  async disconnect(device) {
    if (this.nativeModule?.BluetoothManager?.disconnect && device?.address) {
      await this.nativeModule.BluetoothManager.disconnect(device.address);
    }
  }

  async printLabel() {
    throw new PrinterTransportError(
      'TRANSPORT_UNAVAILABLE',
      'Physical Brother RJ-2035B transmission is deferred until Phase 6.3b hardware validation.'
    );
  }

  getStatus() {
    return this.nativeModule?.BluetoothManager ? 'AVAILABLE_UNVALIDATED' : 'TRANSPORT_UNAVAILABLE';
  }
}

class BluetoothPrinterService {
  constructor() {
    this.connectedDevice = null;
    this.rememberedDevice = null;
    this.isVirtualMode = true;
    this.printHistory = [];
    this.virtualDriver = new VirtualPrinterDriver();
    this.bluetoothDriver = new EscposBluetoothDriver();
  }

  async initialize() {
    const savedVirtualMode = await secureStore.getItem(STORAGE_KEY_VIRTUAL_MODE);
    this.isVirtualMode = savedVirtualMode === null ? true : savedVirtualMode === 'true';
    const savedPrinterJson = await secureStore.getItem(STORAGE_KEY_PAIRED_PRINTER);
    this.rememberedDevice = savedPrinterJson ? JSON.parse(savedPrinterJson) : null;

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
    const driver = device.type === 'VIRTUAL' ? this.virtualDriver : this.bluetoothDriver;
    if (device.type === 'VIRTUAL' && !this.isVirtualMode) {
      throw new PrinterTransportError('TRANSPORT_UNAVAILABLE', 'Enable virtual mode to use a simulated printer.');
    }
    const connectedDevice = await driver.connect(device);
    this.connectedDevice = connectedDevice;
    this.rememberedDevice = connectedDevice;
    await secureStore.setItem(STORAGE_KEY_PAIRED_PRINTER, JSON.stringify(connectedDevice));
    return connectedDevice;
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
