// Tests for the import fingerprint.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/fingerprint.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { fingerprintOf, normalizeField, assignSequences, formatFingerprint }
  from '../../src/app/core/database/import/fingerprint.ts';
import { parseAmountToMinor } from '../../src/app/core/database/money.ts';

const row = {
  occurredOn: '2021-06-26',
  account: 'Bancolombia',
  category: 'Restaurante',
  amountMinor: -5020000,
  description: 'Rappi',
};

test('the same row always produces the same fingerprint', () => {
  assert.equal(fingerprintOf(row), fingerprintOf({ ...row }));
});

test('formatting an amount differently does not change the fingerprint', () => {
  // What matters is that the amount is parsed to minor units before hashing:
  // this is exactly how the CSV writes the same figure two ways.
  const fromSeparated = parseAmountToMinor('-50200'.replace(/,/g, ''));
  const fromPlain = parseAmountToMinor('-50200');
  assert.equal(
    fingerprintOf({ ...row, amountMinor: fromSeparated * 100 }),
    fingerprintOf({ ...row, amountMinor: fromPlain * 100 }),
  );
});

test('stray whitespace is ignored but real edits are not', () => {
  assert.equal(fingerprintOf({ ...row, description: '  Rappi  ' }), fingerprintOf(row));
  assert.equal(fingerprintOf({ ...row, description: 'Rappi   pedido' }),
               fingerprintOf({ ...row, description: 'Rappi pedido' }));

  // Case and accents are load-bearing: renaming an account should be visible.
  assert.notEqual(fingerprintOf({ ...row, account: 'bancolombia' }), fingerprintOf(row));
  assert.notEqual(fingerprintOf({ ...row, account: 'Ualá' }), fingerprintOf({ ...row, account: 'Uala' }));

  // So is every other field.
  assert.notEqual(fingerprintOf({ ...row, amountMinor: -5020001 }), fingerprintOf(row));
  assert.notEqual(fingerprintOf({ ...row, occurredOn: '2021-06-27' }), fingerprintOf(row));
  assert.notEqual(fingerprintOf({ ...row, category: 'Transporte' }), fingerprintOf(row));
});

test('an empty description is not the same as a missing one being confused with a field shift', () => {
  const empty = fingerprintOf({ ...row, description: '' });
  const missing = fingerprintOf({ ...row, description: null });
  assert.equal(empty, missing, 'null and empty both mean "no description"');

  // The separator keeps fields from bleeding into one another: an account
  // called 'A' with category 'BC' must not collide with 'AB' and 'C'.
  assert.notEqual(
    fingerprintOf({ ...row, account: 'A', category: 'BC' }),
    fingerprintOf({ ...row, account: 'AB', category: 'C' }),
  );
});

test('a non-integer amount is refused rather than silently hashed', () => {
  assert.throws(() => fingerprintOf({ ...row, amountMinor: -50200.09 }), /minor units/);
});

test('normalizeField collapses whitespace and handles nothing at all', () => {
  assert.equal(normalizeField('  a   b  '), 'a b');
  assert.equal(normalizeField(null), '');
  assert.equal(normalizeField(undefined), '');
  assert.equal(normalizeField('\ttabs\nand\nnewlines'), 'tabs and newlines');
});

test('sequences number repeated rows in file order', () => {
  // The real backup holds six pairs of identical rows; collapsing them would
  // lose money, so each copy gets its own slot.
  assert.deepEqual(assignSequences(['a', 'b', 'a', 'c', 'a', 'b']), [1, 1, 2, 1, 3, 2]);
  assert.deepEqual(assignSequences([]), []);
  assert.deepEqual(assignSequences(['only']), [1]);
});

test('a fingerprint reads back as something a human can check', () => {
  assert.equal(
    formatFingerprint(fingerprintOf(row)),
    '2021-06-26 | Bancolombia | Restaurante | -5020000 | Rappi',
  );
});
