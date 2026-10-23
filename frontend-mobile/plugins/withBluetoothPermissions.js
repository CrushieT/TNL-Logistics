const { withAndroidManifest } = require('expo/config-plugins');

const LEGACY_PERMISSIONS = [
  'BLUETOOTH', 'BLUETOOTH_ADMIN', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION',
];

function normalizeBluetoothPermissions(androidManifest) {
  const manifest = androidManifest.manifest;
  const permissions = manifest['uses-permission'] || [];
  const names = [...LEGACY_PERMISSIONS, 'BLUETOOTH_SCAN', 'BLUETOOTH_CONNECT'];
  for (const permission of names) {
    const name = `android.permission.${permission}`;
    const matches = permissions.filter((entry) => entry.$?.['android:name'] === name);
    const attributes = Object.assign({}, ...matches.map((entry) => entry.$), { 'android:name': name });
    if (LEGACY_PERMISSIONS.includes(permission)) {
      attributes['android:maxSdkVersion'] = '30';
    } else {
      delete attributes['android:maxSdkVersion'];
    }
    if (permission === 'BLUETOOTH_SCAN') {
      attributes['android:usesPermissionFlags'] = 'neverForLocation';
    }
    for (let index = permissions.length - 1; index >= 0; index -= 1) {
      if (permissions[index].$?.['android:name'] === name) permissions.splice(index, 1);
    }
    permissions.push({ $: attributes });
  }
  manifest['uses-permission'] = permissions;
  return androidManifest;
}

module.exports = (config) => withAndroidManifest(config, (mod) => {
  normalizeBluetoothPermissions(mod.modResults);
  return mod;
});
module.exports.normalizeBluetoothPermissions = normalizeBluetoothPermissions;
