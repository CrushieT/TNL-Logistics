import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSavedNavScrollY,
  saveNavScrollY,
  resetNavScrollPosition,
} from '../src/components/layout/navScrollPosition.mjs';

describe('Navigation Scroll Position - navScrollPosition.mjs', () => {
  beforeEach(() => {
    resetNavScrollPosition();
    delete globalThis.window;
  });

  test('defaults to 0 when no position has been saved', () => {
    assert.equal(getSavedNavScrollY(), 0);
  });

  test('saves and retrieves scroll offset in memory when web storage is unavailable', () => {
    saveNavScrollY(185.5);
    assert.equal(getSavedNavScrollY(), 185.5);
  });

  test('ignores negative numbers and non-finite inputs', () => {
    saveNavScrollY(120);
    saveNavScrollY(-50);
    assert.equal(getSavedNavScrollY(), 120);

    saveNavScrollY(NaN);
    assert.equal(getSavedNavScrollY(), 120);

    saveNavScrollY(Infinity);
    assert.equal(getSavedNavScrollY(), 120);

    saveNavScrollY('not-a-number');
    assert.equal(getSavedNavScrollY(), 120);
  });

  test('resets position to 0 via resetNavScrollPosition()', () => {
    saveNavScrollY(240);
    assert.equal(getSavedNavScrollY(), 240);

    resetNavScrollPosition();
    assert.equal(getSavedNavScrollY(), 0);
  });

  test('synchronizes with window.sessionStorage when available', () => {
    const storageMap = new Map();
    globalThis.window = {
      sessionStorage: {
        getItem: (k) => storageMap.get(k) ?? null,
        setItem: (k, v) => storageMap.set(k, String(v)),
        removeItem: (k) => storageMap.delete(k),
      },
    };

    saveNavScrollY(310.25);
    assert.equal(storageMap.get('tnl_nav_scroll_y'), '310.25');
    assert.equal(getSavedNavScrollY(), 310.25);

    resetNavScrollPosition();
    assert.equal(storageMap.has('tnl_nav_scroll_y'), false);
    assert.equal(getSavedNavScrollY(), 0);
  });

  test('gracefully handles sessionStorage throws without crashing', () => {
    globalThis.window = {
      sessionStorage: {
        getItem: () => { throw new Error('SecurityError: storage disabled'); },
        setItem: () => { throw new Error('QuotaExceededError'); },
        removeItem: () => { throw new Error('SecurityError'); },
      },
    };

    // Should not throw and should still use in-memory fallback
    assert.doesNotThrow(() => saveNavScrollY(150));
    assert.doesNotThrow(() => resetNavScrollPosition());
  });
});
