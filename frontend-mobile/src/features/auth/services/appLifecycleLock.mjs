export function shouldRestoreLockedSession({
  platform,
  boundUser,
  user,
  hasDeviceCredentials,
  persistedLocked
}) {
  const sessionUser = user || boundUser;
  if (!boundUser || !sessionUser || !hasDeviceCredentials) return false;
  if (sessionUser.mustChangePassword === true || sessionUser.hasPinSet === false) return false;
  if (persistedLocked) return true;
  return platform !== 'web' && sessionUser.hasPinSet === true;
}
