import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { AndroidConfig } = require('expo/config-plugins');
const plugin = require('../plugins/withBluetoothPermissions');
const { verifyBluetoothManifest } = require('../scripts/verifyBluetoothManifest');
const permission = (name, attributes = {}) => ({ $: { 'android:name': `android.permission.${name}`, ...attributes } });

test('Bluetooth plugin normalizes an empty manifest and registers an Android manifest mod', () => {
  const manifest = plugin.normalizeBluetoothPermissions({ manifest: {} });
  verifyBluetoothManifest(manifest);
  assert.equal(manifest.manifest['uses-permission'].length, 6);
  assert.equal(typeof plugin({ name: 'test', slug: 'test' }).mods.android.manifest, 'function');
});

test('Bluetooth plugin deduplicates declarations, caps legacy permissions and preserves unrelated permissions', () => {
  const camera = permission('CAMERA', { 'android:required': 'false' });
  const manifest = { manifest: { 'uses-permission': [
    camera, permission('BLUETOOTH_SCAN', { 'android:maxSdkVersion': '30' }),
    permission('BLUETOOTH_SCAN'), permission('BLUETOOTH_CONNECT', { 'android:maxSdkVersion': '31' }),
    permission('ACCESS_FINE_LOCATION'), permission('ACCESS_COARSE_LOCATION', { 'android:maxSdkVersion': '28' }),
    permission('BLUETOOTH'), permission('BLUETOOTH_ADMIN'), permission('BLUETOOTH_ADMIN'),
  ], application: [{ $: { 'android:label': 'test' } }] } };
  plugin.normalizeBluetoothPermissions(manifest);
  verifyBluetoothManifest(manifest);
  assert.equal(manifest.manifest['uses-permission'].length, 7);
  assert.equal(manifest.manifest['uses-permission'][0], camera);
  assert.equal(manifest.manifest.application[0].$['android:label'], 'test');
  const normalized = structuredClone(manifest);
  plugin.normalizeBluetoothPermissions(manifest);
  assert.deepEqual(manifest, normalized);
});

test('release manifest guard rejects missing flags, missing permissions, duplicates and incorrect caps', () => {
  const valid = plugin.normalizeBluetoothPermissions({ manifest: {} });
  for (let index = 0; index < 6; index += 1) {
    const missing = structuredClone(valid);
    missing.manifest['uses-permission'].splice(index, 1);
    assert.throws(() => verifyBluetoothManifest(missing));
    const duplicate = structuredClone(valid);
    duplicate.manifest['uses-permission'].push(duplicate.manifest['uses-permission'][index]);
    assert.throws(() => verifyBluetoothManifest(duplicate));
    const invalid = structuredClone(valid);
    invalid.manifest['uses-permission'][index].$['android:maxSdkVersion'] = index < 4 ? '31' : '30';
    assert.throws(() => verifyBluetoothManifest(invalid));
  }
  const noFlag = structuredClone(valid);
  delete noFlag.manifest['uses-permission'].find((entry) => entry.$['android:name'].endsWith('.BLUETOOTH_SCAN')).$['android:usesPermissionFlags'];
  assert.throws(() => verifyBluetoothManifest(noFlag));
});

test('release manifest guard accepts compiled numeric permission attributes', () => {
  const manifest = plugin.normalizeBluetoothPermissions({ manifest: {} });
  const permissions = manifest.manifest['uses-permission'];
  permissions.find((entry) => entry.$['android:name'].endsWith('.BLUETOOTH_SCAN')).$['android:usesPermissionFlags'] = '0x00010000';
  for (const entry of permissions.filter((permissionEntry) => permissionEntry.$['android:maxSdkVersion'])) {
    entry.$['android:maxSdkVersion'] = '0x1e';
  }
  assert.doesNotThrow(() => verifyBluetoothManifest(manifest));
  permissions.find((entry) => entry.$['android:name'].endsWith('.BLUETOOTH_SCAN')).$['android:usesPermissionFlags'] = '65536';
  assert.doesNotThrow(() => verifyBluetoothManifest(manifest));
  permissions.find((entry) => entry.$['android:name'].endsWith('.BLUETOOTH_SCAN')).$['android:usesPermissionFlags'] = '0x00000001';
  assert.throws(() => verifyBluetoothManifest(manifest), /neverForLocation/);
});

test('patched printer library caps its legacy Bluetooth and Location permissions', async () => {
  const manifestPath = fileURLToPath(new URL('../node_modules/react-native-bluetooth-escpos-printer/android/src/main/AndroidManifest.xml', import.meta.url));
  const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
  for (const permissionName of ['BLUETOOTH', 'BLUETOOTH_ADMIN', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION']) {
    const name = `android.permission.${permissionName}`;
    const declaration = manifest.manifest['uses-permission'].find((entry) => entry.$['android:name'] === name);
    assert.equal(declaration?.$['android:maxSdkVersion'], '30', `${permissionName} must be capped in the library manifest`);
  }
});
