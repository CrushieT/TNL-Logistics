const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F]/;
const ACCOUNT_NUMBER_PATTERN = /^[0-9]{6,20}$/;

export function normalizeSoaBankDetails(values = {}) {
  return {
    soaBankName: String(values.soaBankName ?? '').trim(),
    soaAccountName: String(values.soaAccountName ?? '').trim(),
    soaAccountNumber: String(values.soaAccountNumber ?? '').trim(),
  };
}

export function getSoaBankDetailsErrors(values = {}) {
  const normalized = normalizeSoaBankDetails(values);
  const errors = {};

  if (!normalized.soaBankName) {
    errors.soaBankName = 'Bank name is required';
  } else if (normalized.soaBankName.length > 100) {
    errors.soaBankName = 'Bank name must not exceed 100 characters';
  } else if (CONTROL_CHARACTER_PATTERN.test(normalized.soaBankName)) {
    errors.soaBankName = 'Bank name must be a single line without control characters';
  }

  if (!normalized.soaAccountName) {
    errors.soaAccountName = 'Account name is required';
  } else if (normalized.soaAccountName.length > 150) {
    errors.soaAccountName = 'Account name must not exceed 150 characters';
  } else if (CONTROL_CHARACTER_PATTERN.test(normalized.soaAccountName)) {
    errors.soaAccountName = 'Account name must be a single line without control characters';
  }

  if (!normalized.soaAccountNumber) {
    errors.soaAccountNumber = 'Account number is required';
  } else if (!ACCOUNT_NUMBER_PATTERN.test(normalized.soaAccountNumber)) {
    errors.soaAccountNumber = 'Account number must contain 6 to 20 digits';
  }

  return errors;
}

export function hasValidSoaBankDetails(values = {}) {
  return Object.keys(getSoaBankDetailsErrors(values)).length === 0;
}
