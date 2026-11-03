/**
 * Navigation state and directory filter persistence manager.
 * Stores section last-visited sub-routes and directory filter states in sessionStorage
 * with in-memory fallback for SSR, test environments, and non-browser runtimes.
 */

const SECTION_STORAGE_PREFIX = 'tnl_section_route_';
const PAGE_STORAGE_PREFIX = 'tnl_page_state_';

const inMemorySectionRoutes = new Map();
const inMemoryPageStates = new Map();

function isWebStorageAvailable() {
  return typeof window !== 'undefined' && Boolean(window.sessionStorage);
}

export function saveSectionRoute(sectionRoot, pathname) {
  if (typeof sectionRoot !== 'string' || !sectionRoot.startsWith('/')) return;
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) return;

  inMemorySectionRoutes.set(sectionRoot, pathname);

  if (isWebStorageAvailable()) {
    try {
      window.sessionStorage.setItem(SECTION_STORAGE_PREFIX + sectionRoot, pathname);
    } catch (_) {}
  }
}

export function getSectionRoute(sectionRoot) {
  if (typeof sectionRoot !== 'string') return null;

  if (isWebStorageAvailable()) {
    try {
      const stored = window.sessionStorage.getItem(SECTION_STORAGE_PREFIX + sectionRoot);
      if (stored !== null && stored.length > 0) {
        return stored;
      }
    } catch (_) {}
  }

  return inMemorySectionRoutes.get(sectionRoot) || null;
}

export function clearSectionRoute(sectionRoot) {
  if (typeof sectionRoot !== 'string') return;

  inMemorySectionRoutes.delete(sectionRoot);

  if (isWebStorageAvailable()) {
    try {
      window.sessionStorage.removeItem(SECTION_STORAGE_PREFIX + sectionRoot);
    } catch (_) {}
  }
}

export function savePageState(pageKey, state) {
  if (typeof pageKey !== 'string' || !pageKey || state === undefined) return;

  inMemoryPageStates.set(pageKey, state);

  if (isWebStorageAvailable()) {
    try {
      window.sessionStorage.setItem(PAGE_STORAGE_PREFIX + pageKey, JSON.stringify(state));
    } catch (_) {}
  }
}

export function getPageState(pageKey) {
  if (typeof pageKey !== 'string' || !pageKey) return null;

  if (isWebStorageAvailable()) {
    try {
      const stored = window.sessionStorage.getItem(PAGE_STORAGE_PREFIX + pageKey);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch (_) {}
  }

  return inMemoryPageStates.get(pageKey) || null;
}

export function clearPageState(pageKey) {
  if (typeof pageKey !== 'string' || !pageKey) return;

  inMemoryPageStates.delete(pageKey);

  if (isWebStorageAvailable()) {
    try {
      window.sessionStorage.removeItem(PAGE_STORAGE_PREFIX + pageKey);
    } catch (_) {}
  }
}

export function clearAllNavigationState() {
  inMemorySectionRoutes.clear();
  inMemoryPageStates.clear();

  if (isWebStorageAvailable()) {
    try {
      const keysToRemove = [];
      const storageLength = window.sessionStorage.length || 0;
      for (let i = 0; i < storageLength; i++) {
        const key = window.sessionStorage.key(i);
        if (key && (key.startsWith(SECTION_STORAGE_PREFIX) || key.startsWith(PAGE_STORAGE_PREFIX))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
    } catch (_) {}
  }
}
