// A credit card set up by "Cupo total" and "Cupo disponible hoy", or by what
// is owed (core/cards/card-setup.ts, mockups 32a-32d).
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/card-setup.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { balanceFromAvailable, balanceFromOwed, openingFor, standingOf } from '../../src/app/core/cards/card-setup.ts';

test('the limit less what is available is the debt (32a)', () => {
  const balance = balanceFromAvailable(750_000_000, 520_000_000);
  assert.equal(balance, -230_000_000);
  assert.equal(standingOf(balance), 'owes');
});

test('available above the limit is money in favour, equal is nothing owed (32c)', () => {
  assert.equal(balanceFromAvailable(750_000_000, 756_000_000), 6_000_000);
  assert.equal(standingOf(6_000_000), 'favour');
  assert.equal(balanceFromAvailable(750_000_000, 750_000_000), 0);
  assert.equal(standingOf(0), 'clear');
});

test('what is owed is typed without a minus and stored as one (32b)', () => {
  assert.equal(balanceFromOwed(230_000_000), -230_000_000);
  assert.equal(balanceFromOwed(-230_000_000), -230_000_000);
  assert.equal(balanceFromOwed(0), 0);
});

test('editing moves only the opening figure: movements stay, the balance lands where the bank says (32d)', () => {
  // A card opened at -1.000.000 with movements adding up to -2.627.100: it holds -3.627.100.
  const movements = -262_710_000;
  const target = balanceFromAvailable(750_000_000, 387_290_000);
  const opening = openingFor(target, movements);
  assert.equal(opening + movements, target);
  assert.equal(opening, -100_000_000);
  // The same figures as today change nothing.
  assert.equal(openingFor(-100_000_000 + movements, movements), -100_000_000);
});
