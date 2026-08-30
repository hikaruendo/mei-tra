'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  countCharacters,
  fitXPostDraft,
  truncateText,
} = require('./x-post-draft-text.cjs');

test('keeps a draft that already fits unchanged', () => {
  assert.equal(
    fitXPostDraft('Connected players are skipped.', 'Fewer interruptions.'),
    'Connected players are skipped.\nFewer interruptions.',
  );
});

test('shortens both long sections to the configured limit', () => {
  const result = fitXPostDraft('change '.repeat(80), 'benefit '.repeat(80));
  const [change, benefit] = result.split('\n');

  assert.ok(countCharacters(result) <= 240);
  assert.match(change, /…$/);
  assert.match(benefit, /…$/);
});

test('gives unused section space to the longer section', () => {
  const result = fitXPostDraft('Short change.', '長い利点です。'.repeat(80));
  const [change, benefit] = result.split('\n');

  assert.equal(change, 'Short change.');
  assert.ok(countCharacters(benefit) > 96);
  assert.ok(countCharacters(result) <= 240);
});

test('counts emoji as Unicode characters instead of UTF-16 code units', () => {
  assert.equal(countCharacters('🃏🃏🃏'), 3);
  assert.equal(truncateText('🃏'.repeat(20), 10), `${'🃏'.repeat(9)}…`);
});

test('requires both source sections', () => {
  assert.throws(
    () => fitXPostDraft('Visible change', ''),
    /Both X post draft sections are required/,
  );
});
