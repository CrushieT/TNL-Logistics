const MISSING_VALUE = '\u2014';

export function deriveInitials(fullName, username) {
  const nameParts = typeof fullName === 'string'
    ? fullName.trim().split(/\s+/).filter(Boolean)
    : [];
  if (nameParts.length > 0) {
    const selectedParts = nameParts.length === 1 ? nameParts : [nameParts[0], nameParts[nameParts.length - 1]];
    return selectedParts.map((part) => part.charAt(0).toUpperCase()).join('');
  }
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  return normalizedUsername ? normalizedUsername.charAt(0).toUpperCase() : '?';
}

export function formatRole(role) {
  const knownRoles = {
    FIELD_STAFF: 'FIELD STAFF',
    OFFICE_STAFF: 'OFFICE STAFF',
    ADMIN: 'ADMINISTRATOR',
  };
  return knownRoles[role] || 'ROLE UNAVAILABLE';
}

export function formatStaffType(staffType) {
  if (typeof staffType !== 'string' || !staffType.trim()) return 'UNAVAILABLE';
  return staffType.trim().replace(/_/g, ' ');
}

export function maskDeviceId(deviceId) {
  if (typeof deviceId !== 'string' || !deviceId.trim()) return MISSING_VALUE;
  const normalized = deviceId.trim();
  const visibleLength = normalized.length < 8 ? Math.min(4, normalized.length) : 8;
  return `${'\u2022'.repeat(8)}${normalized.slice(-visibleLength)}`;
}

export function validatePasswordChange(currentPassword, newPassword, confirmation) {
  if (!currentPassword || !newPassword || !confirmation) return 'All password fields are required.';
  if (currentPassword.length > 128) return 'Current password must not exceed 128 characters.';
  if (newPassword.length < 8 || newPassword.length > 128) {
    return 'New password must be between 8 and 128 characters.';
  }
  if (newPassword === currentPassword) return 'New password must be different from current password.';
  if (newPassword !== confirmation) return 'New passwords do not match.';
  return null;
}

export function validateFourDigitPin(pin) {
  return typeof pin === 'string' && /^[0-9]{4}$/.test(pin);
}

export function resolveAccountDisplay(profile, authState = {}) {
  const source = profile || authState.user || {};
  const fullName = typeof source.fullName === 'string' && source.fullName.trim()
    ? source.fullName.trim()
    : MISSING_VALUE;
  const username = typeof source.username === 'string' && source.username.trim()
    ? source.username.trim()
    : null;
  return {
    initials: deriveInitials(fullName === MISSING_VALUE ? '' : fullName, username),
    fullName,
    username: username ? `@${username}` : MISSING_VALUE,
    userId: source.userId || MISSING_VALUE,
    role: formatRole(source.role),
    staffType: source.staffType ? formatStaffType(source.staffType) : null,
    isUnlocked: Boolean(authState.isAuthenticated && !authState.isLocked),
    hasPinSet: source.hasPinSet === true,
    deviceBinding: source.deviceBinding?.active === true ? source.deviceBinding : null,
  };
}

export function normalizeSecurityError(error) {
  return {
    code: error?.code || null,
    message: error?.message || 'The request could not be completed. Please try again.',
    retryAfterSeconds: Number.isFinite(error?.retryAfterSeconds) ? error.retryAfterSeconds : null,
  };
}
