// What the iPhone's "Registrar un pago con Apple Pay en Finance" intent writes
// (PaymentWords.sentence in ios/App/App/FinanceIntents.swift, ported here
// line for line) must read as money that went out, with its shop and amount,
// however Shortcuts hands the amount over. Invented shops and cards.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/apple-pay-words.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readNotice } from '../../src/app/core/notices/read-notice.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

/** The Swift, ported. */
function sentence(merchant, amount, card) {
  let figure = amount.trim();
  if (/^\d/.test(figure)) figure = '$ ' + figure;
  let words = `Compraste en ${merchant.trim()} por ${figure}`;
  if (card && card.trim()) words += ` con tu tarjeta ${card.trim()}`;
  return words + ' con Apple Pay.';
}

test('the port is the Swift that ships', () => {
  const swift = readFileSync(join(ROOT, 'ios/App/App/FinanceIntents.swift'), 'utf8');
  assert.match(swift, /"Compraste en \\\(merchant\.trimmingCharacters/);
  assert.match(swift, /if let first = figure\.first, first\.isNumber \{ figure = "\$ " \+ figure \}/);
  assert.match(swift, /words \+= " con tu tarjeta \\\(card\)"/);
  assert.match(swift, /return words \+ " con Apple Pay\."/);
});

const CASES = [
  ['Panadería La Espiga', '$45.900,00', 'Visa Azul', 4590000],
  ['Panadería La Espiga', '$45,900.00', 'Visa Azul', 4590000],
  ['Café del Parque', '12500', undefined, 1250000],
  ['Café del Parque', 'COP 12.500', 'Débito Verde', 1250000],
];

for (const [shop, amount, card, minor] of CASES) {
  test(`an Apple Pay payment of ${amount} at ${shop} is money out`, () => {
    const got = readNotice(sentence(shop, amount, card), card ?? 'Apple Pay', '2026-11-26');
    assert.equal(got.kind, 'movement');
    assert.equal(got.direction, 'out');
    assert.equal(got.amountMinor, minor);
    assert.match(got.merchant ?? '', new RegExp(shop.split(' ')[0]));
  });
}
