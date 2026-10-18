/**
 * Navigation scroll position tracker.
 * Retains sidebar navigation scroll offset across page transitions and reloads
 * to prevent the sidebar menu from jumping back to top on route change.
 */

const STORAGE_KEY = 'tnl_nav_scroll_y';
let inMemoryNavScrollY = 0;

function isWebStorageAvailable() {
  return typeof window !== 'undefined' && Boolean(window.sessionStorage);
}

export function getSavedNavScrollY() {
  if (isWebStorageAvailable()) {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        const parsed = parseFloat(stored);
        if (Number.isFinite(parsed) && parsed >= 0) {
          return parsed;
        }
      }
    } catch (_) {
      // Ignore storage access exceptions
    }
  }
  return inMemoryNavScrollY;
}

export function saveNavScrollY(y) {
  if (typeof y !== 'number' || !Number.isFinite(y) || y < 0) {
    return;
  }
  inMemoryNavScrollY = y;
  if (isWebStorageAvailable()) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, String(y));
    } catch (_) {
      // Ignore storage write exceptions
    }
  }
}

export function resetNavScrollPosition() {
  inMemoryNavScrollY = 0;
  if (isWebStorageAvailable()) {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch (_) {
      // Ignore storage removal exceptions
    }
  }
}
