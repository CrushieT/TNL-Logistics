const assert = require('node:assert/strict');
const { AndroidConfig } = require('expo/config-plugins');

function verifyBluetoothManifest(androidManifest) {
  const permissions = androidManifest.manifest['uses-permission'] || [];
  for (const permission of ['BLUETOOTH_SCAN', 'BLUETOOTH_CONNECT', 'BLUETOOTH', 'BLUETOOTH_ADMIN', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION']) {
    const name = `android.permission.${permission}`;
    const matches = permissions.filter((entry) => entry.$?.['android:name'] === name);
    assert.equal(matches.length, 1, `${permission} must be declared exactly once`);
    const attributes = matches[0].$;
    if (permission === 'BLUETOOTH_SCAN' || permission === 'BLUETOOTH_CONNECT') {
      assert.equal(attributes['android:maxSdkVersion'], undefined, `${permission} must remain available on modern Android`);
      if (permission === 'BLUETOOTH_SCAN') {
        assert.ok(attributes['android:usesPermissionFlags']?.split('|').includes('neverForLocation'), 'BLUETOOTH_SCAN must declare neverForLocation');
      }
    } else {
      assert.equal(attributes['android:maxSdkVersion'], '30', `${permission} must be capped at API 30`);
    }
  }
}

module.exports = { verifyBluetoothManifest };

if (require.main === module) {
  const manifestPath = process.argv[2];
  if (!manifestPath) throw new Error('Usage: node scripts/verifyBluetoothManifest.js <decoded-manifest.xml>');
  AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath)
    .then((manifest) => {
      verifyBluetoothManifest(manifest);
      console.log('Bluetooth manifest permissions verified.');
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
