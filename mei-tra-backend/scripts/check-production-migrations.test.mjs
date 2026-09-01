import test from 'node:test';
import assert from 'node:assert/strict';
import { findMigrationHistoryMismatches } from './check-production-migrations.mjs';

test('accepts migration histories that match exactly', () => {
  const output = `
    LOCAL          | REMOTE         | TIME (UTC)
    001            | 001            | 1970-01-01
    20260817010000 | 20260817010000 | 2026-08-17
  `;

  assert.deepEqual(findMigrationHistoryMismatches(output), []);
});

test('reports migrations missing on either side', () => {
  const output = `
    LOCAL          | REMOTE         | TIME (UTC)
    20260817010000 |                | 2026-08-17
                   | 20260818010000 | 2026-08-18
  `;

  assert.deepEqual(findMigrationHistoryMismatches(output), [
    { local: '20260817010000', remote: '' },
    { local: '', remote: '20260818010000' },
  ]);
});

test('rejects unparseable CLI output instead of silently passing', () => {
  assert.throws(
    () => findMigrationHistoryMismatches('authentication failed'),
    /did not contain migration rows/,
  );
});
