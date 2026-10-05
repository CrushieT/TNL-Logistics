import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStatementPrintUrl,
  createStatementPrintSheetSequence,
  getStatementPrintBlockReason,
  hasUnsavedStatementAdjustments,
  paginateStatementItems,
  waitForImageReady,
} from '../src/features/collections/utils/statementPrintModel.mjs';
import {
  getSoaBankDetailsErrors,
  normalizeSoaBankDetails,
} from '../src/features/settings/utils/soaBankDetails.mjs';

const printableStatement = {
  isSaved: true,
  deductionAmount: 100,
  deductionNote: 'Approved adjustment',
  collectedBy: 'Admin User',
  soaBankName: 'Test Bank',
  soaAccountName: 'TNL Test Account',
  soaAccountNumber: '000000123456',
};

test('SOA bank details normalize values and preserve leading zeroes', () => {
  assert.deepEqual(normalizeSoaBankDetails({
    soaBankName: '  Test Bank  ',
    soaAccountName: '  TNL Test Account ',
    soaAccountNumber: ' 000000123456 ',
  }), {
    soaBankName: 'Test Bank',
    soaAccountName: 'TNL Test Account',
    soaAccountNumber: '000000123456',
  });
});

test('SOA bank validation rejects blank, multiline, control, oversized, and non-digit values', () => {
  assert.ok(getSoaBankDetailsErrors({}).soaBankName);
  assert.ok(getSoaBankDetailsErrors({
    ...printableStatement,
    soaBankName: 'Bank\nInjected',
  }).soaBankName);
  assert.ok(getSoaBankDetailsErrors({
    ...printableStatement,
    soaAccountName: `Account${String.fromCharCode(7)}Name`,
  }).soaAccountName);
  assert.ok(getSoaBankDetailsErrors({
    ...printableStatement,
    soaAccountName: 'A'.repeat(151),
  }).soaAccountName);
  assert.ok(getSoaBankDetailsErrors({
    ...printableStatement,
    soaAccountNumber: '1234-5678',
  }).soaAccountNumber);
});

test('statement print URL includes selectors only and cannot carry financial overrides', () => {
  const url = buildStatementPrintUrl('CL-001', '2026-10-01');
  assert.equal(url, '/statements/print?clientId=CL-001&cycle=2026-10-01');
  assert.equal(url.includes('deduction'), false);
  assert.equal(url.includes('note'), false);
  assert.equal(url.includes('collector'), false);
});

test('printing is blocked for unsaved statements or invalid bank configuration', () => {
  assert.match(getStatementPrintBlockReason({ ...printableStatement, isSaved: false }), /Save/);
  assert.match(getStatementPrintBlockReason({ ...printableStatement, soaAccountNumber: '' }), /System Settings/);
  assert.equal(getStatementPrintBlockReason(printableStatement), null);
});

test('unsaved adjustment detection compares persisted normalized values', () => {
  assert.equal(hasUnsavedStatementAdjustments(printableStatement, {
    deductionAmount: '100.00',
    deductionNote: ' Approved adjustment ',
    collectedBy: 'Admin User',
  }), false);
  assert.equal(hasUnsavedStatementAdjustments(printableStatement, {
    deductionAmount: '101.00',
    deductionNote: 'Approved adjustment',
    collectedBy: 'Admin User',
  }), true);
});

test('two-copy multi-page sequence repeats every sheet and restarts page numbering', () => {
  const items = Array.from({ length: 41 }, (_, index) => ({ shipmentId: `SHP-${index + 1}` }));
  const pages = paginateStatementItems(items);
  const sheets = createStatementPrintSheetSequence(pages, 2);

  assert.ok(pages.length > 1);
  assert.equal(sheets.length, pages.length * 2);
  assert.deepEqual(
    sheets.filter((sheet) => sheet.copyIndex === 0).map((sheet) => sheet.pageNumber),
    Array.from({ length: pages.length }, (_, index) => index + 1),
  );
  assert.deepEqual(
    sheets.filter((sheet) => sheet.copyIndex === 1).map((sheet) => sheet.pageNumber),
    Array.from({ length: pages.length }, (_, index) => index + 1),
  );
  assert.deepEqual(
    sheets.filter((sheet) => sheet.copyIndex === 1).flatMap((sheet) => sheet.pageItems),
    items,
  );
  assert.ok(pages.at(-1).length <= 11);
});

test('paginateStatementItems uniformly chunks up to 11 shipments per page', () => {
  // Empty
  assert.deepEqual(paginateStatementItems([]).map((p) => p.length), [0]);

  // Single-page: 1 to 11 shipments
  assert.deepEqual(paginateStatementItems(Array.from({ length: 5 })).map((p) => p.length), [5]);
  assert.deepEqual(paginateStatementItems(Array.from({ length: 11 })).map((p) => p.length), [11]);

  // 2 pages: 12 shipments (Sunrise Hardware: 11 on Page 1, 1 on Page 2)
  assert.deepEqual(paginateStatementItems(Array.from({ length: 12 })).map((p) => p.length), [11, 1]);

  // 2 pages: 18 shipments (Northbridge Trading: 11 on Page 1, 7 on Page 2)
  assert.deepEqual(paginateStatementItems(Array.from({ length: 18 })).map((p) => p.length), [11, 7]);

  // 2 pages: 20 shipments (11 on Page 1, 9 on Page 2)
  assert.deepEqual(paginateStatementItems(Array.from({ length: 20 })).map((p) => p.length), [11, 9]);

  // 2 pages: 22 shipments (11 on Page 1, 11 on Page 2)
  assert.deepEqual(paginateStatementItems(Array.from({ length: 22 })).map((p) => p.length), [11, 11]);

  // 3 pages: 23 shipments (11 on Page 1, 11 on Page 2, 1 on Page 3)
  assert.deepEqual(paginateStatementItems(Array.from({ length: 23 })).map((p) => p.length), [11, 11, 1]);

  // 4 pages: 41 shipments (11, 11, 11, 8)
  assert.deepEqual(paginateStatementItems(Array.from({ length: 41 })).map((p) => p.length), [11, 11, 11, 8]);

  // Invariant across all counts 1..100: every non-final page has exactly 11 items, final page has 1..11
  for (let count = 1; count <= 100; count++) {
    const pages = paginateStatementItems(Array.from({ length: count }));
    for (let i = 0; i < pages.length - 1; i++) {
      assert.equal(pages[i].length, 11, `Non-final page ${i + 1} must have exactly 11 items for count ${count}`);
    }
    assert.ok(pages.at(-1).length >= 1 && pages.at(-1).length <= 11);
  }
});

test('logo readiness resolves for both successful and failed loads', async () => {
  function createImage(result) {
    return {
      set src(_value) {
        queueMicrotask(() => this[result]());
      },
    };
  }

  assert.equal(await waitForImageReady('/logo.png', () => createImage('onload')), 'loaded');
  assert.equal(await waitForImageReady('/logo.png', () => createImage('onerror')), 'failed');
});
