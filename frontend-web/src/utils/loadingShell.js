/**
 * Dismisses the initial HTML loading shell once React has committed into the root element.
 *
 * Checks that the root element actually contains rendered children before hiding the shell,
 * ensuring no premature blank-screen flicker occurs if mounting is delayed or fails.
 *
 * @param {Object} [options]
 * @param {string} [options.rootId='root']
 * @param {string} [options.shellId='app-loading-shell']
 * @param {string} [options.hiddenClass='app-loading-shell-hidden']
 * @param {number} [options.transitionMs=160]
 * @param {Document} [options.documentRef=typeof document !== 'undefined' ? document : null]
 * @returns {boolean} Whether the dismissal was initiated.
 */
export function dismissLoadingShell({
  rootId = 'root',
  shellId = 'app-loading-shell',
  hiddenClass = 'app-loading-shell-hidden',
  transitionMs = 160,
  documentRef = typeof document !== 'undefined' ? document : null,
} = {}) {
  if (!documentRef) return false;
  const rootEl = documentRef.getElementById(rootId);
  const shellEl = documentRef.getElementById(shellId);

  if (!shellEl) return false;
  if (!rootEl || !rootEl.hasChildNodes()) return false;

  shellEl.classList.add(hiddenClass);

  if (transitionMs <= 0) {
    removeElement(shellEl);
  } else {
    setTimeout(() => {
      removeElement(shellEl);
    }, transitionMs);
  }

  return true;
}

function removeElement(element) {
  if (!element) return;
  if (typeof element.remove === 'function') {
    element.remove();
  } else if (element.parentNode) {
    element.parentNode.removeChild(element);
  }
}
