/**
 * Safe invocation wrapper for haptic feedback.
 * Catches both synchronous exceptions and asynchronous promise rejections.
 */
export async function invokeHapticSafely(operation) {
  if (typeof operation !== 'function') {
    return false;
  }
  try {
    const result = operation();
    if (result && typeof result.then === 'function') {
      await result;
    }
    return true;
  } catch {
    return false;
  }
}
