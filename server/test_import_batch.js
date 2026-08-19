const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeImportRows, insertImportRowsBatch, importRefreshScope } = require('./import_batch');

test('normalizes seconds, deduplicates, and sorts punches', () => {
  assert.deepEqual(normalizeImportRows([
    { employee_id: 2, created_at: '2026-08-13 18:06:59' },
    { employee_id: 1, created_at: '2026-08-13 12:01:12' },
    { employee_id: '1', created_at: '2026-08-13 12:01:48' }
  ]), [
    { employee_id: '1', created_at: '2026-08-13 12:01:00' },
    { employee_id: '2', created_at: '2026-08-13 18:06:00' }
  ]);
});

test('inserts in bounded batches and totals affected rows', async () => {
  const sizes = [];
  const connection = { async query(_sql, params) {
    sizes.push(params[0].length);
    return [{ affectedRows: params[0].length }];
  } };
  const rows = Array.from({ length: 5 }, (_, index) => ({
    employee_id: String(index + 1), created_at: '2026-08-13 08:00:00'
  }));
  assert.equal(await insertImportRowsBatch(connection, rows, 2), 5);
  assert.deepEqual(sizes, [2, 2, 1]);
});

test('derives a bounded employee and date scope', () => {
  assert.deepEqual(importRefreshScope([
    { employee_id: '5489', created_at: '2026-08-13 12:01:00' },
    { employee_id: '5489', created_at: '2026-08-14 18:06:00' }
  ]), {
    employee_ids: [5489], start_date: '2026-08-13', end_date: '2026-08-14', all_history: false
  });
});
