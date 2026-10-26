import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dismissLoadingShell } from '../src/utils/loadingShell.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatePath = path.resolve(__dirname, '../public/index.html');

describe('HTML Loading Shell Template', () => {
  const htmlContent = fs.readFileSync(templatePath, 'utf8');

  test('contains base template placeholders for Expo CLI', () => {
    assert.match(htmlContent, /<html\s+lang="%LANG_ISO_CODE%">/);
    assert.match(htmlContent, /<title>%WEB_TITLE%<\/title>/);
  });

  test('matches application canvas background #F3F2ED in styles', () => {
    assert.match(htmlContent, /background-color:\s*#F3F2ED;/);
    assert.match(htmlContent, /id="expo-reset"[\s\S]*?background-color:\s*#F3F2ED;/);
    assert.match(htmlContent, /#app-loading-shell[\s\S]*?background-color:\s*#F3F2ED;/);
  });

  test('places #app-loading-shell outside #root container', () => {
    const rootIndex = htmlContent.indexOf('<div id="root"></div>');
    const shellIndex = htmlContent.indexOf('id="app-loading-shell"');
    assert.ok(rootIndex !== -1, 'Root container must be present');
    assert.ok(shellIndex !== -1, 'Loading shell must be present');
    assert.ok(shellIndex > rootIndex, 'Loading shell must be declared outside and after root container');
  });

  test('declares accessible status, polite announcement, and label attributes on shell', () => {
    assert.match(htmlContent, /id="app-loading-shell"[^>]*role="status"/);
    assert.match(htmlContent, /aria-live="polite"/);
    assert.match(htmlContent, /aria-label="Loading TNL Logistics Admin Console"/);
  });

  test('references local tracking logo with dimensional attributes and text fallback', () => {
    assert.match(htmlContent, /<img[^>]*src="\/tracking-logo\.png"/);
    assert.match(htmlContent, /alt="TNL Logistics"/);
    assert.match(htmlContent, /width="175"/);
    assert.match(htmlContent, /height="56"/);
    assert.match(htmlContent, /onerror="/);
    assert.match(htmlContent, /id="app-loading-logo-fallback"/);
    assert.match(htmlContent, /TNL LOGISTICS/);
    assert.match(htmlContent, /ADMIN CONSOLE/);
  });

  test('provides accessible spinner and status message', () => {
    assert.match(htmlContent, /class="app-loading-spinner"[^>]*aria-hidden="true"/);
    assert.match(htmlContent, /Loading console…/);
  });

  test('provides noscript notice and hides active spinner when JavaScript is disabled', () => {
    assert.match(htmlContent, /<noscript>[\s\S]*?app-loading-status-wrap\s*\{\s*display:\s*none\s*!important;\s*\}[\s\S]*?<\/noscript>/);
    assert.match(htmlContent, /<div class="app-loading-noscript-notice" role="alert">/);
    assert.match(htmlContent, /JavaScript is required to use the TNL Logistics Admin Console/);
  });

  test('supports prefers-reduced-motion media query', () => {
    assert.match(htmlContent, /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/);
  });
});

describe('dismissLoadingShell Utility', () => {
  function createMockElement(id) {
    const childNodes = [];
    const classList = new Set();
    let parent = null;

    const el = {
      id,
      childNodes,
      classList: {
        add: (className) => classList.add(className),
        contains: (className) => classList.has(className),
      },
      hasChildNodes: () => childNodes.length > 0,
      appendChild: (child) => {
        child.parentNode = el;
        childNodes.push(child);
      },
      parentNode: null,
      remove: () => {
        if (el.parentNode) {
          const index = el.parentNode.childNodes.indexOf(el);
          if (index !== -1) el.parentNode.childNodes.splice(index, 1);
          el.parentNode = null;
        }
      },
    };
    return el;
  }

  function createMockDocument({ hasRoot = true, rootChildren = 0, hasShell = true } = {}) {
    const body = createMockElement('body');
    let rootEl = null;
    let shellEl = null;

    if (hasRoot) {
      rootEl = createMockElement('root');
      for (let i = 0; i < rootChildren; i++) {
        rootEl.appendChild(createMockElement(`child-${i}`));
      }
      body.appendChild(rootEl);
    }

    if (hasShell) {
      shellEl = createMockElement('app-loading-shell');
      body.appendChild(shellEl);
    }

    return {
      body,
      rootEl,
      shellEl,
      getElementById(id) {
        if (id === 'root') return rootEl;
        if (id === 'app-loading-shell') return shellEl;
        return null;
      },
    };
  }

  test('returns false when documentRef is null or undefined', () => {
    assert.equal(dismissLoadingShell({ documentRef: null }), false);
  });

  test('returns false when app-loading-shell is missing from DOM', () => {
    const doc = createMockDocument({ hasRoot: true, rootChildren: 1, hasShell: false });
    assert.equal(dismissLoadingShell({ documentRef: doc }), false);
  });

  test('returns false when root element is missing', () => {
    const doc = createMockDocument({ hasRoot: false, hasShell: true });
    assert.equal(dismissLoadingShell({ documentRef: doc }), false);
    assert.equal(doc.shellEl.classList.contains('app-loading-shell-hidden'), false);
  });

  test('does not hide shell prematurely when root exists but has no children', () => {
    const doc = createMockDocument({ hasRoot: true, rootChildren: 0, hasShell: true });
    const dismissed = dismissLoadingShell({ documentRef: doc, transitionMs: 0 });
    assert.equal(dismissed, false);
    assert.equal(doc.shellEl.classList.contains('app-loading-shell-hidden'), false);
    assert.ok(doc.getElementById('app-loading-shell') !== null, 'Shell must remain in DOM');
  });

  test('dismisses shell when root has rendered children', () => {
    const doc = createMockDocument({ hasRoot: true, rootChildren: 2, hasShell: true });
    const dismissed = dismissLoadingShell({ documentRef: doc, transitionMs: 0 });
    assert.equal(dismissed, true);
    assert.equal(doc.shellEl.classList.contains('app-loading-shell-hidden'), true);
    assert.equal(doc.shellEl.parentNode, null, 'Shell must be removed from parent');
  });

  test('removes shell asynchronously when transitionMs > 0', async () => {
    const doc = createMockDocument({ hasRoot: true, rootChildren: 1, hasShell: true });
    const dismissed = dismissLoadingShell({ documentRef: doc, transitionMs: 25 });
    assert.equal(dismissed, true);
    assert.equal(doc.shellEl.classList.contains('app-loading-shell-hidden'), true);
    assert.ok(doc.shellEl.parentNode !== null, 'Shell should remain in DOM during transition');

    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(doc.shellEl.parentNode, null, 'Shell must be removed after transition duration');
  });

  test('supports legacy DOM parentNode.removeChild when el.remove is undefined', () => {
    const doc = createMockDocument({ hasRoot: true, rootChildren: 1, hasShell: true });
    delete doc.shellEl.remove;
    let removeChildCalled = false;
    doc.body.removeChild = (child) => {
      removeChildCalled = true;
      const index = doc.body.childNodes.indexOf(child);
      if (index !== -1) doc.body.childNodes.splice(index, 1);
      child.parentNode = null;
    };

    const dismissed = dismissLoadingShell({ documentRef: doc, transitionMs: 0 });
    assert.equal(dismissed, true);
    assert.ok(removeChildCalled, 'Should fallback to parentNode.removeChild');
    assert.equal(doc.shellEl.parentNode, null);
  });
});
