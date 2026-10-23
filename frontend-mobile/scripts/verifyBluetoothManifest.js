const assert = require('node:assert/strict');
const { AndroidConfig } = require('expo/config-plugins');

function parseManifestNumber(value) {
  const text = String(value ?? '').trim();
  return /^(?:0x[0-9a-f]+|\d+)$/i.test(text) ? Number(text) : null;
}

function hasNeverForLocation(value) {
  if (typeof value === 'string' && value.split('|').some((flag) => flag.trim() === 'neverForLocation')) return true;
  const numericFlags = parseManifestNumber(value);
  return numericFlags !== null && (numericFlags & 0x00010000) !== 0;
}

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
        assert.ok(hasNeverForLocation(attributes['android:usesPermissionFlags']),
          `BLUETOOTH_SCAN must declare neverForLocation (found ${attributes['android:usesPermissionFlags'] ?? 'none'})`);
      }
    } else {
      assert.equal(parseManifestNumber(attributes['android:maxSdkVersion']), 30,
        `${permission} must be capped at API 30`);
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
