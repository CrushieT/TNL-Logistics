import { Platform } from 'react-native';

const TOKEN_KEY = 'tnl_mobile_token';
const USER_KEY = 'tnl_mobile_user';

let memoryStorage = {};

async function getSecureStore() {
  if (Platform.OS !== 'web') {
    try {
      const SecureStore = await import('expo-secure-store');
      return SecureStore;
    } catch (e) {
      return null;
    }
  }
  return null;
}

export async function saveToken(token) {
  const SecureStore = await getSecureStore();
  if (SecureStore) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    return;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    memoryStorage[TOKEN_KEY] = token;
  }
}

export async function getToken() {
  const SecureStore = await getSecureStore();
  if (SecureStore) {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(TOKEN_KEY);
  }
  return memoryStorage[TOKEN_KEY] || null;
}

export async function removeToken() {
  const SecureStore = await getSecureStore();
  if (SecureStore) {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    return;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(TOKEN_KEY);
  } else {
    delete memoryStorage[TOKEN_KEY];
  }
}

export async function saveUser(user) {
  const userJson = JSON.stringify(user);
  const SecureStore = await getSecureStore();
  if (SecureStore) {
    await SecureStore.setItemAsync(USER_KEY, userJson);
    return;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(USER_KEY, userJson);
  } else {
    memoryStorage[USER_KEY] = userJson;
  }
}

export async function getUser() {
  let userJson = null;
  const SecureStore = await getSecureStore();
  if (SecureStore) {
    userJson = await SecureStore.getItemAsync(USER_KEY);
  } else if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    userJson = window.localStorage.getItem(USER_KEY);
  } else {
    userJson = memoryStorage[USER_KEY] || null;
  }

  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch (e) {
    return null;
  }
}

export async function removeUser() {
  const SecureStore = await getSecureStore();
  if (SecureStore) {
    await SecureStore.deleteItemAsync(USER_KEY);
    return;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(USER_KEY);
  } else {
    delete memoryStorage[USER_KEY];
  }
}
