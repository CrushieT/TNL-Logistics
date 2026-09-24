import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { generateQRMatrix } from '../src/utils/qr.js';
import {
  MAX_OUTBOX_ENTRIES,
  OutboxCapacityError,
  OutboxStorageError,
  PRINT_AUDIT_STORAGE_KEY,
  createPrintAuditOutbox,
} from '../src/features/shipments/services/printAuditOutboxCore.mjs';

function createMemoryStorage(initialValue = null) {
  let storedValue = initialValue;
  return {
    getItem: () => storedValue,
    setItem: (key, value) => {
      assert.equal(key, PRINT_AUDIT_STORAGE_KEY);
      storedValue = value;
    },
    getStoredValue: () => storedValue,
  };
}

function createAuditEntry(index = 1, overrides = {}) {
  return {
    printJobId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    ownerUserId: 'USR-ADMIN',
    shipmentId: 'SHP-2026-001',
    trackingIds: [`TRK-2026-${String(index).padStart(6, '0')}`],
    printerId: 'SYSTEM-PDF',
    status: 'PENDING',
    ...overrides,
  };
}

test('web print audit retries AUTH_PAUSED entries after re-authentication', async () => {
  const storage = createMemoryStorage();
  let ownerUserId = 'USR-ADMIN';
  let shouldRejectAsUnauthorized = true;
  const outbox = createPrintAuditOutbox({
    storage,
    getOwnerUserId: () => ownerUserId,
    sendAudit: async () => {
      if (shouldRejectAsUnauthorized) {
        const error = new Error('Session expired');
        error.response = { status: 401 };
        throw error;
      }
    },
  });
  const entry = createAuditEntry();

  const pausedStatus = await outbox.submitPrintAudit(entry);
  assert.equal(pausedStatus, 'AUTH_PAUSED');
  assert.equal(outbox.getPendingPrintAudits(ownerUserId)[0].status, 'AUTH_PAUSED');

  ownerUserId = null;
  assert.deepEqual(await outbox.retryPendingPrintAudits(), []);

  ownerUserId = 'USR-ADMIN';
  shouldRejectAsUnauthorized = false;
  assert.deepEqual(await outbox.retryPendingPrintAudits(), ['SYNCED']);
  assert.deepEqual(outbox.readEntries(), []);
});

test('web print audit retries preserve diagnostic metadata', async () => {
  const storage = createMemoryStorage();
  const outbox = createPrintAuditOutbox({
    storage,
    getOwnerUserId: () => 'USR-ADMIN',
    sendAudit: async () => { throw new Error('Network unavailable'); },
  });

  assert.equal(await outbox.submitPrintAudit(createAuditEntry()), 'PENDING');
  const firstFailure = outbox.readEntries()[0];
  assert.equal(firstFailure.attempts, 1);

  assert.deepEqual(await outbox.retryPendingPrintAudits(), ['PENDING']);
  const secondFailure = outbox.readEntries()[0];
  assert.equal(secondFailure.attempts, 2);
  assert.equal(secondFailure.createdAt, firstFailure.createdAt);
});

test('web print audit outbox blocks new jobs at capacity without truncation', () => {
  const entries = Array.from(
    { length: MAX_OUTBOX_ENTRIES },
    (_, index) => createAuditEntry(index + 1)
  );
  const storage = createMemoryStorage(JSON.stringify(entries));
  const outbox = createPrintAuditOutbox({
    storage,
    getOwnerUserId: () => 'USR-ADMIN',
    sendAudit: async () => undefined,
  });

  assert.throws(() => outbox.assertCapacityAvailable(), OutboxCapacityError);
  assert.deepEqual(JSON.parse(storage.getStoredValue()), entries);
});

test('web print audit read failures do not overwrite durable storage', () => {
  let writeCount = 0;
  const outbox = createPrintAuditOutbox({
    storage: {
      getItem: () => { throw new Error('Storage unavailable'); },
      setItem: () => { writeCount += 1; },
    },
    getOwnerUserId: () => 'USR-ADMIN',
    sendAudit: async () => undefined,
  });

  assert.throws(() => outbox.assertCapacityAvailable(), OutboxStorageError);
  assert.equal(writeCount, 0);
});

test('web print audit preflight fails when storage is not writable', () => {
  const outbox = createPrintAuditOutbox({
    storage: {
      getItem: () => null,
      setItem: () => { throw new Error('Storage is read-only'); },
    },
    getOwnerUserId: () => 'USR-ADMIN',
    sendAudit: async () => undefined,
  });

  assert.throws(() => outbox.assertCapacityAvailable(), OutboxStorageError);
});

function decodeMatrix(matrix) {
  const scale = 8;
  const margin = 4;
  const size = (matrix.length + margin * 2) * scale;
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  matrix.forEach((row, rowIndex) => row.forEach((isDark, columnIndex) => {
    if (!isDark) return;
    for (let y = 0; y < scale; y += 1) {
      for (let x = 0; x < scale; x += 1) {
        const offset = (((rowIndex + margin) * scale + y) * size + (columnIndex + margin) * scale + x) * 4;
        pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
      }
    }
  }));
  return jsQR(pixels, size, size)?.data;
}

for (const payload of ['TRK-2026-000101', 'José | 城市配送', 'X'.repeat(180)]) {
  test(`web QR round trip: ${payload.slice(0, 20)}`, () => {
    assert.equal(decodeMatrix(generateQRMatrix(payload)), payload);
  });
}
