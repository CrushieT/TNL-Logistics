import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getLocalAppVersion,
  checkAppVersionStatus,
  resolveApkDownloadUrl,
  registerVersionObsoleteListener,
  notifyVersionObsolete,
  buildMobileVersionHeaders,
} from '../src/features/updates/services/appVersionService.mjs';

test('getLocalAppVersion extracts versionCode and versionName correctly', () => {
  const mockConstants = {
    expoConfig: {
      version: '1.2.3',
      android: {
        versionCode: 42,
      },
    },
  };
  const result = getLocalAppVersion(mockConstants);
  assert.equal(result.versionCode, 42);
  assert.equal(result.versionName, '1.2.3');
});

test('getLocalAppVersion handles missing or invalid build numbers safely', () => {
  const resultEmpty = getLocalAppVersion({});
  assert.equal(resultEmpty.versionCode, 1);
  assert.equal(resultEmpty.versionName, '1.0.0');

  const resultInvalid = getLocalAppVersion({
    expoConfig: {
      android: { versionCode: 'not-a-number' },
    },
  });
  assert.equal(resultInvalid.versionCode, 1);
});

test('checkAppVersionStatus returns no update when server version matches local version', () => {
  const status = checkAppVersionStatus({
    localVersion: { versionCode: 2, versionName: '1.0.1' },
    serverVersion: {
      minSupportedVersionCode: 1,
      latestVersionCode: 2,
      latestVersionName: '1.0.1',
      forceUpdate: true,
    },
  });

  assert.equal(status.isUpdateRequired, false);
  assert.equal(status.isUpdateAvailable, false);
});

test('checkAppVersionStatus flags mandatory update when local versionCode is below minSupportedVersionCode', () => {
  const status = checkAppVersionStatus({
    localVersion: { versionCode: 1, versionName: '1.0.0' },
    serverVersion: {
      minSupportedVersionCode: 2,
      latestVersionCode: 3,
      latestVersionName: '1.1.0',
      forceUpdate: true,
    },
  });

  assert.equal(status.isUpdateRequired, true);
  assert.equal(status.isUpdateAvailable, true);
});

test('checkAppVersionStatus does not block when local meets minSupportedVersionCode even if a newer version is available', () => {
  const status = checkAppVersionStatus({
    localVersion: { versionCode: 2, versionName: '1.0.1' },
    serverVersion: {
      minSupportedVersionCode: 2,
      latestVersionCode: 3,
      latestVersionName: '1.1.0',
      forceUpdate: true,
    },
  });

  assert.equal(status.isUpdateRequired, false);
  assert.equal(status.isUpdateAvailable, true);
});

test('checkAppVersionStatus allows bypass when forceUpdate is false even if local is below min', () => {
  const status = checkAppVersionStatus({
    localVersion: { versionCode: 1, versionName: '1.0.0' },
    serverVersion: {
      minSupportedVersionCode: 2,
      latestVersionCode: 3,
      latestVersionName: '1.1.0',
      forceUpdate: false,
    },
  });

  assert.equal(status.isUpdateRequired, false);
  assert.equal(status.isUpdateAvailable, true);
});

test('checkAppVersionStatus handles newer local build gracefully (e.g. in dev / beta)', () => {
  const status = checkAppVersionStatus({
    localVersion: { versionCode: 5, versionName: '2.0.0' },
    serverVersion: {
      minSupportedVersionCode: 2,
      latestVersionCode: 4,
      latestVersionName: '1.5.0',
      forceUpdate: true,
    },
  });

  assert.equal(status.isUpdateRequired, false);
  assert.equal(status.isUpdateAvailable, false);
});

test('checkAppVersionStatus handles null or invalid server metadata without throwing', () => {
  const statusNull = checkAppVersionStatus({
    localVersion: { versionCode: 2, versionName: '1.0.1' },
    serverVersion: null,
  });
  assert.equal(statusNull.isUpdateRequired, false);
  assert.equal(statusNull.isUpdateAvailable, false);

  const statusEmpty = checkAppVersionStatus();
  assert.equal(statusEmpty.isUpdateRequired, false);
  assert.equal(statusEmpty.isUpdateAvailable, false);
});

test('resolveApkDownloadUrl prioritizes server URL over defaults and environment variables', () => {
  const urlFromServer = resolveApkDownloadUrl({
    serverVersion: { apkDownloadUrl: 'https://example.com/server.apk' },
    defaultUrl: 'https://example.com/default.apk',
  });
  assert.equal(urlFromServer, 'https://example.com/server.apk');

  const urlFromDefault = resolveApkDownloadUrl({
    serverVersion: { apkDownloadUrl: null },
    defaultUrl: 'https://example.com/default.apk',
  });
  assert.equal(urlFromDefault, 'https://example.com/default.apk');
});

test('buildMobileVersionHeaders generates valid headers for android and ios platforms', () => {
  const mockConstants = {
    expoConfig: {
      version: '1.0.5',
      android: { versionCode: 12 },
    },
  };
  const androidHeaders = buildMobileVersionHeaders('android', mockConstants);
  assert.deepEqual(androidHeaders, {
    'X-App-Version-Code': '12',
    'X-App-Platform': 'android',
  });

  const iosHeaders = buildMobileVersionHeaders('ios', mockConstants);
  assert.deepEqual(iosHeaders, {
    'X-App-Version-Code': '12',
    'X-App-Platform': 'ios',
  });

  const webHeaders = buildMobileVersionHeaders('web', mockConstants);
  assert.deepEqual(webHeaders, {});
});

test('registerVersionObsoleteListener notifies subscriber and supports clean unsubscribe', () => {
  let receivedPayload = null;
  const unsubscribe = registerVersionObsoleteListener((payload) => {
    receivedPayload = payload;
  });

  notifyVersionObsolete({ minVersionCode: 5, clientVersionCode: 2 });
  assert.deepEqual(receivedPayload, { minVersionCode: 5, clientVersionCode: 2 });

  // Test unsubscribe
  receivedPayload = null;
  unsubscribe();
  notifyVersionObsolete({ minVersionCode: 6, clientVersionCode: 2 });
  assert.equal(receivedPayload, null);
});
