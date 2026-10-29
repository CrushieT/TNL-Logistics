import { DeviceEventEmitter, PermissionsAndroid, Platform } from 'react-native';
import * as secureStore from '../../../services/storage/secureStore';

const STORAGE_KEY_PAIRED_PRINTER = 'tnl_paired_printer';
const STORAGE_KEY_VIRTUAL_MODE = 'tnl_virtual_printer_mode';
const STORAGE_KEY_AUTO_RECONNECT = 'tnl_printer_auto_reconnect';
const CONNECTION_TIMEOUT_MS = 15000;
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

async function requestBluetoothPermissions(isDiscovery) {
  if (Platform.OS !== 'android') return true;

  try {
    const apiLevel = Platform.Version;
    if (apiLevel >= 31) {
      const permissions = isDiscovery
        ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
        : [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT];
      const results = await PermissionsAndroid.requestMultiple(permissions);
      const allGranted = permissions.every(
        (perm) => results[perm] === PermissionsAndroid.RESULTS.GRANTED
      );
      return allGranted;
    }

    if (!isDiscovery) return true;
    // Android 11 and lower requires location permission for Bluetooth discovery.
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Bluetooth Printer Permission',
        message: 'Allow TC & CT Staff App to discover your thermal label printer.',
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
    return { devices: VIRTUAL_PRINTERS, discoveryStatus: 'complete' };
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
    const hasPermission = await requestBluetoothPermissions(true);
    if (!hasPermission) {
      throw new PrinterTransportError(
        'PERMISSION_DENIED',
        Platform.Version >= 31
          ? 'Nearby devices permission is required to scan for Bluetooth printers.'
          : 'Location permission is required to discover Bluetooth printers on Android 11 and earlier.'
      );
    }

    const rawResult = await this.nativeModule.BluetoothManager.scanDevices();
    const result = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;
    const paired = Array.isArray(result?.paired) ? result.paired : [];
    const found = Array.isArray(result?.found) ? result.found : [];
    return {
      devices: [...paired, ...found].map((device) => ({ ...device, type: 'BLUETOOTH', status: 'AVAILABLE' })),
      discoveryStatus: result?.discoveryStarted === false ? 'paired_only' : 'complete',
    };
  }

  async connect(device, operation = {}) {
    this.assertAvailable();
    if (typeof this.nativeModule.BluetoothManager.disconnect !== 'function'
      || (operation.automatic && typeof this.nativeModule.BluetoothManager.isBluetoothEnabled !== 'function')) {
      throw new PrinterTransportError('TRANSPORT_UNAVAILABLE', 'Install the development build with Bluetooth connection controls to connect the printer.');
    }
    const hasPermission = operation.automatic && Platform.OS === 'android' && Platform.Version >= 31
      ? await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT)
      : operation.automatic || await requestBluetoothPermissions(false);
    if (!hasPermission) {
      throw new PrinterTransportError(
        'PERMISSION_DENIED',
        'Nearby devices permission is required to connect to Bluetooth printers.'
      );
    }

    operation.assertCurrent?.();
    if (operation.automatic && !await this.nativeModule.BluetoothManager.isBluetoothEnabled()) {
      throw new PrinterTransportError('BT NOT ENABLED', 'Turn on Bluetooth, then return to the app or tap Reconnect.');
    }
    operation.assertCurrent?.();

    try {
      operation.nativeStarted = true;
      await this.nativeModule.BluetoothManager.connect(device.address);
    } catch (error) {
      operation.assertCurrent?.();
      const isConnectFailure = error?.code === 'EVENT_UNABLE_CONNECT' || error?.code === 'Unable to connect device' || error?.message?.includes('Unable to connect');
      if (!isConnectFailure) throw error;
      // Allow the previous native socket to finish closing before one retry.
      await (operation.wait ? operation.wait(500) : new Promise((resolve) => setTimeout(resolve, 500)));
      operation.assertCurrent?.();
      await this.nativeModule.BluetoothManager.connect(device.address);
    }
    return { ...device, type: 'BLUETOOTH', status: 'CONNECTED', connectedAt: new Date().toISOString() };
  }

  async disconnect(device) {
    if (this.nativeModule?.BluetoothManager?.disconnect) {
      await this.nativeModule.BluetoothManager.disconnect(device?.address || '');
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
    this.autoReconnectEnabled = false;
    this.preferenceQueue = Promise.resolve();
    this.isPrinting = false;
    this.isTransmitting = false;
    this.isScanning = false;
    this.virtualDriver = new VirtualPrinterDriver();
    this.bluetoothDriver = new EscposBluetoothDriver();
  }

  initialize() {
    if (!this.initialization) this.initialization = this.restorePreference();
    return this.initialization;
  }

  async restorePreference() {
    try {
      const savedVirtualMode = await secureStore.getItem(STORAGE_KEY_VIRTUAL_MODE);
      this.isVirtualMode = IS_VIRTUAL_PRINTER_ENABLED && savedVirtualMode === 'true';
      const savedPrinterJson = await secureStore.getItem(STORAGE_KEY_PAIRED_PRINTER);
      const savedPrinter = savedPrinterJson ? JSON.parse(savedPrinterJson) : null;
      const isPhysical = savedPrinter && (savedPrinter.type === 'BLUETOOTH' || !savedPrinter.type)
        && typeof savedPrinter.address === 'string' && /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(savedPrinter.address);
      const isVirtual = IS_VIRTUAL_PRINTER_ENABLED && savedPrinter?.type === 'VIRTUAL'
        && typeof savedPrinter.address === 'string' && savedPrinter.address.startsWith('VIRTUAL:');
      if (isPhysical || isVirtual) {
        this.rememberedDevice = {
          ...savedPrinter, type: isVirtual ? 'VIRTUAL' : 'BLUETOOTH',
          name: typeof savedPrinter.name === 'string' && savedPrinter.name.trim() ? savedPrinter.name : 'Thermal printer',
        };
      }
      const savedEligibility = await secureStore.getItem(STORAGE_KEY_AUTO_RECONNECT);
      this.autoReconnectEnabled = Boolean(isPhysical) && (savedEligibility === null || savedEligibility === 'true');
    } catch {
      this.rememberedDevice = null;
      this.autoReconnectEnabled = false;
    }
    if (this.isVirtualMode) {
      this.connectedDevice = await this.virtualDriver.connect(
        this.rememberedDevice?.type === 'VIRTUAL' ? this.rememberedDevice : VIRTUAL_PRINTERS[0]
      );
    }
    return this.connectedDevice;
  }

  observeConnectionLoss(onLoss) {
    if (!this.bluetoothDriver.nativeModule?.BluetoothManager || !DeviceEventEmitter) return { remove() {} };
    return DeviceEventEmitter.addListener('EVENT_CONNECTION_LOST', () => {
      const pending = this.pendingConnection;
      if (pending?.nativeStarted && !pending.cancelled) {
        pending.cancel(new PrinterTransportError('CONNECTION_LOST', 'Printer connection lost. Check the printer and tap Reconnect.'));
      } else if (this.connectedDevice?.type !== 'BLUETOOTH') return;
      this.connectedDevice = null;
      onLoss();
    });
  }

  writePreference(operation) {
    const result = this.preferenceQueue.then(operation);
    this.preferenceQueue = result.catch(() => {});
    return result;
  }

  assertNotPrinting() {
    if (this.isPrinting || this.isTransmitting) {
      throw new PrinterTransportError('PRINT_IN_PROGRESS', 'Wait for printing to finish before changing the printer.');
    }
  }

  async setVirtualMode(enabled) {
    if (enabled) assertVirtualPrinterEnabled();
    this.assertNotPrinting();
    await this.disconnect({ pause: false });
    this.isVirtualMode = Boolean(enabled);
    await secureStore.setItem(STORAGE_KEY_VIRTUAL_MODE, String(this.isVirtualMode));
    if (this.isVirtualMode) await this.connect(VIRTUAL_PRINTERS[0]);
  }

  async scanDevices() {
    this.assertNotPrinting();
    if (this.pendingConnection || this.controlOperation) {
      throw new PrinterTransportError('CONNECTION_IN_PROGRESS', 'Wait for the current printer connection to finish.');
    }
    this.isScanning = true;
    try {
      return await (this.isVirtualMode ? this.virtualDriver.scanDevices() : this.bluetoothDriver.scanDevices());
    } finally {
      this.isScanning = false;
    }
  }

  async connect(device, { automatic = false } = {}) {
    if (!device) throw new TypeError('No printer device specified');
    device = { ...device, type: device.type || 'BLUETOOTH' };
    if (device.type === 'VIRTUAL') assertVirtualPrinterEnabled();
    this.assertNotPrinting();
    if (this.cleanupRequired) {
      throw new PrinterTransportError('CONNECTION_IN_PROGRESS', 'Tap Disconnect to finish printer cleanup, then reconnect.');
    }
    if (this.controlOperation || (this.isScanning && device.type !== 'VIRTUAL')) {
      throw new PrinterTransportError('CONNECTION_IN_PROGRESS', 'Finish the current printer operation before connecting.');
    }
    if (this.pendingConnection) {
      if (this.pendingConnection.address === device.address && this.pendingConnection.type === device.type) {
        if (!automatic) this.pendingConnection.manual = true;
        return this.pendingConnection.promise;
      }
      throw new PrinterTransportError('CONNECTION_IN_PROGRESS', 'Wait for the current printer connection to finish.');
    }
    if (automatic && (!this.autoReconnectEnabled || this.isVirtualMode || device.type !== 'BLUETOOTH')) return null;
    const driver = device.type === 'VIRTUAL' ? this.virtualDriver : this.bluetoothDriver;
    if (device.type === 'VIRTUAL' && !this.isVirtualMode) {
      throw new PrinterTransportError('TRANSPORT_UNAVAILABLE', 'Enable virtual mode to use a simulated printer.');
    }
    const operation = {
      address: device.address, type: device.type, automatic, manual: !automatic, cancelled: false,
      assertCurrent: () => {
        if (operation.cancelled || this.pendingConnection !== operation) {
          throw new PrinterTransportError('CANCELLED', 'Printer connection cancelled.');
        }
      },
      wait: (delay) => new Promise((resolve) => { operation.retryTimer = setTimeout(resolve, delay); }),
    };
    let rejectCancellation;
    const cancellation = new Promise((resolve, reject) => { rejectCancellation = reject; });
    operation.cancel = (error = new PrinterTransportError('CANCELLED', 'Printer connection cancelled.')) => {
      operation.cancelled = true;
      rejectCancellation(error);
    };
    this.pendingConnection = operation;
    operation.timer = setTimeout(() => operation.cancel(new PrinterTransportError(
      'CONNECTION_TIMEOUT', 'Printer connection timed out. Check the printer and tap Reconnect.'
    )), CONNECTION_TIMEOUT_MS);
    operation.promise = (async () => {
      try {
        const connect = async () => {
          if (this.connectedDevice) {
            await driver.disconnect(this.connectedDevice);
            this.connectedDevice = null;
          }
          operation.assertCurrent();
          const connected = await driver.connect(device, operation);
          operation.assertCurrent();
          await this.writePreference(async () => {
            operation.assertCurrent();
            await secureStore.setItem(STORAGE_KEY_PAIRED_PRINTER, JSON.stringify(connected));
            operation.assertCurrent();
            if (operation.manual) await secureStore.setItem(STORAGE_KEY_AUTO_RECONNECT, 'true');
          });
          operation.assertCurrent();
          return connected;
        };
        const connected = await Promise.race([connect(), cancellation]);
        operation.assertCurrent();
        this.connectedDevice = connected;
        this.rememberedDevice = connected;
        if (operation.manual) this.autoReconnectEnabled = true;
        return connected;
      } catch (error) {
        operation.cancelled = true;
        if (operation.nativeStarted) {
          this.connectedDevice = null;
          this.cleanupRequired = true;
          try {
            await driver.disconnect(device);
          } catch {
            throw new PrinterTransportError('DISCONNECT_FAILED', 'Unable to close the printer connection. Tap Disconnect, then reconnect.');
          }
          this.cleanupRequired = false;
        }
        throw error;
      } finally {
        clearTimeout(operation.timer);
        clearTimeout(operation.retryTimer);
        if (this.pendingConnection === operation) this.pendingConnection = null;
      }
    })();
    return operation.promise;
  }

  async cancelPendingConnection({ automaticOnly = false } = {}) {
    const operation = this.pendingConnection;
    if (!operation || (automaticOnly && !operation.automatic)) return;
    operation.cancel();
    await operation.promise.catch(() => {});
  }

  async disconnect({ pause = true, forget = false } = {}) {
    this.assertNotPrinting();
    if (this.controlOperation) {
      throw new PrinterTransportError('CONNECTION_IN_PROGRESS', 'Wait for the current printer operation to finish.');
    }
    this.controlOperation = (async () => {
      if (pause || forget) {
        await this.writePreference(() => secureStore.setItem(STORAGE_KEY_AUTO_RECONNECT, 'false'));
        this.autoReconnectEnabled = false;
      }
      await this.cancelPendingConnection();
      const device = this.connectedDevice;
      this.connectedDevice = null;
      this.cleanupRequired = true;
      if (device?.type === 'VIRTUAL') await this.virtualDriver.disconnect();
      else await this.bluetoothDriver.disconnect(device);
      this.cleanupRequired = false;
      if (forget) {
        await this.writePreference(async () => {
          await secureStore.deleteItem(STORAGE_KEY_PAIRED_PRINTER);
          await secureStore.deleteItem(STORAGE_KEY_AUTO_RECONNECT);
        });
        this.rememberedDevice = null;
      }
    })();
    try {
      return await this.controlOperation;
    } finally {
      this.controlOperation = null;
    }
  }

  async forgetPrinter() {
    return this.disconnect({ forget: true });
  }

  async printRaw(bytes, metadata = {}) {
    if (this.pendingConnection || this.controlOperation || this.isTransmitting) throw new PrinterTransportError('CONNECTION_IN_PROGRESS', 'Wait for the printer operation to finish.');
    if (!this.connectedDevice) throw new PrinterTransportError('TRANSPORT_UNAVAILABLE', 'No printer is connected.');
    const driver = this.connectedDevice.type === 'VIRTUAL' ? this.virtualDriver : this.bluetoothDriver;
    const device = this.connectedDevice;
    this.isTransmitting = true;
    let result;
    try {
      result = await driver.printLabel(bytes, metadata);
    } finally {
      this.isTransmitting = false;
    }
    this.printHistory.unshift({
      jobId: metadata.jobId,
      timestamp: new Date().toISOString(),
      device: device.name,
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
