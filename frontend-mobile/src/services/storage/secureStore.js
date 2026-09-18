import { Platform } from 'react-native';

const TOKEN_KEY = 'tnl_mobile_token';
const USER_KEY = 'tnl_mobile_user';
const BOUND_USER_KEY = 'tnl_mobile_bound_user';
const APP_LOCKED_KEY = 'tnl_mobile_locked';
const DEVICE_ID_KEY = 'tnl_mobile_device_id';
const DEVICE_TOKEN_KEY = 'tnl_mobile_device_token';

let memoryStorage = {};

async function getSecureStore() {
  if (Platform.OS === 'web') {
    return null;
  }

  return import('expo-secure-store');
}

async function saveValue(key, value) {
  const SecureStore = await getSecureStore();
  if (SecureStore) {
    await SecureStore.setItemAsync(key, value);
    return;
  }

  memoryStorage[key] = value;
}

async function getValue(key) {
  const SecureStore = await getSecureStore();
  if (SecureStore) {
    return SecureStore.getItemAsync(key);
  }

  return memoryStorage[key] || null;
}

async function removeValue(key) {
  const SecureStore = await getSecureStore();
  if (SecureStore) {
    await SecureStore.deleteItemAsync(key);
    return;
  }

  delete memoryStorage[key];
}

export async function saveToken(token) {
  await saveValue(TOKEN_KEY, token);
}

export async function getToken() {
  return getValue(TOKEN_KEY);
}

export async function removeToken() {
  await removeValue(TOKEN_KEY);
}

export async function saveUser(user) {
  await saveValue(USER_KEY, JSON.stringify(user));
}

export async function getUser() {
  const userJson = await getValue(USER_KEY);

  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch (e) {
    return null;
  }
}

export async function removeUser() {
  await removeValue(USER_KEY);
}

export async function saveBoundUser(user) {
  await saveValue(BOUND_USER_KEY, JSON.stringify(user));
}

export async function getBoundUser() {
  const userJson = await getValue(BOUND_USER_KEY);

  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch (e) {
    return null;
  }
}

export async function removeBoundUser() {
  await removeValue(BOUND_USER_KEY);
}

export async function setAppLocked(isLocked) {
  await saveValue(APP_LOCKED_KEY, isLocked ? 'true' : 'false');
}

export async function isAppLocked() {
  const val = await getValue(APP_LOCKED_KEY);
  return val === 'true';
}

export async function saveDeviceCredentials(deviceId, deviceToken) {
  if (!deviceId || !deviceToken) {
    throw new Error('Device credentials are required');
  }

  await Promise.all([
    saveValue(DEVICE_ID_KEY, deviceId),
    saveValue(DEVICE_TOKEN_KEY, deviceToken),
  ]);
}

export async function getDeviceCredentials() {
  const [deviceId, deviceToken] = await Promise.all([
    getValue(DEVICE_ID_KEY),
    getValue(DEVICE_TOKEN_KEY),
  ]);

  if (!deviceId || !deviceToken) {
    return null;
  }

  return { deviceId, deviceToken };
}

export async function removeDeviceCredentials() {
  await Promise.all([
    removeValue(DEVICE_ID_KEY),
    removeValue(DEVICE_TOKEN_KEY),
  ]);
}
