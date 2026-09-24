function assertStorageAdapter(storage) {
  if (!storage) {
    throw new Error('A storage adapter is required.');
  }
}

export async function replaceAuthenticatedSession(storage, session) {
  assertStorageAdapter(storage);
  await storage.saveToken(session.token);
  await storage.saveUser(session.user);
  await storage.setAppLocked(false);
}

export async function clearAccessSessionPreservingBinding(storage) {
  assertStorageAdapter(storage);
  await storage.removeToken();
  await storage.removeUser();
  await storage.setAppLocked(true);
}

export async function clearDeviceSession(storage) {
  assertStorageAdapter(storage);
  await storage.removeToken();
  await storage.removeUser();
  await storage.removeBoundUser();
  await storage.removeDeviceCredentials();
  await storage.setAppLocked(false);
}
